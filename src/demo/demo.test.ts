import { equipmentName } from '../replay/equipment.ts'
import { inspectionAtTick } from '../replay/frames.ts'
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
      health: number
      yaw: number
      armour: number
      helmet: boolean
      grenades: { definition: number; count: number }[]
      weapon: { type: string; name?: string; magazine?: number; reserve?: number }
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
      Stream.take(5),
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
    { type: 'reset' },
    { type: 'round-start', number: 1, startTick: 537 },
    { type: 'round', number: 1, startTick: 537, endTick: 8282 },
    { type: 'round-start', number: 2, startTick: 8282 },
  ])
  const round = demo.firstRound
  expect(round.players).toEqual(
    oracle.samples[0]!.players.map(({ steamId, name }) => ({ steamId, name })),
  )
  expect(round.deaths).toEqual([
    {
      tick: 7325,
      victim: '76561197989430253',
      killer: { type: 'player', steamId: '76561197978835160' },
      headshot: true,
    },
    {
      tick: 7695,
      victim: '76561197991272318',
      killer: { type: 'player', steamId: '76561198063336407' },
      headshot: true,
    },
    {
      tick: 7749,
      victim: '76561198201620490',
      killer: { type: 'player', steamId: '76561197973140692' },
      headshot: true,
    },
    {
      tick: 7764,
      victim: '76561197973140692',
      killer: { type: 'player', steamId: '76561197997351207' },
      headshot: true,
    },
    {
      tick: 7782,
      victim: '76561198068422762',
      killer: { type: 'player', steamId: '76561198063336407' },
      headshot: true,
    },
    {
      tick: 7834,
      victim: '76561197997351207',
      killer: { type: 'player', steamId: '76561198063336407' },
      headshot: true,
    },
  ])
  const brokyTrack = round.inspection[round.players.findIndex((player) => player.name === 'broky')]!
  expect(inspectionAtTick(brokyTrack, 7443).grenades).toEqual([
    { definition: 43, count: 2 },
    { definition: 46, count: 1 },
  ])
  expect(inspectionAtTick(brokyTrack, 7444).grenades).toEqual([
    { definition: 43, count: 1 },
    { definition: 46, count: 1 },
  ])
  expect(round.number).toBe(1)
  expect(round.startTick).toBe(oracle.startTick)
  expect(round.liveStartTick).toBe(5732)
  expect(round.resultTick).toBe(7834)
  expect(round.overtime).toBe(0)
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
      const state = sample * round.players.length + index
      expect(round.alive[state]).toBe(Number(player.alive))
      expect(round.health[state]).toBe(player.health)
      expect(round.yaw[state]).toBeCloseTo(player.yaw, 3)
      expect(round.teams[state]).toBe(player.team)
      const { weapon, armour, helmet, grenades } = inspectionAtTick(
        round.inspection[index]!,
        expected.tick,
      )
      expect({ armour, helmet, grenades }).toEqual({
        armour: player.armour,
        helmet: player.helmet,
        grenades: player.grenades,
      })
      expect(
        weapon.type === 'none'
          ? weapon
          : weapon.type === 'item'
            ? { type: weapon.type, name: equipmentName(weapon.definition) }
            : {
                type: weapon.type,
                name: equipmentName(weapon.definition),
                magazine: weapon.magazine,
                reserve: weapon.reserve,
              },
      ).toEqual(player.weapon)
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
