import { Container } from 'pixi.js'
import { bombPosition, recordAtTick, sampleAtTick } from './frames'
import { visibleOnFloor, worldToMap, type MapDefinition, type MapFloor } from './maps'
import type { ReplayRound } from './types'

export function createBombRenderer(round: ReplayRound, map: MapDefinition, marker: Container) {
  const container = new Container()
  container.addChild(marker)

  function draw(tick: number, symbolScale: number, floor: MapFloor) {
    const bomb = recordAtTick(round.bomb, tick).state
    const position = bombPosition(round, bomb, sampleAtTick(round.ticks, tick))
    container.scale.set(symbolScale)
    container.visible = position !== undefined && visibleOnFloor(map, floor, position.z)
    if (!position) return
    const point = worldToMap(map, position.x, position.y)
    const offset = bomb.type === 'carried' ? 15 * symbolScale : 0
    container.position.set(point.x + offset, point.y - offset)
  }

  return { container, draw }
}
