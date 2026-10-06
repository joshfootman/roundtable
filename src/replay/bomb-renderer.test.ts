import { describe, expect, it } from 'vitest'
import { Container, Graphics, Sprite, Texture } from 'pixi.js'
import { createBombRenderer } from './bomb-renderer'
import type { MapDefinition } from './maps'
import type { ReplayRound } from './types'

const appearance = { neutral: 0xeeeeee, armed: 0xf59e0b, defusing: 0x96c8fa }

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
    droppedItems: [],
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
  return createBombRenderer(
    round(),
    map,
    new Graphics().rect(-9, -9, 18, 18).fill(0xffffff),
    appearance,
  )
}

describe('recorded bomb rendering', () => {
  it('keeps the planted C4 visible, pulses from replay time and turns blue only while defusing', () => {
    const replay = round()
    replay.bomb.splice(
      4,
      0,
      {
        tick: 132,
        state: { type: 'planted', x: 200, y: 100, z: 0, defuser: { type: 'player', steamId: 'a' } },
      },
      { tick: 134, state: { type: 'planted', x: 200, y: 100, z: 0, defuser: { type: 'none' } } },
    )
    const marker = new Sprite(Texture.EMPTY)
    marker.width = marker.height = 18
    const bomb = createBombRenderer(replay, map, marker, appearance)
    const icon = bomb.container.getChildByLabel('bomb-icon')!
    bomb.draw(130, 1, 'upper')
    expect([icon.visible, marker.tint, marker.width]).toEqual([true, appearance.armed, 18])
    bomb.draw(132, 1, 'upper')
    expect([icon.visible, marker.tint]).toEqual([true, appearance.defusing])
    expect(icon.scale.x).toBeGreaterThan(1)
    const paused = [icon.scale.x, icon.alpha]
    bomb.draw(132, 1, 'upper')
    expect([icon.scale.x, icon.alpha]).toEqual(paused)
    bomb.draw(134, 1, 'upper')
    expect(marker.tint).toBe(appearance.armed)
    bomb.draw(129, 1, 'lower')
    expect([marker.tint, icon.scale.x, icon.alpha]).toEqual([appearance.neutral, 1, 1])
    bomb.draw(132, 1, 'upper', true)
    expect([marker.tint, icon.scale.x, icon.alpha]).toEqual([appearance.defusing, 1, 1])
    bomb.draw(134, 1, 'upper', true)
    expect([icon.scale.x, icon.alpha]).toEqual([1, 1])
    bomb.container.destroy({ children: true })
  })

  it('bursts at the recorded explosion position, expires and restores the planted icon on rewind', () => {
    const replay = round()
    replay.bombEvents = [{ tick: 140, type: 'exploded' }]
    const bomb = createBombRenderer(replay, map, new Sprite(Texture.EMPTY), appearance)
    const blast = bomb.container.getChildByLabel('bomb-explosion')!
    const wave = blast.getChildByLabel('bomb-shockwave')!
    const icon = bomb.container.getChildByLabel('bomb-icon')!
    bomb.draw(140, 1, 'upper')
    expect([
      bomb.container.visible,
      bomb.container.x,
      bomb.container.y,
      blast.visible,
      icon.visible,
    ]).toEqual([true, 974, 50, true, false])
    const initial = wave.scale.x
    bomb.draw(141, 1, 'upper')
    expect(wave.scale.x).toBeGreaterThan(initial)
    expect(wave.alpha).toBeLessThan(1)
    bomb.draw(141, 1, 'lower')
    expect(bomb.container.visible).toBe(false)
    bomb.draw(144, 1, 'upper')
    expect([bomb.container.visible, blast.visible]).toEqual([false, false])
    bomb.draw(139, 1, 'upper')
    expect([bomb.container.visible, blast.visible, icon.visible]).toEqual([true, false, true])
    bomb.container.destroy({ children: true })
  })

  it('uses a stationary fading explosion under reduced motion and never bursts on defuse', () => {
    const replay = round()
    replay.bombEvents = [{ tick: 140, type: 'exploded' }]
    const bomb = createBombRenderer(replay, map, new Sprite(Texture.EMPTY), appearance)
    const blast = bomb.container.getChildByLabel('bomb-explosion')!
    const wave = blast.getChildByLabel('bomb-shockwave')!
    bomb.draw(140, 1, 'upper', true)
    const size = wave.scale.x
    bomb.draw(142, 1, 'upper', true)
    expect(wave.scale.x).toBe(size)
    expect(wave.alpha).toBeLessThan(1)
    expect(blast.children.slice(1).every((child) => !child.visible)).toBe(true)
    bomb.container.destroy({ children: true })
    replay.bombEvents = [{ tick: 140, type: 'defused', player: 'a' }]
    const defused = createBombRenderer(replay, map, new Sprite(Texture.EMPTY), appearance)
    defused.draw(140, 1, 'upper')
    expect(defused.container.visible).toBe(false)
    defused.container.destroy({ children: true })
  })

  it('leaves carried objectives to the player marker', () => {
    const bomb = renderer()
    bomb.draw(109, 2, 'upper')
    expect(bomb.container.visible).toBe(false)
    bomb.draw(110, 0.5, 'lower')
    expect(bomb.container.visible).toBe(false)
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
    expect(bomb.container.visible).toBe(false)
    bomb.draw(90, 1, 'upper')
    expect(bomb.container.visible).toBe(false)
    bomb.container.destroy({ children: true })
  })

  it('keeps the supplied sprite size and screen-space dimensions across map resizing', () => {
    const marker = new Sprite(Texture.EMPTY)
    marker.anchor.set(0.5)
    marker.width = marker.height = 18
    const bomb = createBombRenderer(round(), map, marker, appearance)
    const scene = new Container()
    scene.addChild(bomb.container)
    scene.scale.set(0.5)
    bomb.draw(130, 2, 'upper')
    expect([
      marker.width,
      marker.height,
      marker.getBounds().width,
      marker.getBounds().height,
    ]).toEqual([18, 18, 18, 18])
    scene.scale.set(2)
    bomb.draw(130, 0.5, 'upper')
    expect([
      marker.width,
      marker.height,
      marker.getBounds().width,
      marker.getBounds().height,
    ]).toEqual([18, 18, 18, 18])
    scene.destroy({ children: true })
  })
})
