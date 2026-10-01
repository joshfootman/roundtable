import { describe, expect, it } from 'vitest'
import { sampleAtTick } from './frames'

describe('recorded replay samples', () => {
  it('holds the preceding recorded sample through gaps and at the round boundaries', () => {
    const ticks = new Uint32Array([100, 104, 110])
    expect([90, 100, 103, 104, 109, 110, 120].map((tick) => sampleAtTick(ticks, tick))).toEqual([
      0, 0, 0, 1, 1, 2, 2,
    ])
  })
})
