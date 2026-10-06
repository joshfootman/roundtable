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
for (const name of mapNames) {
  for (const dimensions of viewports) {
    for (const zoom of [1, 1.25, 2, 4]) {
      it(`${name} bounds both axes at ${dimensions.width}x${dimensions.height}, ${zoom}x`, () => {
        const map = mapDefinition(name)!
        const viewport = { ...dimensions, imageSize: map.imageSize, defaultZoom: map.defaultZoom }
        const initial = { ...focusedCamera(map.focusCenter), zoom }
        const padding = Math.min(dimensions.width, dimensions.height) * 0.1
        const size = Math.min(dimensions.width, dimensions.height) * map.defaultZoom * zoom
        const positive = cameraTransform(
          panCamera(initial, viewport, { x: 100000, y: 100000 }),
          viewport,
        )
        const negative = cameraTransform(
          panCamera(initial, viewport, { x: -100000, y: -100000 }),
          viewport,
        )
        expect(positive.x).toBeCloseTo(Math.max(0, dimensions.width - size) + padding)
        expect(negative.x).toBeCloseTo(Math.min(0, dimensions.width - size) - padding)
        expect(positive.y).toBeCloseTo(Math.max(0, dimensions.height - size) + padding)
        expect(negative.y).toBeCloseTo(Math.min(0, dimensions.height - size) - padding)
        if (zoom === 1 && dimensions.width > size) {
          expect(positive.x).toBeGreaterThan(negative.x)
        }
      })
    }
  }
}

for (const name of mapNames) {
  for (const dimensions of viewports) {
    it(`${name} can pan in every direction immediately at ${dimensions.width}x${dimensions.height}`, () => {
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
        expect(after.x - before.x).toBeCloseTo(delta.x)
        expect(after.y - before.y).toBeCloseTo(delta.y)
      }
    })
  }
}
