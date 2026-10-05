import type { BombState } from '../replay/types.ts'
import { equipmentName } from '../replay/equipment.ts'
import { recordAtTick } from '../replay/frames.ts'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { Effect, Stream } from 'effect'
import { expect, test, vi } from 'vitest'
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
    bomb: BombState
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
      money: number
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
  expect(round.outcome).toEqual({
    winner: 'ct',
    reason: 8,
    teamName: 'Vitality',
    mvp: { name: 'Spinx' },
  })
  expect(round.players).toEqual(
    oracle.samples[0]!.players.map(({ steamId, name }) => ({ steamId, name })),
  )
  expect(round.deaths).toEqual([
    {
      tick: 7325,
      victim: '76561197989430253',
      killer: { type: 'player', steamId: '76561197978835160' },
      headshot: true,
      weapon: 'usp_silencer',
    },
    {
      tick: 7695,
      victim: '76561197991272318',
      killer: { type: 'player', steamId: '76561198063336407' },
      headshot: true,
      weapon: 'usp_silencer',
    },
    {
      tick: 7749,
      victim: '76561198201620490',
      killer: { type: 'player', steamId: '76561197973140692' },
      headshot: true,
      weapon: 'hkp2000',
    },
    {
      tick: 7764,
      victim: '76561197973140692',
      killer: { type: 'player', steamId: '76561197997351207' },
      headshot: true,
      weapon: 'glock',
    },
    {
      tick: 7782,
      victim: '76561198068422762',
      killer: { type: 'player', steamId: '76561198063336407' },
      headshot: true,
      weapon: 'usp_silencer',
    },
    {
      tick: 7834,
      victim: '76561197997351207',
      killer: { type: 'player', steamId: '76561198063336407' },
      headshot: true,
      weapon: 'usp_silencer',
    },
  ])
  const brokyTrack = round.inspection[round.players.findIndex((player) => player.name === 'broky')]!
  expect(recordAtTick(brokyTrack, 7443).grenades).toEqual([
    { definition: 43, count: 2 },
    { definition: 46, count: 1 },
  ])
  expect(recordAtTick(brokyTrack, 7444).grenades).toEqual([
    { definition: 43, count: 1 },
    { definition: 46, count: 1 },
  ])
  const flashOracle = JSON.parse(readFileSync('fixtures/replay/first-flash.json', 'utf8')) as {
    positions: { tick: number; position: { X: number; Y: number; Z: number } }[]
  }
  const flash = round.projectiles.find((projectile) => projectile.entity === 948)!
  expect({
    kind: flash.kind,
    thrower: flash.thrower,
    startTick: flash.startTick,
    endTick: flash.endTick,
  }).toEqual({ kind: 'flash', thrower: '76561198068422762', startTick: 6362, endTick: 6466 })
  expect(Array.from(flash.ticks)).toEqual(flashOracle.positions.map((sample) => sample.tick))
  expect(Array.from(flash.positions)).toEqual(
    flashOracle.positions.flatMap((sample) => [
      sample.position.X,
      sample.position.Y,
      sample.position.Z,
    ]),
  )
  expect(round.detonations.filter((event) => event.tick === 6466 && event.entity === 948)).toEqual([
    {
      tick: 6466,
      entity: 948,
      kind: 'flash',
      x: 999.5439453125,
      y: 475.7112121582031,
      z: 416.1570129394531,
    },
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
    const bomb = recordAtTick(round.bomb, expected.tick).state
    if (expected.bomb.type === 'carried') expect(bomb).toEqual(expected.bomb)
    else {
      expect(bomb.type).toBe(expected.bomb.type)
      if (
        (bomb.type === 'dropped' || bomb.type === 'planted') &&
        (expected.bomb.type === 'dropped' || expected.bomb.type === 'planted')
      ) {
        expect(bomb.x).toBeCloseTo(expected.bomb.x, 2)
        expect(bomb.y).toBeCloseTo(expected.bomb.y, 2)
        expect(bomb.z).toBeCloseTo(expected.bomb.z, 2)
      }
    }
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
      const { weapon, armour, helmet, grenades, money } = recordAtTick(
        round.inspection[index]!,
        expected.tick,
      )
      expect({ armour, helmet, grenades, money }).toEqual({
        money: player.money,
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

test('replays bomb and utility events across four rounds', { timeout: 15_000 }, async () => {
  const bytes = gunzipSync(readFileSync('fixtures/replay/dust2-through-round-4.dem.gz'))
  const rounds = await Effect.runPromise(
    readRounds(source(bytes)).pipe(Stream.take(4), Stream.runCollect),
  )
  expect(Array.from(rounds).map((round) => round.number)).toEqual([1, 2, 3, 4])
  const flashes = JSON.parse(readFileSync('fixtures/replay/flashes.json', 'utf8')) as {
    tick: number
    players: unknown[]
  }[]
  for (const frame of flashes) {
    const round = Array.from(rounds).find(
      (round) => round.startTick <= frame.tick && frame.tick < round.endTick,
    )!
    expect(
      round.players.map((player, index) => ({
        steamId: player.steamId,
        flash: recordAtTick(round.inspection[index]!, frame.tick).flash,
      })),
    ).toEqual(frame.players)
  }
  const expectedShots = JSON.parse(readFileSync('fixtures/replay/shots.json', 'utf8')) as {
    round: number
  }[]
  expect(
    Array.from(rounds).flatMap((round) =>
      round.shots.map((shot) => ({ ...shot, round: round.number })),
    ),
  ).toEqual(expectedShots.filter((shot) => shot.round <= 4))
  const expectedDetonations = JSON.parse(
    readFileSync('fixtures/replay/detonations.json', 'utf8'),
  ) as { round: number }[]
  const expectedProjectiles = JSON.parse(
    readFileSync('fixtures/replay/projectile-lifetimes.json', 'utf8'),
  ) as { round: number }[]
  expect(
    Array.from(rounds).flatMap((round) =>
      round.detonations.map((event) => ({ ...event, round: round.number })),
    ),
  ).toEqual(expectedDetonations.filter((event) => event.round <= 4))
  expect(
    Array.from(rounds).flatMap((round) =>
      round.projectiles.map(({ entity, kind, thrower, startTick, endTick }) => ({
        entity,
        kind,
        thrower,
        startTick,
        endTick,
        round: round.number,
      })),
    ),
  ).toEqual(expectedProjectiles.filter((event) => event.round <= 4))
  expect(
    Array.from(rounds).flatMap((round) =>
      round.fires.filter((frame) => frame.tick !== round.startTick),
    ),
  ).toEqual(JSON.parse(readFileSync('fixtures/replay/fires.json', 'utf8')))
  const expectedSmokes = JSON.parse(readFileSync('fixtures/replay/smokes.json', 'utf8')) as {
    round: number
  }[]
  expect(
    Array.from(rounds).flatMap((round) =>
      round.smokes.map((smoke) => ({ ...smoke, round: round.number })),
    ),
  ).toEqual(expectedSmokes.filter((smoke) => smoke.round <= 4))
  const round = Array.from(rounds)[3]!
  expect(Array.from(rounds)[1]!.bombEvents).toEqual([
    { tick: 13170, type: 'plant-start', player: '76561197997351207' },
    { tick: 13337, type: 'plant-abort', player: '76561197997351207' },
  ])
  expect(round.bombEvents).toEqual([
    { tick: 30355, type: 'plant-start', player: '76561198068422762' },
    { tick: 30555, type: 'planted', player: '76561198068422762' },
    { tick: 31328, type: 'defuse-start', player: '76561197978835160' },
    { tick: 31528, type: 'defuse-abort', player: '76561197978835160' },
    { tick: 31645, type: 'defuse-start', player: '76561197978835160' },
    { tick: 31965, type: 'defused', player: '76561197978835160' },
  ])
  expect(recordAtTick(round.bomb, 31328).state).toEqual({
    type: 'planted',
    x: 987.96875,
    y: 2486.71875,
    z: 96.46875,
    defuser: { type: 'player', steamId: '76561197978835160' },
  })
  expect(recordAtTick(round.bomb, 30555).state).toEqual({
    type: 'planted',
    x: 987.96875,
    y: 2486.71875,
    z: 96.46875,
    defuser: { type: 'none' },
  })
  expect(recordAtTick(round.bomb, 31964).state.type).toBe('planted')
  expect(recordAtTick(round.bomb, 31965).state).toEqual({ type: 'inactive' })
  expect(recordAtTick(round.bomb, 30554).state).toEqual({
    type: 'carried',
    carrier: '76561198068422762',
    planting: true,
  })
})

test('keeps the published round when a later replay allocation runs out of memory', async () => {
  const bytes = gunzipSync(readFileSync('fixtures/replay/dust2-through-round-4.dem.gz'))
  const completed: number[] = []
  const allocation = vi.spyOn(Float32Array, 'from')
  try {
    const result = await Effect.runPromise(
      Stream.runForEach(readReplay(source(bytes)), (event) =>
        Effect.sync(() => {
          if (event.type !== 'round') return
          completed.push(event.round.number)
          allocation.mockImplementation(() => {
            throw new RangeError('Array buffer allocation failed')
          })
        }),
      ).pipe(Effect.either),
    )
    expect(completed).toEqual([1])
    expect(result).toMatchObject({
      _tag: 'Left',
      left: {
        _tag: 'DemoParseError',
        message:
          'The browser ran out of memory while reading this demo. Close other tabs or choose a shorter recording.',
      },
    })
  } finally {
    allocation.mockRestore()
  }
})
