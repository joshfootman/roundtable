import { expect, test } from 'vitest'
import { BitReader } from './bit-reader'

function shifted(bytes: number[], offset: number) {
  const data = new Uint8Array(Math.ceil((bytes.length * 8 + offset) / 8))
  for (let index = 0; index < bytes.length; index++) {
    const bit = index * 8 + offset
    data[bit >> 3]! |= bytes[index]! << (bit & 7)
    if (bit & 7) data[(bit >> 3) + 1]! |= bytes[index]! >> (8 - (bit & 7))
  }
  return data
}

test.each([0, 1, 2, 3, 4, 5, 6, 7])('reads little-endian floats at bit offset %i', (offset) => {
  const reader = new BitReader(
    shifted(
      [
        0x00, 0x00, 0xc0, 0x3f, 0x00, 0x00, 0x10, 0xc0, 0x00, 0x00, 0x00, 0x80, 0x00, 0x00, 0x80,
        0x7f, 0x00, 0x00, 0x80, 0xff, 0x00, 0x00, 0xc0, 0x7f, 0x95,
      ],
      offset,
    ),
  )
  reader.bits(offset)
  expect(reader.float()).toBe(1.5)
  expect(reader.float()).toBe(-2.25)
  expect(reader.float()).toBe(-0)
  expect(reader.float()).toBe(Infinity)
  expect(reader.float()).toBe(-Infinity)
  expect(reader.float()).toBeNaN()
  expect(reader.bits(8)).toBe(0x95)
})

test.each([0, 1, 2, 3, 4, 5, 6, 7])('preserves high uint64 bits at bit offset %i', (offset) => {
  const reader = new BitReader(
    shifted(
      [
        0xf1, 0xe2, 0xd3, 0xc4, 0xb5, 0xa6, 0x97, 0x88, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
        0xff, 0x26,
      ],
      offset,
    ),
  )
  reader.bits(offset)
  expect(reader.fixed64()).toBe(0x8897a6b5c4d3e2f1n)
  expect(reader.fixed64()).toBe(0xffffffffffffffffn)
  expect(reader.bits(8)).toBe(0x26)
})

test.each([0, 1, 2, 3, 4, 5, 6, 7])(
  'mixes bytes, floats and integers at bit offset %i',
  (offset) => {
    const data = shifted(
      [
        0x00, 0x00, 0xc0, 0x3f, 0xa5, 0x00, 0x7e, 0xf1, 0xe2, 0xd3, 0xc4, 0xb5, 0xa6, 0x97, 0x88,
        0x6d,
      ],
      offset,
    )
    const backing = new Uint8Array(data.length + 5)
    backing.fill(0xff)
    backing.set(data, 3)
    const reader = new BitReader(backing.subarray(3, 3 + data.length))
    reader.bits(offset)
    expect(reader.float()).toBe(1.5)
    expect(reader.bytes(3)).toEqual(new Uint8Array([0xa5, 0x00, 0x7e]))
    expect(reader.fixed64()).toBe(0x8897a6b5c4d3e2f1n)
    expect(reader.bits(3)).toBe(5)
    expect(reader.bits(5)).toBe(13)
  },
)

test.each([0, 1, 2, 3, 4, 5, 6, 7])(
  'does not consume truncated reads at bit offset %i',
  (offset) => {
    const floats = new BitReader(shifted([0x41, 0x52, 0x63], offset))
    floats.bits(offset)
    const remaining = floats.remaining
    expect(() => floats.float()).toThrow('The demo contains truncated entity bytes.')
    expect(floats.remaining).toBe(remaining)
    expect(floats.bytes(3)).toEqual(new Uint8Array([0x41, 0x52, 0x63]))

    const bytes = new BitReader(shifted([0x41, 0x52, 0x63], offset))
    bytes.bits(offset)
    expect(() => bytes.bytes(4)).toThrow('The demo contains truncated entity bytes.')
    expect(bytes.remaining).toBe(remaining)
    expect(bytes.bytes(3)).toEqual(new Uint8Array([0x41, 0x52, 0x63]))

    const integers = new BitReader(shifted([0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77], offset))
    integers.bits(offset)
    const integerRemaining = integers.remaining
    expect(() => integers.fixed64()).toThrow('The demo contains truncated entity bytes.')
    expect(integers.remaining).toBe(integerRemaining)
    expect(integers.bytes(7)).toEqual(new Uint8Array([0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77]))
  },
)
