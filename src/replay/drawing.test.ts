import { describe, expect, it } from 'vitest'
import { strokeOutline, type DrawingPoint } from './drawing'

function width(pressure: number) {
  const points: DrawingPoint[] = Array.from({ length: 40 }, (_, index) => [index * 5, 0, pressure])
  const outline = strokeOutline({ color: '#ffffff', points, simulatePressure: false }, true)
  const heights = outline.filter((_, index) => index % 2 === 1)
  return Math.max(...heights) - Math.min(...heights)
}

describe('freehand pressure', () => {
  it('keeps light pen strokes visible with noticeable weight under firm pressure', () => {
    const light = width(0.1)
    const firm = width(0.9)
    expect(light).toBeGreaterThan(4)
    expect(firm).toBeGreaterThan(light + 5)
    expect(firm - light).toBeLessThan(10)
    expect(firm).toBeLessThan(14)
  })
})
