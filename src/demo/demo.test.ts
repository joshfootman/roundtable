import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { Effect, Stream } from 'effect'
import { expect, test } from 'vitest'
import { readDemo } from './demo'
import { readFirstRound, readReplay, readRounds } from './round'
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
  const boundaries = await Effect.runPromise(
    readReplay(source(fixture)).pipe(
      Stream.take(4),
      Stream.map((event) =>
        event.type === 'round'
          ? {
              type: event.type,
              number: event.round.number,
              startTick: event.round.startTick,
              endTick: event.round.endTick,
            }
          : event,
      ),
      Stream.runCollect,
    ),
  )
  expect(Array.from(boundaries)).toEqual([
    { type: 'round-start', number: 1, startTick: 449 },
    { type: 'round-start', number: 1, startTick: 537 },
    { type: 'round', number: 1, startTick: 537, endTick: 8282 },
    { type: 'round-start', number: 2, startTick: 8282 },
  ])
  const round = demo.firstRound
  expect(round.players).toEqual(
    oracle.samples[0]!.players.map(({ steamId, name, team }) => ({ steamId, name, team })),
  )
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
  offset = 16
  while (true) {
    const framing = await Effect.runPromise(readRecordFraming(source(fixture), offset))
    offset = framing.end
    if (framing.tick >= 7834 && framing.tick < 8282) break
  }
  await expect(
    Effect.runPromise(Stream.runDrain(readRounds(source(fixture.subarray(0, offset))))),
  ).rejects.toThrow('terminal record')
})
