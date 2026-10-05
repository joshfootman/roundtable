import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { expect, test } from 'vitest'
import { decodeRound, encodeRound } from './replay-codec'

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
