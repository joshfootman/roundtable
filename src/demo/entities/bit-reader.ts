export class BitReader {
  private offset = 0
  private floatView?: DataView
  constructor(private readonly data: Uint8Array) {}
  get remaining() {
    return this.data.length * 8 - this.offset
  }
  bits(count: number): number {
    if (count < 0 || count > 32 || count > this.remaining)
      throw new Error('The demo contains truncated entity data.')
    const data = this.data
    let offset = this.offset
    let value = 0
    let shift = 0
    while (shift < count) {
      const bit = offset & 7
      const take = Math.min(count - shift, 8 - bit)
      value |= ((data[offset >> 3]! >> bit) & ((1 << take) - 1)) << shift
      offset += take
      shift += take
    }
    this.offset = offset
    return value >>> 0
  }
  boolean() {
    const offset = this.offset
    if (offset >= this.data.length * 8) throw new Error('The demo contains truncated entity data.')
    this.offset = offset + 1
    return ((this.data[offset >> 3]! >> (offset & 7)) & 1) === 1
  }
  skipBytes(count: number) {
    if (count * 8 > this.remaining) throw new Error('The demo contains truncated network data.')
    this.offset += count * 8
  }
  bytes(count: number): Uint8Array {
    if (count * 8 > this.remaining) throw new Error('The demo contains truncated entity bytes.')
    if (!(this.offset & 7)) {
      const start = this.offset >> 3
      this.offset += count * 8
      return this.data.subarray(start, start + count)
    }
    const data = new Uint8Array(count)
    const source = this.data
    const shift = this.offset & 7
    let byte = this.offset >> 3
    for (let index = 0; index < count; index++, byte++)
      data[index] = ((source[byte]! >> shift) | (source[byte + 1]! << (8 - shift))) & 0xff
    this.offset += count * 8
    return data
  }
  varUint(): number {
    let value = 0
    for (let i = 0; i < 5; i++) {
      const byte = this.bits(8)
      value += (byte & 127) * 2 ** (i * 7)
      if (byte < 128) {
        if (value > 0xffffffff) throw new Error('Entity integer overflows uint32.')
        return value
      }
    }
    throw new Error('The demo contains an invalid entity integer.')
  }
  varInt() {
    const value = this.varUint()
    return value & 1 ? -(Math.floor(value / 2) + 1) : value / 2
  }
  varUint64(): bigint {
    let value = 0n
    for (let i = 0; i < 10; i++) {
      const byte = this.bits(8)
      if (i === 9 && byte > 1) throw new Error('Entity integer overflows uint64.')
      value |= BigInt(byte & 127) << BigInt(i * 7)
      if (byte < 128) return value
    }
    throw new Error('The demo contains an invalid 64-bit entity integer.')
  }
  uBitVar() {
    const value = this.bits(6)
    const extra = [0, 4, 8, 28][value >> 4]!
    return extra ? (value & 15) + this.bits(extra) * 16 : value
  }
  fieldVar() {
    for (const bits of [2, 4, 10, 17]) if (this.boolean()) return this.bits(bits)
    return this.bits(31)
  }
  float() {
    if (this.remaining < 32) throw new Error('The demo contains truncated entity bytes.')
    const view = (this.floatView ??= new DataView(new ArrayBuffer(4)))
    view.setUint32(0, this.bits(32), true)
    return view.getFloat32(0, true)
  }
  fixed64() {
    const data = this.bytes(8)
    return new DataView(data.buffer, data.byteOffset, 8).getBigUint64(0, true)
  }
  string() {
    const bytes: number[] = []
    for (;;) {
      const byte = this.bits(8)
      if (!byte) return new TextDecoder().decode(Uint8Array.from(bytes))
      bytes.push(byte)
    }
  }
  coord() {
    const integral = this.boolean()
    const fractional = this.boolean()
    if (!integral && !fractional) return 0
    const negative = this.boolean()
    const value = (integral ? this.bits(14) + 1 : 0) + (fractional ? this.bits(5) / 32 : 0)
    return negative ? -value : value
  }
  angle(count: number) {
    return (this.bits(count) * 360) / 2 ** count
  }
  normal() {
    const negative = this.boolean()
    const value = this.bits(11) / 2047
    return negative ? -value : value
  }
  normalVector() {
    const x = this.boolean()
    const y = this.boolean()
    const vx = x ? this.normal() : 0
    const vy = y ? this.normal() : 0
    const negative = this.boolean()
    const z = Math.sqrt(Math.max(0, 1 - vx * vx - vy * vy))
    return [vx, vy, negative ? -z : z]
  }
}
