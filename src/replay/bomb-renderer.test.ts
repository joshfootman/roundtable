import { describe, expect, it } from 'vitest'
import { Container, Sprite, Texture } from 'pixi.js'
import { createBombRenderer } from './bomb-renderer'
import type { MapDefinition } from './maps'
import type { ReplayRound } from './types'
import { testRound } from './test-round'

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
  return testRound({
    startTick: 90,
    liveStartTick: 100,
    resultTick: 140,
    endTick: 150,
    tickInterval: 0.25,
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
    players: [
      { steamId: 'a', name: 'A' },
      { steamId: 'b', name: 'B' },
    ],
    ticks: new Uint32Array([90, 100, 110]),
    positions: new Float32Array([
      100, 200, 1, 120, 180, 1, 100, 200, 1, 140, 160, 1, 100, 200, 1, 160, 140, -1,
    ]),
    teams: new Uint8Array(6),
    pitch: new Float32Array(6),
    alive: new Uint8Array(6),
    health: new Int32Array(6),
    yaw: new Float32Array(6),
  })
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
    const scene = new Container()
    scene.addChild(bomb.container)
    bomb.draw(100, 1, 'upper')
    expect(bomb.container.visible).toBe(false)
    bomb.draw(120, 1, 'upper')
    expect([bomb.container.x, bomb.container.y, bomb.container.visible]).toEqual([984, 40, false])
    bomb.draw(129, 1, 'lower')
    expect([bomb.container.x, bomb.container.y, bomb.container.visible]).toEqual([984, 40, true])
    bomb.draw(130, 1, 'upper')
    expect([bomb.container.x, bomb.container.y, bomb.container.visible]).toEqual([974, 50, true])
    expect([icon.visible, marker.tint]).toEqual([true, appearance.armed])
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
    scene.scale.set(0.5)
    bomb.draw(134, 2, 'upper', true)
    const screenSize = marker.getBounds().width
    scene.scale.set(2)
    bomb.draw(134, 0.5, 'upper', true)
    expect(marker.getBounds().width).toBeCloseTo(screenSize)
    bomb.draw(150, 1, 'upper')
    expect(bomb.container.visible).toBe(false)
    bomb.draw(130, 1, 'upper')
    expect(bomb.container.visible).toBe(true)
    bomb.draw(130, 1, 'lower')
    expect(bomb.container.visible).toBe(false)
    scene.destroy({ children: true })
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
})
