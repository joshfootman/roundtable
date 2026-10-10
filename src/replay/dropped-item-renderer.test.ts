import { describe, expect, it } from 'vitest'
import { Container, Sprite, Texture, TextureSource } from 'pixi.js'
import { createDroppedItemRenderer } from './dropped-item-renderer'
import type { MapDefinition } from './maps'
import type { ReplayRound } from './types'
import { testRound } from './test-round'

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
  return testRound({
    startTick: 90,
    liveStartTick: 100,
    resultTick: 140,
    endTick: 150,
    tickInterval: 0.25,
    droppedItems: [
      { entity: 10, serial: 1, definition: 7, x: 200, y: 100, z: 0, from: 110, to: 120 },
      { entity: 10, serial: 1, definition: 7, x: 220, y: 80, z: 0, from: 120, to: 130 },
      { entity: 11, serial: 2, definition: 43, x: 180, y: 120, z: -1, from: 120, to: 140 },
    ],
    bomb: [{ tick: 90, state: { type: 'inactive' } }],
    inspection: [],
    players: [],
    ticks: new Uint32Array([90]),
    positions: new Float32Array(),
    teams: new Uint8Array(),
    pitch: new Float32Array(),
    alive: new Uint8Array(),
    health: new Int32Array(),
    yaw: new Float32Array(),
  })
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
    replay.droppedItems.push({
      entity: 12,
      serial: 1,
      definition: 999,
      x: 200,
      y: 100,
      z: 0,
      from: 120,
      to: 130,
    })
    const textureMap = textures()
    const dropped = createDroppedItemRenderer(replay, map, textureMap)
    const [dropped110, moved, utility, unsupported] = dropped.container.children as Sprite[]
    const visible = () => dropped.container.children.map((sprite) => sprite.visible)
    dropped.draw(100, 1, 'upper')
    expect(visible()).toEqual([false, false, false, false])
    dropped.draw(110, 1, 'upper')
    expect(visible()).toEqual([true, false, false, false])
    expect([dropped110!.x, dropped110!.y, dropped110!.texture]).toEqual([
      974,
      50,
      textureMap.get(7),
    ])
    dropped.draw(120, 1, 'upper')
    expect(visible()).toEqual([false, true, false, false])
    expect([moved!.x, moved!.y]).toEqual([964, 60])
    dropped.draw(120, 1, 'lower')
    expect(visible()).toEqual([false, false, true, false])
    expect([utility!.x, utility!.y, utility!.texture]).toEqual([984, 40, textureMap.get(43)])
    dropped.draw(130, 1, 'lower')
    expect(visible()).toEqual([false, false, true, false])
    dropped.draw(150, 1, 'lower')
    expect(visible()).toEqual([false, false, false, false])
    dropped.draw(110, 1, 'upper')
    expect(visible()).toEqual([true, false, false, false])
    expect(unsupported!.visible).toBe(false)
    dropped.container.destroy({ children: true })
  })

  it('preserves aspect ratio and screen size across zoom levels', () => {
    const singleMap: MapDefinition = { ...map, floors: 'single', image: '' }
    const dropped = createDroppedItemRenderer(round(), singleMap, textures())
    const scene = new Container()
    scene.addChild(dropped.container)
    const [, gun, utility] = dropped.container.children as Sprite[]
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
