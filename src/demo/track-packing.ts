/**
 * Compact storage for slowly changing numeric tracks. Values are rounded to fixed point,
 * differenced along time for each (player, component), zigzag encoded, and written as four
 * byte planes. Consecutive samples differ by little, so most planes are runs of zeros that
 * gzip removes almost entirely.
 */
export interface Packing {
  /** Fixed-point steps per unit; decoded values are within half a step of the input. */
  scale: number
  /** Period in units for angles, so a turn across ±180° stays a small step. */
  period?: number
}

/** Track laid out sample-major: `(sample * players + player) * width + component`. */
interface Shape {
  samples: number
  players: number
  width: number
}

export function packTrack(values: ArrayLike<number>, shape: Shape, packing: Packing): Uint8Array {
  const { samples, players, width } = shape
  const count = samples * players * width
  if (values.length !== count) throw new Error('A packed track has the wrong length.')
  const period = packing.period === undefined ? 0 : Math.round(packing.period * packing.scale)
  const planes = new Uint8Array(count * 4)
  let index = 0
  for (let player = 0; player < players; player++)
    for (let component = 0; component < width; component++) {
      let previous = 0
      for (let sample = 0; sample < samples; sample++) {
        const value = Math.round(
          values[(sample * players + player) * width + component]! * packing.scale,
        )
        let delta = value - previous
        if (period) delta = wrap(delta, period)
        previous = value
        const zigzag = ((delta << 1) ^ (delta >> 31)) >>> 0
        planes[index] = zigzag & 0xff
        planes[count + index] = (zigzag >>> 8) & 0xff
        planes[2 * count + index] = (zigzag >>> 16) & 0xff
        planes[3 * count + index] = zigzag >>> 24
        index++
      }
    }
  return planes
}

/** Values back in sample-major order and real units, written into `into`. */
export function unpackTrack<T extends Float32Array | Uint32Array>(
  planes: Uint8Array,
  shape: Shape,
  packing: Packing,
  into: T,
): T {
  const { samples, players, width } = shape
  const count = samples * players * width
  if (planes.length !== count * 4 || into.length !== count)
    throw new Error('A packed track has the wrong length.')
  const period = packing.period === undefined ? 0 : Math.round(packing.period * packing.scale)
  const step = 1 / packing.scale
  let index = 0
  for (let player = 0; player < players; player++)
    for (let component = 0; component < width; component++) {
      let value = 0
      for (let sample = 0; sample < samples; sample++) {
        const zigzag =
          (planes[index]! |
            (planes[count + index]! << 8) |
            (planes[2 * count + index]! << 16) |
            (planes[3 * count + index]! << 24)) >>>
          0
        value += (zigzag >>> 1) ^ -(zigzag & 1)
        if (period) value = wrap(value, period)
        into[(sample * players + player) * width + component] = value * step
        index++
      }
    }
  return into
}

/** The equivalent value in [-period / 2, period / 2). */
function wrap(value: number, period: number) {
  return ((((value + period / 2) % period) + period) % period) - period / 2
}
