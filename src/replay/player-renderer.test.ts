import { describe, expect, it } from 'vitest'
import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
import {
  createMarker,
  createPlayerRenderer,
  markerState,
  type MarkerState,
} from './player-renderer'
import type { MapDefinition } from './maps'
import type { ScenePlayer } from './scene'
import type { PlayerInspection, ReplayRound } from './types'
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
const textures = { bomb: Texture.EMPTY, defuse: Texture.WHITE, flashed: Texture.WHITE }
const appearance = {
  ct: 0x96c8fa,
  t: 0xeabe54,
  foreground: 0xeeeeee,
  background: 0x222222,
  fontSize: 16,
  armed: 0xf59e0b,
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
  return testRound({
    startTick: 90,
    liveStartTick: 100,
    resultTick: 110,
    endTick: 120,
    tickInterval: 0.25,
    bomb: [],
    inspection: [[inspection], [{ ...inspection, flash: { type: 'none' } }], [inspection]],
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
    pitch: new Float32Array(9),
    alive: new Uint8Array([1, 1, 1, 1, 1, 1, 0, 1, 1]),
    health: new Int32Array(9),
    yaw: new Float32Array([0, 0, 0, 90, 180, 0, 180, 270, 0]),
  })
}

function marker(renderer: ReturnType<typeof createPlayerRenderer>, index: number) {
  return markerParts(renderer.container.children[index] as Container)
}

function markerParts(container: Container) {
  return {
    container,
    body: container.getChildByLabel('body') as Graphics,
    direction: container.getChildByLabel('direction') as Graphics,
    flash: container.getChildByLabel('flash') as Container,
    label: container.getChildByLabel('label') as Text,
    elevation: container.getChildByLabel('elevation') as Graphics,
    objective: container.getChildByLabel('objective') as Sprite,
    ladder: container.getChildByLabel('ladder') as Graphics,
    cross: container.getChildByLabel('cross') as Graphics,
    name: container.getChildByLabel('name') as Text,
  }
}

