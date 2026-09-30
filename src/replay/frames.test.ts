import { describe, expect, it } from 'vitest'
import { sampleAtTick } from './frames'
import { worldToMap, type MapDefinition } from './maps'

describe('recorded replay samples', () => {
  it('holds the preceding recorded sample through gaps and at the round boundaries', () => {
    const ticks = new Uint32Array([100, 104, 110])
    expect([90, 100, 103, 104, 109, 110, 120].map((tick) => sampleAtTick(ticks, tick))).toEqual([
      0, 0, 0, 1, 1, 2, 2,
    ])
  })
  it('projects world coordinates using the selected map calibration and image orientation', () => {
    const map: MapDefinition = {
      name: 'Test map',
      image: 'radar.png',
      imageSize: 1024,
      origin: { x: -1000, y: 2000 },
      scale: 5,
    }
    expect(worldToMap(map, -1000, 2000)).toEqual({ x: 0, y: 0 })
    expect(worldToMap(map, 1500, -500)).toEqual({ x: 500, y: 500 })
    expect(worldToMap({ ...map, scale: 10 }, 1500, -500)).toEqual({ x: 250, y: 250 })
  })
})
