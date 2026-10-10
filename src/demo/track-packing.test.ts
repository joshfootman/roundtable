import { expect, test } from 'vitest'
import { packTrack, unpackTrack } from './track-packing'

test('round-trips positions to within half a fixed-point step', () => {
  // Two samples, two players, XYZ.
  const values = [100.25, -3200.4, 12.01, 4096.5, 0, -1, 101.3, -3199.9, 12.01, -4096.5, 7.77, -1]
  const shape = { samples: 2, players: 2, width: 3 }
  const decoded = unpackTrack(
    packTrack(values, shape, { scale: 64 }),
    shape,
    { scale: 64 },
    new Float32Array(12),
  )
  expect(Array.from(decoded)).toEqual(values.map((value) => Math.round(value * 64) / 64))
})

test('keeps headings in range when they cross ±180°', () => {
  const values = [179.9, -179.9, 179.5, -180]
  const shape = { samples: 4, players: 1, width: 1 }
  const packing = { scale: 1000, period: 360 }
  const decoded = unpackTrack(
    packTrack(values, shape, packing),
    shape,
    packing,
    new Float32Array(4),
  )
  expect(Array.from(decoded, (value) => Math.round(value * 1000))).toEqual([
    179900, -179900, 179500, -180000,
  ])
})

test('rejects a track whose length disagrees with its shape', () => {
  expect(() => packTrack([1, 2], { samples: 3, players: 1, width: 1 }, { scale: 1 })).toThrow(
    'wrong length',
  )
  expect(() =>
    unpackTrack(
      new Uint8Array(3),
      { samples: 1, players: 1, width: 1 },
      { scale: 1 },
      new Float32Array(1),
    ),
  ).toThrow('wrong length')
})
