import { readFileSync, writeFileSync, openSync, readSync, closeSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { fromBinary, toBinary } from '@bufbuild/protobuf'
import { uncompress } from 'snappyjs'
import { CDemoPacketSchema, CDemoFullPacketSchema } from '../src/demo/generated/demo_pb.ts'
import { BitReader } from '../src/demo/entities/bit-reader.ts'
const path = process.argv[2] ?? 'fixtures/local/faze-vs-vitality-m2-dust2.dem'
const endTick =
  process.argv[3] === undefined
    ? (JSON.parse(readFileSync('fixtures/replay/oracle.json', 'utf8')) as { endTick: number })
        .endTick
    : Number(process.argv[3])
const output = process.argv[4] ?? 'fixtures/replay/dust2-first-round.dem.gz'
if (!Number.isInteger(endTick) || endTick < 0) throw new Error('Invalid fixture end tick.')
const file = openSync(path, 'r')
function read(offset: number, length: number) {
  const bytes = Buffer.alloc(length)
  if (readSync(file, bytes, 0, length, offset) !== length)
    throw new Error('Incomplete fixture source read.')
  return bytes
}
const container = read(0, 16)
const footer = container.readUInt32LE(8)

function varint(value: number) {
  const out: number[] = []
  do {
    const byte = value % 128
    value = Math.floor(value / 128)
    out.push(byte | (value ? 128 : 0))
  } while (value)
  return out
}
class Writer {
  bytes: number[] = []
  offset = 0
  bits(value: number, count: number) {
    for (let i = 0; i < count; i++, this.offset++) {
      const index = this.offset >> 3
      this.bytes[index] =
        (this.bytes[index] ?? 0) + ((Math.floor(value / 2 ** i) & 1) << (this.offset & 7))
    }
  }
  id(value: number) {
    if (value < 16) this.bits(value, 6)
    else if (value < 256) {
      this.bits((value & 15) | 16, 6)
      this.bits(value >> 4, 4)
    } else if (value < 4096) {
      this.bits((value & 15) | 32, 6)
      this.bits(value >> 4, 8)
    } else {
      this.bits((value & 15) | 48, 6)
      this.bits(value >>> 4, 28)
    }
  }
}
const keep = new Set([4, 40, 44, 45, 51, 55, 205, 207, 452])
function compact(data: Uint8Array) {
  const read = new BitReader(data)
  const write = new Writer()
  while (read.remaining >= 8) {
    const id = read.uBitVar()
    const len = read.varUint()
    const bytes = read.bytes(len)
    if (!keep.has(id)) continue
    write.id(id)
    for (const byte of varint(len)) write.bits(byte, 8)
    for (const byte of bytes) write.bits(byte, 8)
  }
  return Uint8Array.from(write.bytes)
}
let offset = 16
const records: Uint8Array[] = []
try {
  while (offset < footer) {
    const reader = new BitReader(read(offset, 15))
    const flags = reader.varUint()
    const tick = reader.varUint()
    const len = reader.varUint()
    const prefixBytes = (120 - reader.remaining) / 8
    const origin = offset
    offset += prefixBytes + len
    const command = flags & ~64
    if (tick > endTick && tick < 0xffff0000) break
    let payload = read(origin + prefixBytes, len)
    if (![1, 2, 4, 5, 6, 7, 8, 13].includes(command)) continue
    if ([7, 8, 13].includes(command)) {
      if (flags & 64) payload = Buffer.from(uncompress(payload))
      if (command === 13) {
        const full = fromBinary(CDemoFullPacketSchema, payload)
        if (full.packet) full.packet.data = compact(full.packet.data)
        payload = Buffer.from(toBinary(CDemoFullPacketSchema, full))
      } else {
        const packet = fromBinary(CDemoPacketSchema, payload)
        packet.data = compact(packet.data)
        payload = Buffer.from(toBinary(CDemoPacketSchema, packet))
      }
      records.push(
        Uint8Array.from([
          ...varint(command),
          ...varint(tick),
          ...varint(payload.length),
          ...payload,
        ]),
      )
    } else records.push(read(origin, prefixBytes + len))
  }
  records.push(Uint8Array.from([...varint(0), ...varint(endTick), 0]))
  const footerReader = new BitReader(read(footer, 15))
  footerReader.varUint()
  footerReader.varUint()
  const footerLength = footerReader.varUint() + (120 - footerReader.remaining) / 8
  container.writeUInt32LE(16 + records.reduce((sum, record) => sum + record.length, 0), 8)
  const raw = Buffer.concat([container, ...records, read(footer, footerLength)])
  writeFileSync(output, gzipSync(raw, { level: 9 }))
  console.log({
    source: path,
    rawBytes: raw.length,
    fixtureBytes: readFileSync(output).length,
    records: records.length,
  })
} finally {
  closeSync(file)
}
