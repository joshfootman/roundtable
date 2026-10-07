import { getStroke } from 'perfect-freehand'
import type { MapFloor } from './maps'

export type DrawingColor = string
export type DrawingPoint = [x: number, y: number, pressure: number]
export type DrawingStroke = {
  color: DrawingColor
  points: DrawingPoint[]
  simulatePressure: boolean
}
export type FloorDrawings = Record<MapFloor, readonly DrawingStroke[]>
export type RoundDrawings = Record<number, FloorDrawings>
export const emptyFloorDrawings: FloorDrawings = { upper: [], lower: [] }
export type DrawingConfiguration = {
  scope: string
  enabled: boolean
  color: DrawingColor
  strokes: readonly DrawingStroke[]
  onStroke(stroke: DrawingStroke): void
}

export function strokeOutline(stroke: DrawingStroke, complete: boolean) {
  return getStroke(stroke.points, {
    size: 7,
    thinning: 0.35,
    smoothing: 0.6,
    streamline: 0.5,
    simulatePressure: stroke.simulatePressure,
    last: complete,
  }).flat()
}