describe('recorded player rendering', () => {
  it('restores overlapping player draw order after deaths and backward seeking', () => {
    const replay = round()
    for (let offset = 2; offset < replay.positions.length; offset += 3) replay.positions[offset] = 1
    replay.alive[6] = 1
    replay.alive[7] = 0
    const renderer = createPlayerRenderer(replay, map, appearance, textures)
    renderer.draw(100, 1, { floor: 'upper', flashes: true })
    renderer.container.sortChildren()
    const openingOrder = renderer.container.children.map((child) => child.uid)
    renderer.draw(110, 1, { floor: 'upper', flashes: true })
    renderer.container.sortChildren()
    expect(renderer.container.children.map((child) => child.uid)).not.toEqual(openingOrder)
    renderer.draw(100, 1, { floor: 'upper', flashes: true })
    renderer.container.sortChildren()
    expect(renderer.container.children.map((child) => child.uid)).toEqual(openingOrder)
    renderer.container.destroy({ children: true })
  })

  it('shows climbing alongside flash and elevation, then clears it on exit, death and rewind', () => {
    const replay = round()
    const initial = replay.inspection[0]![0]!
    replay.inspection[0] = [
      { ...initial, tick: 90, onLadder: false },
      { ...initial, tick: 100, onLadder: true },
      { ...initial, tick: 104, onLadder: false },
    ]
    const renderer = createPlayerRenderer(replay, map, appearance, textures)
    const a = marker(renderer, 0)
    renderer.draw(100, 2, { floor: 'lower', flashes: true })
    expect([a.ladder.visible, a.flash.visible, a.elevation.visible]).toEqual([true, true, true])
    renderer.draw(104, 1, { floor: 'upper', flashes: true })
    expect(a.ladder.visible).toBe(false)
    renderer.draw(100, 1, { floor: 'upper', flashes: true })
    expect(a.ladder.visible).toBe(true)
    replay.alive[3] = 0
    renderer.draw(100, 1, { floor: 'upper', flashes: true })
    expect(a.ladder.visible).toBe(false)
    renderer.draw(90, 1, { floor: 'upper', flashes: true })
    expect(a.ladder.visible).toBe(false)
    renderer.container.destroy({ children: true })
  })

  it('marks a flashed player with an outlined eye-slash icon beside their marker', () => {
    const renderer = createPlayerRenderer(round(), map, appearance, textures)
    const { flash } = marker(renderer, 0)
    renderer.draw(100, 1, { floor: 'upper', flashes: true })
    const sprites = flash.children as Sprite[]
    expect([flash.visible, flash.x, flash.y, sprites.length]).toEqual([true, -25, 0, 9])
    expect(sprites.at(-1)!.tint).toBe(appearance.foreground)
    expect(new Set(sprites.slice(0, -1).map((sprite) => sprite.tint))).toEqual(
      new Set([appearance.background]),
    )
    expect(Math.round(sprites.at(-1)!.width)).toBe(12)
    expect(flash.alpha).toBe(1)
    const alphas = [102, 104, 107, 108, 104].map((tick) => {
      renderer.draw(tick, 1, { floor: 'upper', flashes: true })
      return [flash.visible, Number(flash.alpha.toFixed(2))]
    })
    expect(alphas).toEqual([
      [true, 1],
      [true, 0.67],
      [true, 0.17],
      [false, 0],
      [true, 0.67],
    ])
    renderer.draw(100, 1, { floor: 'upper', flashes: false })
    expect(flash.visible).toBe(false)
    renderer.container.destroy({ children: true })
  })

  it('shares one objective slot across carrying, planting and defusing while keeping flash separate', () => {
    const replay = round()
    replay.bomb = [
      { tick: 90, state: { type: 'inactive' } },
      { tick: 100, state: { type: 'carried', carrier: 'a', planting: false } },
      { tick: 102, state: { type: 'carried', carrier: 'a', planting: true } },
      {
        tick: 104,
        state: { type: 'planted', x: 120, y: 180, z: 1, defuser: { type: 'player', steamId: 'a' } },
      },
      { tick: 106, state: { type: 'planted', x: 120, y: 180, z: 1, defuser: { type: 'none' } } },
    ]
    const renderer = createPlayerRenderer(replay, map, appearance, textures)
    const a = marker(renderer, 0)
    renderer.draw(100, 2, { floor: 'upper', flashes: true })
    expect([a.objective.visible, a.objective.texture, a.flash.visible]).toEqual([
      true,
      textures.bomb,
      true,
    ])
    const carriedSize = a.objective.width
    renderer.draw(102, 1, { floor: 'upper', flashes: true })
    expect([a.objective.visible, a.objective.texture, a.objective.tint, a.flash.visible]).toEqual([
      true,
      textures.bomb,
      appearance.armed,
      true,
    ])
    expect(a.objective.width).toBeGreaterThan(carriedSize)
    renderer.draw(104, 1, { floor: 'upper', flashes: true })
    expect([a.objective.visible, a.objective.texture, a.objective.tint, a.flash.visible]).toEqual([
      true,
      textures.defuse,
      appearance.foreground,
      true,
    ])
    renderer.draw(106, 1, { floor: 'upper', flashes: true })
    expect(a.objective.visible).toBe(false)
    renderer.draw(102, 1, { floor: 'upper', flashes: true })
    expect([a.objective.texture, a.objective.tint]).toEqual([textures.bomb, appearance.armed])
    replay.alive[3] = 0
    renderer.draw(102, 1, { floor: 'upper', flashes: true })
    expect([a.objective.visible, a.flash.visible]).toEqual([false, false])
    renderer.container.destroy({ children: true })
  })

  it('samples positions and facing while preserving numbers, floor indicators and filters', () => {
    const renderer = createPlayerRenderer(round(), map, appearance, textures)
    renderer.draw(100, 2, { floor: 'upper', flashes: true })
    const a = marker(renderer, 0)
    const b = marker(renderer, 1)
    expect([a.container.x, a.container.y, a.direction.rotation]).toEqual([1014, 10, 0])
    expect([a.container.scale.x, a.container.scale.y, a.body.tint]).toEqual([2, 2, appearance.ct])
    expect([a.label.text, b.label.text]).toEqual(['1', '6'])
    expect([
      a.container.visible,
      b.container.visible,
      marker(renderer, 2).container.visible,
    ]).toEqual([true, true, false])
    expect([a.elevation.visible, b.elevation.visible, b.elevation.scale.y]).toEqual([
      false,
      true,
      -1,
    ])
    expect(b.container.zIndex).toBeLessThan(a.container.zIndex)
    renderer.draw(100, 2, { floor: 'lower', flashes: true })
    expect([a.elevation.visible, a.elevation.scale.y, b.elevation.visible]).toEqual([
      true,
      1,
      false,
    ])
    expect([a.container.visible, b.container.visible]).toEqual([true, true])
    renderer.draw(100, 2, { floor: 'lower', hiddenPlayers: new Set(['a']), flashes: true })
    expect([a.container.visible, b.container.visible]).toEqual([false, true])
    renderer.draw(100, 2, { floor: 'lower', hiddenTeams: new Set([3]), flashes: true })
    expect([a.container.visible, b.container.visible]).toEqual([false, true])
    renderer.draw(90, 0.5, { floor: 'upper', flashes: true })
    expect([a.container.x, a.container.y, a.label.text, a.body.tint, a.container.scale.x]).toEqual([
      1024,
      0,
      '1',
      appearance.t,
      0.5,
    ])
    expect([a.container.visible, b.container.visible]).toEqual([true, true])
    renderer.container.destroy({ children: true })
  })

  it('updates death and flash expiry without retaining later states after a backward seek', () => {
    const renderer = createPlayerRenderer(round(), map, appearance, textures)
    const a = marker(renderer, 0)
    renderer.draw(100, 1, { floor: 'upper', flashes: true })
    expect([a.container.alpha, a.flash.visible]).toEqual([1, true])
    renderer.draw(108, 1, { floor: 'upper', flashes: true })
    expect([a.container.alpha, a.flash.visible]).toEqual([1, false])
    renderer.draw(110, 1, { floor: 'lower', flashes: true })
    expect([a.flash.visible, a.container.visible, a.direction.rotation]).toEqual([
      false,
      true,
      -Math.PI / 2,
    ])
    expect([a.body.visible, a.cross.visible, a.container.alpha < 1]).toEqual([false, true, true])
    renderer.draw(100, 1, { floor: 'upper', flashes: true })
    expect([a.container.alpha, a.flash.visible, a.container.visible]).toEqual([1, true, true])
    expect([a.body.visible, a.cross.visible]).toEqual([true, false])
    renderer.draw(100, 1, { floor: 'upper', flashes: false })
    expect([a.container.alpha, a.flash.visible]).toEqual([1, false])
    renderer.container.destroy({ children: true })
  })
})

