import assert from 'node:assert/strict'
import { open } from 'node:fs/promises'
import { Effect } from 'effect'
import { DemoReadError, readDemoMetadata } from '../src/demo/metadata.ts'
import { readDemo } from '../src/demo/demo.ts'

const verifyRoster = process.argv.includes('--roster')
const path =
  process.argv.slice(2).find((argument) => argument !== '--roster') ??
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
      serverStartTick: 42184,
      durationSeconds: 3078.25,
      playbackTicks: 197008,
      playbackFrames: 197003,
    })
    assert.ok(bytesRead < 1024, `Metadata read budget exceeded: ${bytesRead} bytes`)
    let players
    if (verifyRoster) {
      const demo = yield* readDemo(source)
      assert.deepEqual(demo.metadata, metadata)
      players = [...demo.players].sort((a, b) => a.name.localeCompare(b.name, 'en'))
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
      assert.ok(bytesRead < 15_000_000, `Roster read budget exceeded: ${bytesRead} bytes`)
      assert.ok(largestRead < 1_000_000, `Oversized range read: ${largestRead} bytes`)
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
        },
        null,
        2,
      ),
    )
  }),
)
await Effect.runPromise(job)
