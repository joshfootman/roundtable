export class BitReader {
  private offset = 0
  constructor(private readonly data: Uint8Array) {}
  get remaining() {
    return this.data.length * 8 - this.offset
  }
  bits(count: number): number {
    if (count < 0 || count > 32 || count > this.remaining)
      throw new Error('The demo contains truncated entity data.')
    let value = 0
    let shift = 0
    while (count > 0) {
      const available = Math.min(count, 8 - (this.offset & 7))
      value +=
        ((this.data[this.offset >> 3]! >> (this.offset & 7)) & (2 ** available - 1)) * 2 ** shift
      this.offset += available
      shift += available
      count -= available
    }
    return value
  }
  boolean() {
    return this.bits(1) === 1
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
    return Uint8Array.from({ length: count }, () => this.bits(8))
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
    const data = this.bytes(4)
    return new DataView(data.buffer, data.byteOffset, 4).getFloat32(0, true)
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
