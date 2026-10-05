import { describe, expect, it } from 'vitest'
import { Container, Graphics, Sprite, Texture } from 'pixi.js'
import { createBombRenderer } from './bomb-renderer'
import type { MapDefinition } from './maps'
import type { ReplayRound } from './types'

const map: MapDefinition = {
  name: 'Test',
  imageSize: 1024,
  defaultZoom: 1,
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
    shots: [],
    fires: [],
    smokes: [],
    projectiles: [],
    detonations: [],
    bombEvents: [],
    bomb: [
      { tick: 90, state: { type: 'inactive' } },
      { tick: 100, state: { type: 'carried', carrier: 'b', planting: false } },
      { tick: 120, state: { type: 'dropped', x: 180, y: 120, z: -1 } },
      {
        tick: 130,
        state: { type: 'planted', x: 200, y: 100, z: 0, defuser: { type: 'none' } },
      },
      { tick: 140, state: { type: 'inactive' } },
    ],
    inspection: [],
    deaths: [],
    players: [
      { steamId: 'a', name: 'A' },
      { steamId: 'b', name: 'B' },
    ],
    ticks: new Uint32Array([90, 100, 110]),
    positions: new Float32Array([
      100, 200, 1, 120, 180, 1, 100, 200, 1, 140, 160, 1, 100, 200, 1, 160, 140, -1,
    ]),
    teams: new Uint8Array(6),
    alive: new Uint8Array(6),
    health: new Int32Array(6),
    yaw: new Float32Array(6),
  }
}

function renderer() {
  return createBombRenderer(round(), map, new Graphics().rect(-9, -9, 18, 18).fill(0xffffff))
}

describe('recorded bomb rendering', () => {
  it('follows the recorded carrier sample with calibrated rotation and a screen-sized offset', () => {
    const bomb = renderer()
    bomb.draw(109, 2, 'upper')
    expect([
      bomb.container.x,
      bomb.container.y,
      bomb.container.visible,
      bomb.container.scale.x,
      bomb.container.scale.y,
    ]).toEqual([1034, -10, true, 2, 2])
    bomb.draw(110, 0.5, 'lower')
    expect([bomb.container.x, bomb.container.y, bomb.container.visible]).toEqual([
      1001.5,
      22.5,
      true,
    ])
    bomb.container.destroy({ children: true })
  })

  it('uses dropped and planted world positions without the carried offset and respects floor boundaries', () => {
    const bomb = renderer()
    bomb.draw(120, 2, 'upper')
    expect([bomb.container.x, bomb.container.y, bomb.container.visible]).toEqual([984, 40, false])
    bomb.draw(129, 0.5, 'lower')
    expect([bomb.container.x, bomb.container.y, bomb.container.visible]).toEqual([984, 40, true])
    bomb.draw(130, 2, 'upper')
    expect([bomb.container.x, bomb.container.y, bomb.container.visible]).toEqual([974, 50, true])
    bomb.draw(130, 2, 'lower')
    expect(bomb.container.visible).toBe(false)
    bomb.container.destroy({ children: true })
  })

  it('hides inactive states and restores the appropriate state after backward seeking', () => {
    const bomb = renderer()
    bomb.draw(90, 1, 'upper')
    expect(bomb.container.visible).toBe(false)
    bomb.draw(130, 1, 'upper')
    expect([bomb.container.x, bomb.container.y, bomb.container.visible]).toEqual([974, 50, true])
    bomb.draw(150, 1, 'upper')
    expect(bomb.container.visible).toBe(false)
    bomb.draw(100, 1, 'upper')
    expect([bomb.container.x, bomb.container.y, bomb.container.visible]).toEqual([1019, 5, true])
    bomb.draw(90, 1, 'upper')
    expect(bomb.container.visible).toBe(false)
    bomb.container.destroy({ children: true })
  })

  it('keeps the supplied sprite size and screen-space dimensions across map resizing', () => {
    const marker = new Sprite(Texture.EMPTY)
    marker.anchor.set(0.5)
    marker.width = marker.height = 18
    const bomb = createBombRenderer(round(), map, marker)
    const scene = new Container()
    scene.addChild(bomb.container)
    scene.scale.set(0.5)
    bomb.draw(100, 2, 'upper')
    expect([
      marker.width,
      marker.height,
      marker.getBounds().width,
      marker.getBounds().height,
    ]).toEqual([18, 18, 18, 18])
    scene.scale.set(2)
    bomb.draw(100, 0.5, 'upper')
    expect([
      marker.width,
      marker.height,
      marker.getBounds().width,
      marker.getBounds().height,
    ]).toEqual([18, 18, 18, 18])
    scene.destroy({ children: true })
  })
})
