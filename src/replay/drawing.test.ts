import { describe, expect, it } from 'vitest'
import { strokeOutline, type DrawingPoint } from './drawing'

function width(pressure: number) {
  const points: DrawingPoint[] = Array.from({ length: 40 }, (_, index) => [index * 5, 0, pressure])
  const outline = strokeOutline({ color: '#ffffff', points, simulatePressure: false }, true)
  const heights = outline.filter((_, index) => index % 2 === 1)
  return Math.max(...heights) - Math.min(...heights)
}

describe('freehand pressure', () => {
  it('keeps light and firm pen strokes visible with subtle width variation', () => {
    const light = width(0.1)
    const firm = width(0.9)
    expect(light).toBeGreaterThan(4)
    expect(firm).toBeGreaterThan(light + 0.5)
    expect(firm - light).toBeLessThan(4.5)
    expect(firm).toBeLessThan(10)
  })

  it('gives mouse strokes a visible width difference between slow and fast movement', () => {
    function width(step: number) {
      const points: DrawingPoint[] = Array.from({ length: 70 }, (_, index) => [
        index * step,
        0,
        0.5,
      ])
      const outline = strokeOutline({ color: '#ffffff', points, simulatePressure: true }, true)
      const heights = outline.filter((_, index) => index % 2 === 1)
      return Math.max(...heights) - Math.min(...heights)
    }
    expect(width(1)).toBeGreaterThan(width(10) + 3)
    expect(width(10)).toBeGreaterThan(4)
  })
})
