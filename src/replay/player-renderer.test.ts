import { describe, expect, it } from 'vitest'
import { Container, Graphics, Text } from 'pixi.js'
import { createPlayerRenderer } from './player-renderer'
import type { MapDefinition } from './maps'
import type { PlayerInspection, ReplayRound } from './types'

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
const appearance = {
  ct: 0x96c8fa,
  t: 0xeabe54,
  foreground: 0xeeeeee,
  background: 0x222222,
  fontSize: 16,
}

function round(): ReplayRound {
  const inspection: PlayerInspection = {
    tick: 100,
    money: 0,
    armour: 0,
    flash: { type: 'flashed', startTick: 100, durationSeconds: 2 },
    helmet: false,
    grenades: [],
    weapon: { type: 'none' },
    weapons: [],
  }
  return {
    number: 1,
    overtime: 0,
    startTick: 90,
    liveStartTick: 100,
    resultTick: 110,
    endTick: 120,
    tickInterval: 0.25,
    shots: [],
    fires: [],
    smokes: [],
    projectiles: [],
    detonations: [],
    bombEvents: [],
    bomb: [],
    inspection: [[inspection], [{ ...inspection, flash: { type: 'none' } }], [inspection]],
    deaths: [],
    players: [
      { steamId: 'a', name: 'A' },
      { steamId: 'b', name: 'B' },
      { steamId: 'observer', name: 'Observer' },
    ],
    ticks: new Uint32Array([90, 100, 110]),
    positions: new Float32Array([
      100, 200, 1, 100, 200, -1, 100, 200, 1, 120, 180, 1, 140, 160, -1, 100, 200, 1, 160, 140, -1,
      180, 120, 1, 100, 200, 1,
    ]),
    teams: new Uint8Array([2, 3, 1, 3, 2, 1, 3, 2, 1]),
    alive: new Uint8Array([1, 1, 1, 1, 1, 1, 0, 1, 1]),
    health: new Int32Array(9),
    yaw: new Float32Array([0, 0, 0, 90, 180, 0, 180, 270, 0]),
  }
}

function marker(renderer: ReturnType<typeof createPlayerRenderer>, index: number) {
  const container = renderer.container.children[index] as Container
  return {
    container,
    body: container.children[0] as Graphics,
    direction: container.children[1] as Graphics,
    flash: container.children[2] as Graphics,
    label: container.children[3] as Text,
  }
}

describe('recorded player rendering', () => {
  it('calibrates the preceding sample and facing while keeping live-start numbers and screen scaling', () => {
    const renderer = createPlayerRenderer(round(), map, appearance)
    renderer.draw(109, 2, { floor: 'upper', flashes: true })
    const a = marker(renderer, 0)
    const b = marker(renderer, 1)
    expect([a.container.x, a.container.y, a.direction.rotation]).toEqual([1014, 10, 0])
    expect([a.container.scale.x, a.container.scale.y, a.body.tint]).toEqual([2, 2, 0x96c8fa])
    expect([a.label.text, b.label.text, a.label.style.fontSize]).toEqual(['1', '6', 16])
    expect([
      a.container.visible,
      b.container.visible,
      marker(renderer, 2).container.visible,
    ]).toEqual([true, false, false])
    renderer.draw(90, 0.5, { floor: 'upper', flashes: true })
    expect([a.container.x, a.container.y, a.label.text, a.body.tint, a.container.scale.x]).toEqual([
      1024,
      0,
      '1',
      0xeabe54,
      0.5,
    ])
    renderer.container.destroy({ children: true })
  })

  it('updates death and flash expiry without retaining later states after a backward seek', () => {
    const renderer = createPlayerRenderer(round(), map, appearance)
    const a = marker(renderer, 0)
    renderer.draw(100, 1, { floor: 'upper', flashes: true })
    expect([a.container.alpha, a.flash.visible]).toEqual([1, true])
    renderer.draw(108, 1, { floor: 'upper', flashes: true })
    expect([a.container.alpha, a.flash.visible]).toEqual([1, false])
    renderer.draw(110, 1, { floor: 'lower', flashes: true })
    expect([a.container.alpha, a.flash.visible, a.container.visible, a.direction.rotation]).toEqual(
      [0.35, false, true, -Math.PI / 2],
    )
    renderer.draw(100, 1, { floor: 'upper', flashes: true })
    expect([a.container.alpha, a.flash.visible, a.container.visible]).toEqual([1, true, true])
    renderer.draw(100, 1, { floor: 'upper', flashes: false })
    expect([a.container.alpha, a.flash.visible]).toEqual([1, false])
    renderer.container.destroy({ children: true })
  })

  it('combines player, team and floor visibility and restores markers when filters clear', () => {
    const renderer = createPlayerRenderer(round(), map, appearance)
    const a = marker(renderer, 0)
    const b = marker(renderer, 1)
    renderer.draw(100, 1, { floor: 'lower', flashes: true })
    expect([a.container.visible, b.container.visible]).toEqual([false, true])
    renderer.draw(100, 1, { floor: 'upper', flashes: true, hiddenPlayers: new Set(['a']) })
    expect([a.container.visible, b.container.visible]).toEqual([false, false])
    renderer.draw(100, 1, { floor: 'upper', flashes: true, hiddenTeams: new Set([3]) })
    expect([a.container.visible, b.container.visible]).toEqual([false, false])
    renderer.draw(100, 1, { floor: 'upper', flashes: true })
    expect([a.container.visible, b.container.visible]).toEqual([true, false])
    renderer.container.destroy({ children: true })
  })
})
