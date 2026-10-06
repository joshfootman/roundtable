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
  it('shows drops at their recorded world positions and restores them after pickup and rewind', () => {
    const dropped = createDroppedItemRenderer(round(), map, textures())
    const [gun, utility] = dropped.container.children as Sprite[]
    dropped.draw(100, 1, 'upper')
    expect([gun!.visible, utility!.visible]).toEqual([false, false])
    dropped.draw(110, 1, 'upper')
    expect([gun!.visible, gun!.x, gun!.y, gun!.label, utility!.visible]).toEqual([
      true,
      974,
      50,
      'dropped-item-10-1',
      false,
    ])
    dropped.draw(129, 1, 'upper')
    expect([gun!.x, gun!.y]).toEqual([964, 60])
    dropped.draw(130, 1, 'upper')
    expect(dropped.container.children.every((sprite) => !sprite.visible)).toBe(true)
    dropped.draw(150, 1, 'lower')
    expect(dropped.container.children.every((sprite) => !sprite.visible)).toBe(true)
    dropped.draw(110, 1, 'upper')
    expect([gun!.visible, gun!.x, gun!.y, utility!.visible]).toEqual([true, 974, 50, false])
    dropped.container.destroy({ children: true })
  })

  it('shows only the selected floor and retains subdued opacity', () => {
    const dropped = createDroppedItemRenderer(round(), map, textures())
    const [gun, utility] = dropped.container.children as Sprite[]
    dropped.draw(120, 1, 'upper')
    expect([gun!.visible, utility!.visible, dropped.container.alpha]).toEqual([true, false, 0.55])
    dropped.draw(120, 1, 'lower')
    expect([gun!.visible, utility!.visible, utility!.x, utility!.y]).toEqual([false, true, 984, 40])
    dropped.draw(130, 1, 'lower')
    expect([gun!.visible, gun!.label, utility!.visible]).toEqual([true, 'dropped-item-11-2', false])
    dropped.container.destroy({ children: true })
  })

  it('preserves the SVG proportions and small screen-space size across resizing', () => {
    const singleMap: MapDefinition = { ...map, floors: 'single', image: '' }
    const dropped = createDroppedItemRenderer(round(), singleMap, textures())
    const scene = new Container()
    scene.addChild(dropped.container)
    const [gun, utility] = dropped.container.children as Sprite[]
    for (const scale of [0.5, 1, 2]) {
      scene.scale.set(scale)
      dropped.draw(120, 1 / scale, 'upper')
      expect(gun!.getBounds().width).toBeCloseTo(18)
      expect(gun!.getBounds().height).toBeCloseTo(4.5)
      expect(utility!.getBounds().width).toBeCloseTo(4)
      expect(utility!.getBounds().height).toBeCloseTo(10)
    }
    scene.destroy({ children: true })
  })

  it('reuses the largest snapshot pool and replaces textures when slots change items', () => {
    const textureMap = textures()
    const dropped = createDroppedItemRenderer(round(), map, textureMap)
    const slots = [...dropped.container.children]
    expect(slots).toHaveLength(2)
    for (const tick of [110, 120, 130, 150, 120, 90]) {
      dropped.draw(tick, 1, 'lower')
      expect(dropped.container.children).toEqual(slots)
    }
    dropped.draw(130, 1, 'lower')
    expect((slots[0] as Sprite).texture).toBe(textureMap.get(43))
    expect(slots[1]!.visible).toBe(false)
    dropped.container.destroy({ children: true })
  })

  it('leaves empty tracks empty and skips definitions without an available SVG', () => {
    const replay = round()
    replay.droppedItems = [{ tick: 90, items: [] }]
    const empty = createDroppedItemRenderer(replay, map, textures())
    empty.draw(150, 1, 'upper')
    expect(empty.container.children).toHaveLength(0)
    replay.droppedItems.push({
      tick: 110,
      items: [{ entity: 12, serial: 1, definition: 999, x: 200, y: 100, z: 0 }],
    })
    const unavailable = createDroppedItemRenderer(replay, map, textures())
    unavailable.draw(110, 1, 'upper')
    expect(unavailable.container.children[0]!.visible).toBe(false)
    empty.container.destroy({ children: true })
    unavailable.container.destroy({ children: true })
  })
})
