import { Container, Sprite, type Texture } from 'pixi.js'
import { firearms } from './equipment'
import { recordAtTick } from './frames'
import { visibleOnFloor, worldToMap, type MapDefinition, type MapFloor } from './maps'
import type { ReplayRound } from './types'

export function createDroppedItemRenderer(
  round: ReplayRound,
  map: MapDefinition,
  textures: ReadonlyMap<number, Texture>,
) {
  const container = new Container({ label: 'dropped-items' })
  container.alpha = 0.55
  const capacity = round.droppedItems.reduce(
    (maximum, { items }) => Math.max(maximum, items.length),
    0,
  )
  const sprites = Array.from({ length: capacity }, () => {
    const sprite = new Sprite()
    sprite.anchor.set(0.5)
    sprite.visible = false
    container.addChild(sprite)
    return sprite
  })

  function draw(tick: number, symbolScale: number, floor: MapFloor) {
    const { items } = recordAtTick(round.droppedItems, tick)
    for (let index = 0; index < sprites.length; index++) {
      const sprite = sprites[index]!
      const item = items[index]
      const texture = item && textures.get(item.definition)
      sprite.visible = Boolean(item && texture && visibleOnFloor(map, floor, item.z))
      if (!item || !texture || !sprite.visible) continue
      sprite.label = `dropped-item-${item.entity}-${item.serial}`
      sprite.texture = texture
      const point = worldToMap(map, item.x, item.y)
      sprite.position.set(point.x, point.y)
      const firearm = item.definition in firearms
      const fit = Math.min((firearm ? 18 : 10) / texture.width, (firearm ? 8 : 10) / texture.height)
      sprite.scale.set(fit * symbolScale)
    }
  }

  return { container, draw }
}