describe('marker labels', () => {
  it('labels each living marker with its number and its name below', () => {
    const renderer = createPlayerRenderer(round(), map, appearance, textures)
    renderer.draw(100, 1, { floor: 'upper', flashes: true })
    const [a, b] = [marker(renderer, 0), marker(renderer, 1)]
    expect([a.label.text, a.label.visible, a.name.text, a.name.visible]).toEqual([
      '1',
      true,
      'A',
      true,
    ])
    expect([b.label.text, b.name.text]).toEqual(['6', 'B'])
    renderer.draw(110, 1, { floor: 'upper', flashes: true })
    expect([a.label.visible, a.name.visible, a.cross.visible]).toEqual([false, false, true])
    renderer.container.destroy({ children: true })
  })
})

describe('marker layout', () => {
  const state: MarkerState = {
    team: 3,
    life: 'alive',
    floor: 'same',
    flash: 1,
    bomb: 'planting',
    ladder: true,
    facing: 0,
    number: 3,
    name: 'A long player name',
  }
  const setup = () => {
    const instance = createMarker(appearance, textures)
    const parts = markerParts(instance.container)
    return { ...instance, ...parts }
  }

  it('updates team and floor paint, and fades and crosses out the dead', () => {
    const a = setup()
    a.update({ ...state, team: 2, number: 7 }, 2)
    expect([a.body.tint, a.label.text, a.container.scale.x]).toEqual([appearance.t, '7', 2])
    a.update({ ...state, team: 2, floor: 'below' }, 1)
    expect(a.body.context.instructions.some((instruction) => instruction.action === 'stroke')).toBe(
      true,
    )
    expect([a.label.style.fill, a.container.alpha]).toEqual([appearance.foreground, 0.6])
    a.update({ ...state, floor: 'above', life: 'dead' }, 1)
    expect([a.body.visible, a.cross.visible, a.name.visible]).toEqual([false, true, false])
    expect(a.container.alpha).toBe(0.2)
    a.update(state, 1)
    expect([a.body.visible, a.cross.visible, a.name.visible, a.label.style.fill]).toEqual([
      true,
      false,
      true,
      appearance.background,
    ])
    a.container.destroy({ children: true })
  })

  it('keeps flash and its outline clear of the facing envelope at every heading', () => {
    const a = setup()
    a.update(state, 1)
    const flashRight = a.flash.x + a.flash.getLocalBounds().maxX
    expect(flashRight).toBeLessThanOrEqual(-18)
    for (let degrees = 0; degrees < 360; degrees += 5) {
      a.update({ ...state, facing: (degrees * Math.PI) / 180 }, 1)
      const tipX = 16 * Math.cos(a.direction.rotation)
      expect(tipX - flashRight).toBeGreaterThanOrEqual(2 - 1e-10)
    }
    a.container.destroy({ children: true })
  })

  it('keeps the name in one place below the circle whichever way the player faces', () => {
    const a = setup()
    for (let degrees = 0; degrees < 360; degrees += 15) {
      a.update({ ...state, facing: (degrees * Math.PI) / 180 }, 1)
      expect(a.name.y).toBe(12.5)
    }
    a.container.destroy({ children: true })
  })

  it('places compact names close below the circle, clear of every badge', () => {
    const a = setup()
    a.update(state, 1)
    expect(a.name.style.fontSize).toBe(9)
    expect(a.name.style.fontWeight).toBe('500')
    expect(a.name.style.stroke).toMatchObject({ color: appearance.background, width: 1.5 })
    expect(a.name.y - 8.5).toBe(4)
    for (const badge of [a.flash, a.ladder, a.objective]) {
      expect(badge.visible).toBe(true)
      expect(badge.y + badge.getLocalBounds().maxY).toBeLessThan(a.name.y)
    }
    // The C4 artwork fills x 4-28 of its 32px viewBox, drawn 10px square at the top-right.
    const bombInk = { x: a.objective.x - 3.75, y: a.objective.y + 5 }
    const bombGap = Math.hypot(bombInk.x, bombInk.y) - 8.5
    const ladderGap = a.ladder.x + a.ladder.context.bounds.minX - 8.5
    expect(Math.abs(ladderGap - bombGap)).toBeLessThan(0.1)
    a.container.destroy({ children: true })
  })
})

