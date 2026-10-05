import type { Sprite } from 'pixi.js'
import type { MapDefinition } from './maps'

/** Rotate native radar pixels into the same image space as world overlays. */
export function orientRadar(radar: Sprite, map: MapDefinition) {
  radar.width = map.imageSize
  radar.height = map.imageSize
  radar.pivot.set(radar.texture.orig.width / 2, radar.texture.orig.height / 2)
  radar.position.set(map.imageSize / 2, map.imageSize / 2)
  radar.angle = map.rotation
}
