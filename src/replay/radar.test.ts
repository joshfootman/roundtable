import { expect, test } from 'vitest'
import { Sprite, Texture, TextureSource } from 'pixi.js'
import { type MapDefinition } from './maps'
import { orientRadar } from './radar'

test('rotates radar pixels around the map centre at every supported orientation', () => {
  for (const [rotation, expectedPoints] of [
    [
      0,
      [
        [0, 0],
        [1024, 1024],
        [240, 700],
      ],
    ],
    [
      90,
      [
        [1024, 0],
        [0, 1024],
        [324, 240],
      ],
    ],
    [
      180,
      [
        [1024, 1024],
        [0, 0],
        [784, 324],
      ],
    ],
    [
      270,
      [
        [0, 1024],
        [1024, 0],
        [700, 784],
      ],
    ],
  ] as const) {
    const map: MapDefinition = {
      name: 'Test',
      floors: 'single',
      image: 'radar.png',
      imageSize: 1024,
      defaultZoom: 1,
      focusCenter: { x: 0.5, y: 0.5 },
      origin: { x: 0, y: 0 },
      scale: 1,
      rotation,
    }
    const texture = new Texture({ source: new TextureSource({ width: 1024, height: 1024 }) })
    const radar = new Sprite(texture)
    orientRadar(radar, map)
    radar.updateLocalTransform()

    const points = [
      { x: 0, y: 0 },
      { x: 1024, y: 1024 },
      { x: 240, y: 700 },
    ]
    for (let index = 0; index < points.length; index++) {
      const actual = radar.localTransform.apply(points[index]!)
      const expected = expectedPoints[index]!
      expect(actual.x).toBeCloseTo(expected[0])
      expect(actual.y).toBeCloseTo(expected[1])
    }

    radar.destroy()
    texture.destroy(true)
  }
})
