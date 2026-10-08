import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { expect, test } from 'vitest'
import { decodeRound, encodeRound } from './replay-codec'
import { recordAtTick } from '../replay/frames'

test('decodes recorded binary tracks and rejects incompatible or truncated assets', () => {
  const raw = gunzipSync(readFileSync('public/example/round-1.rpl'))
  const bytes = new Uint8Array(raw).buffer
  const round = decodeRound(bytes)
  expect({
    number: round.number,
    start: round.startTick,
    live: round.liveStartTick,
    end: round.endTick,
  }).toEqual({ number: 1, start: 537, live: 5732, end: 8282 })
  expect(round.players[0]).toEqual({ steamId: '76561197973140692', name: 'mezii' })
  expect(round.positions[0]).toBeCloseTo(182.24991, 5)
  expect(Array.from(round.positions.subarray(1, 3))).toEqual([2439.01171875, -120.96875])
  expect(round.deaths[0]).toEqual({
    tick: 7325,
    victim: '76561197989430253',
    killer: { type: 'player', steamId: '76561197978835160' },
    weapon: 'usp_silencer',
    headshot: true,
  })
  const restored = decodeRound(encodeRound(round))
  expect(round.score).toEqual({ ct: 0, t: 0 })
  expect(restored.score).toEqual(round.score)
  expect(restored.inspection).toEqual(round.inspection)
  expect(round.inspection[0]?.[0]?.weapons).toEqual([
    { type: 'gun', definition: 32, magazine: 13, reserve: 52 },
    { type: 'item', definition: 507 },
  ])
  expect(restored.ticks[0]).toBe(537)
  expect(restored.deaths[0]?.weapon).toBe('usp_silencer')
  expect(
    createHash('sha256')
      .update(
        new Uint8Array(
          restored.positions.buffer,
          restored.positions.byteOffset,
          restored.positions.byteLength,
        ),
      )
      .digest('hex'),
  ).toBe(
    createHash('sha256')
      .update(
        new Uint8Array(
          round.positions.buffer,
          round.positions.byteOffset,
          round.positions.byteLength,
        ),
      )
      .digest('hex'),
  )
  const wrongVersion = bytes.slice(0)
  new DataView(wrongVersion).setUint32(0, 0)
  expect(() => decodeRound(wrongVersion)).toThrow('Unsupported replay asset version')
  expect(() => decodeRound(bytes.slice(0, -1))).toThrow('Truncated replay asset tracks')
})

test('preserves optional outcomes, names and ladder states while accepting legacy rounds', () => {
  const raw = gunzipSync(readFileSync('public/example/round-1.rpl'))
  const round = decodeRound(new Uint8Array(raw).buffer)
  round.outcome = { winner: 't', reason: 1, teamName: 'FaZe', mvp: { name: 'broky' } }
  round.teamNames = { ct: 'Vitality', t: 'FaZe Clan' }
  const inspection = round.inspection[0]![0]!
  inspection.onLadder = true
  const restored = decodeRound(encodeRound(round))
  expect(restored.outcome).toEqual({
    winner: 't',
    reason: 1,
    teamName: 'FaZe',
    mvp: { name: 'broky' },
  })
  expect(restored.teamNames).toEqual({ ct: 'Vitality', t: 'FaZe Clan' })
  expect(restored.inspection[0]![0]!.onLadder).toBe(true)
  inspection.onLadder = false
  expect(decodeRound(encodeRound(round)).inspection[0]![0]!.onLadder).toBe(false)
  delete round.outcome
  delete round.teamNames
  delete inspection.onLadder
  const legacy = decodeRound(encodeRound(round))
  expect(legacy.outcome).toBeUndefined()
  expect(legacy.teamNames).toBeUndefined()
  expect(legacy.inspection[0]![0]!.onLadder).toBeUndefined()
})

test('matches independently decoded ladder entry and exit in the bundled Nuke recording', () => {
  const raw = gunzipSync(readFileSync('public/examples/astralis-vs-mouz-m2-nuke/round-1.rpl'))
  const round = decodeRound(new Uint8Array(raw).buffer)
  const observations = JSON.parse(readFileSync('fixtures/replay/nuke-ladder.json', 'utf8')) as {
    tick: number
    steamId: string
    onLadder: boolean
  }[]
  for (const observation of observations) {
    const player = round.players.findIndex(({ steamId }) => steamId === observation.steamId)
    expect(player).toBeGreaterThanOrEqual(0)
    expect(recordAtTick(round.inspection[player]!, observation.tick).onLadder).toBe(
      observation.onLadder,
    )
  }
})

test('preserves dropped item lifetimes and normalizes legacy rounds to an empty opening snapshot', () => {
  const raw = gunzipSync(readFileSync('public/example/round-1.rpl'))
  const round = decodeRound(new Uint8Array(raw).buffer)
  round.droppedItems = [
    { tick: 537, items: [] },
    { tick: 6000, items: [{ entity: 4, serial: 7, definition: 7, x: 1, y: 2, z: 3 }] },
    { tick: 6010, items: [] },
  ]
  expect(decodeRound(encodeRound(round)).droppedItems).toEqual([
    { tick: 537, items: [] },
    { tick: 6000, items: [{ entity: 4, serial: 7, definition: 7, x: 1, y: 2, z: 3 }] },
    { tick: 6010, items: [] },
  ])
  Reflect.deleteProperty(round, 'droppedItems')
  expect(decodeRound(encodeRound(round)).droppedItems).toEqual([{ tick: 537, items: [] }])
})

test('rejects malformed dropped item snapshots at the replay asset boundary', () => {
  const raw = gunzipSync(readFileSync('public/example/round-1.rpl'))
  const round = decodeRound(new Uint8Array(raw).buffer)
  const item = { entity: 4, serial: 7, definition: 7, x: 1, y: 2, z: 3 }
  for (const records of [
    [],
    [{ tick: 538, items: [item] }],
    [
      { tick: 537, items: [] },
      { tick: 9000, items: [item] },
    ],
    [
      { tick: 537, items: [] },
      { tick: 537, items: [item] },
    ],
    [{ tick: 537, items: [item, item] }],
    [{ tick: 537, items: [{ ...item, definition: 49 }] }],
    [{ tick: 537, items: [{ ...item, definition: 42 }] }],
    [{ tick: 537, items: [{ ...item, x: Infinity }] }],
  ]) {
    round.droppedItems = records
    expect(() => decodeRound(encodeRound(round))).toThrow()
  }
  round.droppedItems = [{ tick: 537, items: [item] }]
  expect(decodeRound(encodeRound(round)).droppedItems).toEqual([
    { tick: 537, items: [{ entity: 4, serial: 7, definition: 7, x: 1, y: 2, z: 3 }] },
  ])
})
