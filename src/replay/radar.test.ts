import { expect, test } from 'vitest'
import { Sprite, Texture, TextureSource } from 'pixi.js'
import { worldToMap, type MapDefinition } from './maps'
import { orientRadar } from './radar'

test.each([0, 90, 180, 270] as const)(
  'radar pixels and world overlays share the %i degree rotation',
  (rotation) => {
    const map: MapDefinition = {
      name: 'Test',
      floors: 'single',
      image: 'radar.png',
      imageSize: 1024,
      defaultZoom: 1,
      origin: { x: 0, y: 0 },
      scale: 1,
      rotation,
    }
    const texture = new Texture({ source: new TextureSource({ width: 1024, height: 1024 }) })
    const radar = new Sprite(texture)
    orientRadar(radar, map)
    radar.updateLocalTransform()

    for (const point of [
      { x: 0, y: 0 },
      { x: 1024, y: 1024 },
      { x: 240, y: 700 },
    ]) {
      const actual = radar.localTransform.apply(point)
      const expected = worldToMap(map, point.x, -point.y)
      expect(actual.x).toBeCloseTo(expected.x)
      expect(actual.y).toBeCloseTo(expected.y)
    }

    radar.destroy()
    texture.destroy(true)
  },
)
