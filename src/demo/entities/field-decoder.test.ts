import { expect, test } from 'vitest'
import { BitReader } from './bit-reader.ts'
import { decoder } from './field-decoder.ts'

test('decodes unlisted field types as unsigned varints', () => {
  const field = {
    name: 'm_nDissolveType',
    type: 'EntityDissolveType_t',
    encoder: '',
    bitCount: 0,
    flags: 0,
    low: 0,
    high: 0,
  }
  const reader = new BitReader(new Uint8Array([0xac, 0x02, 0x05]))
  const decode = decoder(field)
  expect([decode(reader), decode(reader)]).toEqual([300, 5])
})