describe('marker state', () => {
  const player: ScenePlayer = {
    index: 0,
    steamId: 'a',
    team: 3,
    present: true,
    alive: true,
    health: 64,
    x: 0,
    y: 0,
    z: 1,
    yaw: 90,
    pitch: 0,
    inspection: {
      tick: 0,
      money: 0,
      armour: 0,
      flash: { type: 'none' },
      helmet: false,
      grenades: [],
      weapon: { type: 'none' },
      weapons: [],
    },
    flashSeconds: 0,
    bomb: 'none',
  }
  const identity = { number: 3, name: 'ropz' }

  it('describes a living player on the viewed floor', () => {
    expect(markerState(player, map, 'upper', identity)).toEqual({
      team: 3,
      life: 'alive',
      floor: 'same',
      flash: 0,
      bomb: 'none',
      ladder: false,
      facing: 0,
      number: 3,
      name: 'ropz',
    })
  })

  it('fades a flash over its last one and a half seconds', () => {
    const strength = [3, 1.5, 0.75, 0, -1].map(
      (flashSeconds) => markerState({ ...player, flashSeconds }, map, 'upper', identity).flash,
    )
    expect(strength).toEqual([1, 1, 0.5, 0, 0])
  })

  it('carries bomb roles and ladders while alive, and drops them on death', () => {
    const roles = (['carrying', 'planting', 'defusing'] as const).map(
      (bomb) => markerState({ ...player, bomb }, map, 'upper', identity).bomb,
    )
    expect(roles).toEqual(['carrying', 'planting', 'defusing'])
    const climbing = { ...player, inspection: { ...player.inspection, onLadder: true } }
    expect(markerState(climbing, map, 'upper', identity).ladder).toBe(true)
    const dead = markerState(
      { ...climbing, alive: false, bomb: 'carrying', flashSeconds: 2 },
      map,
      'upper',
      identity,
    )
    expect([dead.life, dead.bomb, dead.ladder, dead.flash]).toEqual(['dead', 'none', false, 0])
  })

  it('places players above or below the viewed floor', () => {
    expect(markerState({ ...player, z: 1 }, map, 'lower', identity).floor).toBe('above')
    expect(markerState({ ...player, z: -1 }, map, 'upper', identity).floor).toBe('below')
    expect(markerState({ ...player, z: -1 }, map, 'lower', identity).floor).toBe('same')
    expect(markerState({ ...player, team: 2 }, map, 'upper', identity).team).toBe(2)
  })
})
