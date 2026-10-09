import { describe, expect, it } from 'vitest'
import { Container, Sprite, Texture, TextureSource } from 'pixi.js'
import { createDroppedItemRenderer } from './dropped-item-renderer'
import type { MapDefinition } from './maps'
import type { ReplayRound } from './types'

const map: MapDefinition = {
  name: 'Test',
  imageSize: 1024,
  defaultZoom: 1,
  focusCenter: { x: 0.5, y: 0.5 },
  origin: { x: 100, y: 200 },
  scale: 2,
  rotation: 90,
  floors: 'split',
  images: { upper: '', lower: '' },
  boundaryZ: 0,
  initialFloor: 'upper',
}

function round(): ReplayRound {
  return {
    number: 1,
    overtime: 0,
    startTick: 90,
    liveStartTick: 100,
    resultTick: 140,
    endTick: 150,
    tickInterval: 0.25,
    droppedItems: [
      { tick: 90, items: [] },
      { tick: 110, items: [{ entity: 10, serial: 1, definition: 7, x: 200, y: 100, z: 0 }] },
      {
        tick: 120,
        items: [
          { entity: 10, serial: 1, definition: 7, x: 220, y: 80, z: 0 },
          { entity: 11, serial: 2, definition: 43, x: 180, y: 120, z: -1 },
        ],
      },
      { tick: 130, items: [{ entity: 11, serial: 2, definition: 43, x: 180, y: 120, z: -1 }] },
      { tick: 140, items: [] },
    ],
    shots: [],
    fires: [],
    smokes: [],
    projectiles: [],
    detonations: [],
    bombEvents: [],
    bomb: [{ tick: 90, state: { type: 'inactive' } }],
    inspection: [],
    deaths: [],
    players: [],
    ticks: new Uint32Array([90]),
    positions: new Float32Array(),
    teams: new Uint8Array(),
    present: new Uint8Array().fill(1),
    pitch: new Float32Array(),
    damage: [],
    alive: new Uint8Array(),
    health: new Int32Array(),
    yaw: new Float32Array(),
  }
}

function textures() {
  return new Map([
    [7, new Texture({ source: new TextureSource({ width: 100, height: 25 }) })],
    [43, new Texture({ source: new TextureSource({ width: 20, height: 50 }) })],
  ])
}

describe('dropped equipment rendering', () => {
  it('renders drop, pickup, floor and rewind transitions with the correct item texture', () => {
    const replay = round()
    replay.droppedItems[2]!.items.push({
      entity: 12,
      serial: 1,
      definition: 999,
      x: 200,
      y: 100,
      z: 0,
    })
    const textureMap = textures()
    const dropped = createDroppedItemRenderer(replay, map, textureMap)
    const [gun, utility, unsupported] = dropped.container.children as Sprite[]
    dropped.draw(100, 1, 'upper')
    expect(dropped.container.children.every((sprite) => !sprite.visible)).toBe(true)
    dropped.draw(110, 1, 'upper')
    expect([gun!.visible, gun!.x, gun!.y, gun!.texture, utility!.visible]).toEqual([
      true,
      974,
      50,
      textureMap.get(7),
      false,
    ])
    dropped.draw(120, 1, 'upper')
    expect([gun!.visible, gun!.x, gun!.y, utility!.visible, unsupported!.visible]).toEqual([
      true,
      964,
      60,
      false,
      false,
    ])
    dropped.draw(120, 1, 'lower')
    expect([gun!.visible, utility!.visible, utility!.x, utility!.y]).toEqual([false, true, 984, 40])
    dropped.draw(130, 1, 'lower')
    expect([gun!.visible, gun!.texture, utility!.visible]).toEqual([
      true,
      textureMap.get(43),
      false,
    ])
    dropped.draw(150, 1, 'lower')
    expect(dropped.container.children.every((sprite) => !sprite.visible)).toBe(true)
    dropped.draw(110, 1, 'upper')
    expect([gun!.visible, gun!.x, gun!.y, gun!.texture, utility!.visible]).toEqual([
      true,
      974,
      50,
      textureMap.get(7),
      false,
    ])
    dropped.container.destroy({ children: true })
  })

  it('preserves aspect ratio and screen size across zoom levels', () => {
    const singleMap: MapDefinition = { ...map, floors: 'single', image: '' }
    const dropped = createDroppedItemRenderer(round(), singleMap, textures())
    const scene = new Container()
    scene.addChild(dropped.container)
    const [gun, utility] = dropped.container.children as Sprite[]
    dropped.draw(120, 1, 'upper')
    const gunSize = gun!.getBounds().width
    const utilitySize = utility!.getBounds().height
    expect(gunSize).toBeGreaterThan(0)
    expect(utilitySize).toBeGreaterThan(0)
    for (const scale of [0.5, 2]) {
      scene.scale.set(scale)
      dropped.draw(120, 1 / scale, 'upper')
      const gunBounds = gun!.getBounds()
      const utilityBounds = utility!.getBounds()
      expect(gunBounds.width).toBeCloseTo(gunSize)
      expect(gunBounds.width / gunBounds.height).toBeCloseTo(4)
      expect(utilityBounds.height).toBeCloseTo(utilitySize)
      expect(utilityBounds.width / utilityBounds.height).toBeCloseTo(0.4)
    }
    scene.destroy({ children: true })
  })
})
