import assert from 'node:assert/strict'
import { open } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { Effect } from 'effect'
import { DemoReadError, readDemoMetadata } from '../src/demo/metadata.ts'
import { readDemo } from '../src/demo/demo.ts'

const verifyRound = process.argv.includes('--round')
const verifyRoster = verifyRound || process.argv.includes('--roster')
const path =
  process.argv.slice(2).find((argument) => !['--roster', '--round'].includes(argument)) ??
  'fixtures/faze-vs-vitality-m2-dust2.dem'
let bytesRead = 0
let reads = 0
let largestRead = 0
const started = performance.now()
const job = Effect.scoped(
  Effect.gen(function* () {
    const file = yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: () => open(path, 'r'),
        catch: (error) => new DemoReadError({ message: String(error) }),
      }),
      (file) => Effect.promise(() => file.close()),
    )
    const stat = yield* Effect.tryPromise({
      try: () => file.stat(),
      catch: (error) => new DemoReadError({ message: String(error) }),
    })
    const source = {
      size: stat.size,
      readRange: (offset: number, length: number) =>
        Effect.tryPromise({
          try: async () => {
            const buffer = new Uint8Array(length)
            const result = await file.read(buffer, 0, length, offset)
            bytesRead += result.bytesRead
            reads++
            largestRead = Math.max(largestRead, length)
            return buffer.subarray(0, result.bytesRead)
          },
          catch: (error) => new DemoReadError({ message: String(error) }),
        }),
    }
    const metadata = yield* readDemoMetadata(source)
    assert.deepEqual(metadata, {
      mapName: 'de_dust2',
      serverName: 'BLAST Premier 2024',
      clientName: 'SourceTV Demo',
      gameDirectory: '/home/csserver001/cs2/game/csgo',
      demoVersion: 'valve_demo_2',
      patchVersion: 14011,
      buildNumber: 10072,
      durationSeconds: 3078.25,
      playbackTicks: 197008,
      playbackFrames: 197003,
    })
    assert.ok(bytesRead < 1024, `Metadata read budget exceeded: ${bytesRead} bytes`)
    let players
    let roundSummary
    if (verifyRoster) {
      const demo = yield* readDemo(source)
      assert.deepEqual(demo.metadata, metadata)
      players = demo.firstRound.players
        .map(({ name, steamId }) => ({ name, steamId }))
        .sort((a, b) => a.name.localeCompare(b.name, 'en'))
      assert.deepEqual(players, [
        { name: 'apEX', steamId: '76561197989744167' },
        { name: 'broky', steamId: '76561198201620490' },
        { name: 'flameZ', steamId: '76561197978835160' },
        { name: 'frozen', steamId: '76561198068422762' },
        { name: 'karrigan', steamId: '76561197989430253' },
        { name: 'mezii', steamId: '76561197973140692' },
        { name: 'rain', steamId: '76561197997351207' },
        { name: 'ropz', steamId: '76561197991272318' },
        { name: 'Spinx', steamId: '76561198063336407' },
        { name: 'ZywOo', steamId: '76561198113666193' },
      ])
      assert.ok(bytesRead < 30_000_000, `First-round read budget exceeded: ${bytesRead} bytes`)
      assert.ok(largestRead < 1_000_000, `Oversized range read: ${largestRead} bytes`)
      if (verifyRound) {
        const expected = JSON.parse(
          readFileSync(new URL('../fixtures/replay/oracle.json', import.meta.url), 'utf8'),
        ) as {
          startTick: number
          endTick: number
          tickInterval: number
          samples: {
            tick: number
            players: {
              steamId: string
              X: number
              Y: number
              Z: number
              alive: boolean
              health: number
              yaw: number
              team: number
            }[]
          }[]
        }
        const round = demo.firstRound
        assert.equal(round.startTick, expected.startTick)
        assert.equal(round.liveStartTick, 5732)
        assert.equal(round.resultTick, 7834)
        assert.equal(round.overtime, 0)
        assert.equal(round.endTick, expected.endTick)
        assert.equal(round.tickInterval, expected.tickInterval)
        for (const frame of expected.samples) {
          const sample = round.ticks.indexOf(frame.tick)
          assert.ok(sample >= 0, `Missing oracle tick ${frame.tick}`)
          for (const player of frame.players) {
            const index = round.players.findIndex((entry) => entry.steamId === player.steamId)
            assert.ok(index >= 0, `Missing player ${player.steamId}`)
            const offset = (sample * round.players.length + index) * 3
            for (const [axis, coordinate] of [player.X, player.Y, player.Z].entries())
              assert.ok(
                Math.abs(round.positions[offset + axis]! - coordinate) < 0.005,
                `Position mismatch at tick ${frame.tick}, player ${player.steamId}, axis ${axis}`,
              )
            const state = sample * round.players.length + index
            assert.equal(round.alive[state], Number(player.alive))
            assert.equal(round.health[state], player.health)
            assert.ok(Math.abs(round.yaw[state]! - player.yaw) < 0.001)
            assert.equal(round.teams[state], player.team)
          }
        }
        roundSummary = {
          number: round.number,
          startTick: round.startTick,
          liveStartTick: round.liveStartTick,
          endTick: round.endTick,
          samples: round.ticks.length,
          oracleSamples: expected.samples.length,
          bytes:
            round.ticks.byteLength +
            round.positions.byteLength +
            round.alive.byteLength +
            round.health.byteLength +
            round.yaw.byteLength +
            round.teams.byteLength,
        }
      }
    }
    console.log(
      JSON.stringify(
        {
          path,
          fileBytes: stat.size,
          bytesRead,
          reads,
          largestRead,
          elapsedMs: Math.round(performance.now() - started),
          metadata,
          players,
          round: roundSummary,
        },
        null,
        2,
      ),
    )
  }),
)
await Effect.runPromise(job)
