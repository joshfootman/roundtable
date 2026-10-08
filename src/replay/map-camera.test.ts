import { describe, expect, it } from 'vitest'
import { examples } from '../demo/examples'
import { mapDefinition } from './maps'
import {
  cameraTransform,
  constrainCamera,
  focusedCamera,
  panCamera,
  zoomCamera,
} from './map-camera'

const square = { width: 800, height: 800, imageSize: 1000, defaultZoom: 1 }
describe('map camera', () => {
  it('opens slightly zoomed out and allows further zooming out', () => {
    expect(cameraTransform(focusedCamera(), square)).toEqual({ x: 40, y: 40, scale: 0.72 })
    expect(zoomCamera(focusedCamera(), square, 0.01, { x: 400, y: 400 }).zoom).toBe(0.6)
    expect(zoomCamera(focusedCamera(), square, 100, { x: 400, y: 400 }).zoom).toBe(4)
  })
  it('keeps the map point under the wheel cursor during zoom', () => {
    const before = focusedCamera()
    const anchor = { x: 600, y: 200 }
    const old = cameraTransform(before, square)
    const next = cameraTransform(zoomCamera(before, square, 2, anchor), square)
    expect((anchor.x - next.x) / next.scale).toBeCloseTo((anchor.x - old.x) / old.scale)
    expect((anchor.y - next.y) / next.scale).toBeCloseTo((anchor.y - old.y) / old.scale)
  })
  it('preserves drag distance inside the bounds and clamps after resize', () => {
    expect(panCamera({ zoom: 2, center: { x: 0.5, y: 0.5 } }, square, { x: 160, y: -80 })).toEqual({
      zoom: 2,
      center: { x: 0.4, y: 0.55 },
    })
    const resized = constrainCamera(
      { zoom: 2, center: { x: 0.1, y: 0.9 } },
      { ...square, width: 1200 },
    )
    expect(cameraTransform(resized, { ...square, width: 1200 })).toEqual({
      x: 80,
      y: -880,
      scale: 1.6,
    })
  })
})

const mapNames = [...new Set(Object.values(examples).map((example) => example.map))]
const viewports = [
  { width: 1440, height: 800 },
  { width: 800, height: 800 },
  { width: 390, height: 600 },
]
it('clamps extreme drags for small, large, wide and tall map views', () => {
  for (const [viewport, zoom, positive, negative] of [
    [{ width: 800, height: 800, imageSize: 1000, defaultZoom: 1 }, 0.6, [400, 400], [-80, -80]],
    [{ width: 800, height: 800, imageSize: 1000, defaultZoom: 1 }, 4, [80, 80], [-2480, -2480]],
    [{ width: 1440, height: 800, imageSize: 1024, defaultZoom: 1 }, 1, [720, 80], [-80, -80]],
    [{ width: 390, height: 600, imageSize: 1024, defaultZoom: 1 }, 1, [39, 249], [-39, -39]],
    [{ width: 800, height: 800, imageSize: 1024, defaultZoom: 1.25 }, 2, [80, 80], [-1280, -1280]],
  ] as const) {
    const initial = { ...focusedCamera(), zoom }
    for (const [distance, expected] of [
      [100000, positive],
      [-100000, negative],
    ] as const) {
      const actual = cameraTransform(
        panCamera(initial, viewport, { x: distance, y: distance }),
        viewport,
      )
      expect(actual.x).toBeCloseTo(expected[0])
      expect(actual.y).toBeCloseTo(expected[1])
    }
  }
})

it('allows opening movement in all four directions on every map and viewport', () => {
  for (const name of mapNames) {
    for (const dimensions of viewports) {
      const map = mapDefinition(name)!
      const viewport = { ...dimensions, imageSize: map.imageSize, defaultZoom: map.defaultZoom }
      const initial = constrainCamera(focusedCamera(map.focusCenter), viewport)
      const before = cameraTransform(initial, viewport)
      for (const delta of [
        { x: 24, y: 0 },
        { x: -24, y: 0 },
        { x: 0, y: 24 },
        { x: 0, y: -24 },
      ]) {
        const after = cameraTransform(panCamera(initial, viewport, delta), viewport)
        expect(
          after.x - before.x,
          `${name} ${dimensions.width}x${dimensions.height} x`,
        ).toBeCloseTo(delta.x)
        expect(
          after.y - before.y,
          `${name} ${dimensions.width}x${dimensions.height} y`,
        ).toBeCloseTo(delta.y)
      }
    }
  }
})
