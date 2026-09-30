import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { Effect } from 'effect'
import { expect, test } from 'vitest'
import { readDemo } from './demo'
import { readFirstRound } from './round'
import { readRecordFraming } from './source'

const fixture = gunzipSync(readFileSync('fixtures/replay/dust2-first-round.dem.gz'))
const oracle = JSON.parse(readFileSync('fixtures/replay/oracle.json', 'utf8')) as {
  startTick: number
  endTick: number
  tickInterval: number
  samples: {
    tick: number
    players: {
      steamId: string
      name: string
      team: number
      X: number
      Y: number
      Z: number
      alive: boolean
    }[]
  }[]
}
const players = [
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
]

function source(bytes: Uint8Array) {
  return {
    size: bytes.length,
    readRange: (offset: number, length: number) =>
      Effect.succeed(bytes.subarray(offset, offset + length)),
  }
}

test('decodes a real competitive round against independent identities and position samples', async () => {
  let largestRead = 0
  const demo = await Effect.runPromise(
    readDemo({
      ...source(fixture),
      readRange: (offset, length) => {
        largestRead = Math.max(largestRead, length)
        return Effect.succeed(fixture.subarray(offset, offset + length))
      },
    }),
  )
  expect(demo.metadata).toEqual({
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
  expect([...demo.players].sort((a, b) => a.name.localeCompare(b.name, 'en'))).toEqual(players)
  const round = demo.firstRound
  expect(round.number).toBe(1)
  expect(round.startTick).toBe(oracle.startTick)
  expect(round.liveStartTick).toBe(5732)
  expect(round.endTick).toBe(oracle.endTick)
  expect(round.tickInterval).toBe(oracle.tickInterval)
  expect(largestRead).toBeLessThan(1024 * 1024)
  for (const expected of oracle.samples) {
    const sample = round.ticks.indexOf(expected.tick)
    expect(sample, `missing recorded tick ${expected.tick}`).not.toBe(-1)
    for (const player of expected.players) {
      const index = round.players.findIndex((entry) => entry.steamId === player.steamId)
      expect(round.players[index]).toEqual({
        steamId: player.steamId,
        name: player.name,
        team: player.team,
      })
      const offset = (sample * round.players.length + index) * 3
      expect(round.positions[offset]).toBeCloseTo(player.X, 2)
      expect(round.positions[offset + 1]).toBeCloseTo(player.Y, 2)
      expect(round.positions[offset + 2]).toBeCloseTo(player.Z, 2)
      expect(round.alive[sample * round.players.length + index]).toBe(Number(player.alive))
    }
  }
})

test('rejects an incomplete round instead of publishing partial movement', async () => {
  let offset = 16
  while (offset < 200_000) {
    const framing = await Effect.runPromise(readRecordFraming(source(fixture), offset))
    offset = framing.end
  }
  const bytes = Buffer.concat([fixture.subarray(0, offset), Buffer.from([0, 0, 0])])
  await expect(Effect.runPromise(readFirstRound(source(bytes)))).rejects.toThrow(
    'The demo ends before a complete competitive round is recorded.',
  )
})
