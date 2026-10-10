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
  // Recorded 182.24991, 2439.0117, -120.96875; assets keep positions to 1/64 unit.
  expect(Array.from(round.positions.subarray(0, 3))).toEqual([182.25, 2439.015625, -120.96875])
  expect(round.deaths[0]).toEqual({
    tick: 7325,
    victim: '76561197989430253',
    killer: { type: 'player', steamId: '76561197978835160' },
    weapon: 'usp_silencer',
    headshot: true,
    flashAssist: false,
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

test('preserves optional outcomes, names and ladder states, and their absence', () => {
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
  const bare = decodeRound(encodeRound(round))
  expect(bare.outcome).toBeUndefined()
  expect(bare.teamNames).toBeUndefined()
  expect(bare.inspection[0]![0]!.onLadder).toBeUndefined()
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

test('preserves dropped item placements', () => {
  const raw = gunzipSync(readFileSync('public/example/round-1.rpl'))
  const round = decodeRound(new Uint8Array(raw).buffer)
  round.droppedItems = [
    { entity: 4, serial: 7, definition: 7, x: 1, y: 2, z: 3, from: 6000, to: 6010 },
    { entity: 5, serial: 1, definition: 43, x: 1, y: 2, z: 3, from: 6005, to: 8282 },
  ]
  expect(decodeRound(encodeRound(round)).droppedItems).toEqual(round.droppedItems)
})

test('rejects malformed dropped item placements at the replay asset boundary', () => {
  const raw = gunzipSync(readFileSync('public/example/round-1.rpl'))
  const round = decodeRound(new Uint8Array(raw).buffer)
  const item = { entity: 4, serial: 7, definition: 7, x: 1, y: 2, z: 3, from: 600, to: 700 }
  for (const records of [
    [{ ...item, from: 536 }],
    [{ ...item, to: 8283 }],
    [{ ...item, to: 600 }],
    [item, { ...item, from: 599 }],
    [{ ...item, definition: 49 }],
    [{ ...item, definition: 42 }],
    [{ ...item, x: Infinity }],
  ]) {
    round.droppedItems = records
    expect(() => decodeRound(encodeRound(round))).toThrow()
  }
})
