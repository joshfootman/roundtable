import { describe, expect, it } from 'vitest'
import { Container, Graphics, Sprite, Texture } from 'pixi.js'
import { createUtilityRenderer } from './utility-renderer'
import { initialUtilityVisibility } from './utility'
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

const icons = {
  flash: Texture.WHITE,
  he: Texture.WHITE,
  smoke: Texture.WHITE,
  molotov: Texture.WHITE,
  incendiary: Texture.WHITE,
  decoy: Texture.WHITE,
  cloud: Texture.WHITE,
  fire: Texture.WHITE,
}

function round(): ReplayRound {
  return testRound({
    startTick: 90,
    liveStartTick: 100,
    resultTick: 140,
    endTick: 150,
    tickInterval: 0.1,
    shots: [
      {
        tick: 100,
        player: 'a',
        weapon: 7,
        x: 100,
        y: 200,
        z: 1,
        pitch: 0,
        yaw: 0,
      },
    ],
    fires: [
      { tick: 90, fires: [] },
      {
        tick: 100,
        fires: [{ entity: 1, serial: 1, positions: [180, 120, 1] }],
      },
      { tick: 120, fires: [] },
    ],
    smokes: [{ entity: 2, startTick: 100, endTick: 120, x: 200, y: 100, z: 1 }],
    projectiles: [
      {
        entity: 3,
        serial: 1,
        kind: 'flash',
        thrower: 'a',
        startTick: 100,
        endTick: 110,
        ticks: new Uint32Array([100, 101, 102, 103]),
        positions: new Float32Array([180, 120, 1, 200, 100, -1, 220, 80, 1, 240, 60, 1]),
      },
    ],
    detonations: [{ tick: 100, kind: 'he', entity: 4, x: 900, y: 900, z: 1 }],
    bomb: [],
    inspection: [],
    players: [],
    ticks: new Uint32Array(),
    positions: new Float32Array(),
    teams: new Uint8Array(),
    pitch: new Float32Array(),
    alive: new Uint8Array(),
    health: new Int32Array(),
    yaw: new Float32Array(),
  })
}

function bounds(graphics: Graphics | Container) {
  const { minX, minY, maxX, maxY } =
    graphics instanceof Graphics ? graphics.context.bounds : graphics.getLocalBounds()
  return [minX, minY, maxX, maxY]
}

describe('recorded utility rendering', () => {
  it('projects smoke, fire and shots onto the rotated radar', () => {
    const utilities = createUtilityRenderer(round(), map, icons, 0x111111)
    utilities.draw(100, 1, initialUtilityVisibility(), 'upper', true)
    const [fire, smoke, shots] = utilities.container.children as Graphics[]
    expect(bounds(fire!)).toEqual([954, 10, 1014, 70])
    expect(bounds(smoke!).map(Math.round)).toEqual([902, -22, 1047, 123])
    expect(bounds(shots!)).toEqual([1023.25, 10, 1024.75, 58])
    utilities.draw(100, 2, initialUtilityVisibility(), 'upper', true)
    expect(bounds(fire!)).toEqual([954, 10, 1014, 70])
    expect(bounds(smoke!).map(Math.round)).toEqual([901, -23, 1047, 123])
    expect(bounds(shots!)).toEqual([1022.5, 20, 1025.5, 116])
    utilities.container.destroy({ children: true })
  })

  it('expires, rewinds and filters effects, including empty utility tracks', () => {
    const recorded = round()
    const utilities = createUtilityRenderer(recorded, map, icons, 0x111111)
    const layers = utilities.container.children as Graphics[]
    const visibility = initialUtilityVisibility()
    utilities.draw(100, 1, visibility, 'upper')
    const initialBounds = layers.map(bounds)
    expect(initialBounds[0]).toEqual([954, 10, 1014, 70])
    expect(initialBounds[2]).toEqual([1023.25, 10, 1024.75, 58])
    utilities.draw(102, 1, visibility, 'upper')
    expect(bounds(layers[2]!)).toEqual([0, 0, 0, 0])
    utilities.draw(120, 1, visibility, 'upper')
    expect(layers.map(bounds)).toEqual(Array(8).fill([0, 0, 0, 0]))
    utilities.draw(100, 1, visibility, 'upper')
    expect(layers.map(bounds)).toEqual(initialBounds)
    visibility.shots = visibility.smokes = false
    utilities.draw(100, 1, visibility, 'upper')
    expect(layers.map((layer) => layer.visible)).toEqual([
      true,
      false,
      false,
      true,
      true,
      true,
      true,
      true,
    ])
    expect([bounds(layers[1]!), bounds(layers[2]!)]).toEqual([
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ])
    expect(bounds(layers[0]!)).toEqual(initialBounds[0])
    recorded.fires = []
    recorded.smokes = []
    recorded.shots = []
    recorded.projectiles = []
    utilities.draw(100, 1, initialUtilityVisibility(), 'upper')
    expect(layers.map((layer) => layer.visible)).toEqual([
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
    ])
    expect(layers.map(bounds)).toEqual(Array(8).fill([0, 0, 0, 0]))
    utilities.container.destroy({ children: true })
  })

  it('filters floors without connecting trajectories across hidden floor samples', () => {
    const utilities = createUtilityRenderer(round(), map, icons, 0x111111)
    const layers = utilities.container.children as Graphics[]
    utilities.draw(103, 1, initialUtilityVisibility(), 'upper')
    const trajectory = layers[3]!.context.instructions[0]!
    expect(trajectory.action === 'stroke' ? trajectory.data.path.instructions : null).toEqual([
      { action: 'moveTo', data: [964, 60] },
      { action: 'lineTo', data: [954, 70] },
    ])
    utilities.draw(103, 1, initialUtilityVisibility(), 'lower')
    expect([layers[0]!, layers[1]!, layers[2]!].map(bounds)).toEqual(Array(3).fill([0, 0, 0, 0]))
    const lowerTrajectory = layers[3]!.context.instructions[0]!
    expect(
      lowerTrajectory.action === 'stroke' ? lowerTrajectory.data.path.instructions : null,
    ).toEqual([{ action: 'moveTo', data: [974, 50] }])
    utilities.container.destroy({ children: true })
  })

  it('grows the thrown icon toward the top of its arc and shrinks it on the way down', () => {
    const recorded = round()
    recorded.projectiles[0]!.positions = new Float32Array([
      180, 120, 1, 200, 100, 51, 220, 80, 101, 240, 60, 1,
    ])
    const utilities = createUtilityRenderer(recorded, map, icons, 0x111111)
    const icon = (utilities.container.children[4] as Container).children[0]!
    const widths = [100, 101, 102, 103].map((tick) => {
      utilities.draw(tick, 1, initialUtilityVisibility(), 'upper')
      return icon.width
    })
    expect(widths).toEqual([10, 14, 18, 10])
    utilities.container.destroy({ children: true })
  })

  it('marks each smoke and fire with an opaque icon in its colour, held at the centre of its whole burn', () => {
    const recorded = round()
    recorded.fires.splice(2, 0, {
      tick: 110,
      fires: [{ entity: 1, serial: 1, positions: [180, 120, 1, 180, 200, 1] }],
    })
    const utilities = createUtilityRenderer(recorded, map, icons, 0x111111)
    const areaIcons = utilities.container.children[6] as Container
    const placed = () =>
      (areaIcons.children as Container[])
        .filter((badge) => badge.visible)
        .map((badge) => {
          const icon = badge.children.at(-1) as Sprite
          return [badge.x, badge.y, badge.width, icon.width, icon.tint, icon.alpha]
        })
    utilities.draw(100, 1, initialUtilityVisibility(), 'upper')
    expect(placed()).toEqual([
      [997.3333333333334, 40, 24, 22, 0xffb778, 1],
      [974, 50, 20, 18, 0xb8bcc2, 1],
    ])
    utilities.draw(110, 1, initialUtilityVisibility(), 'upper')
    expect(placed()[0]!.slice(0, 2)).toEqual([997.3333333333334, 40])
    utilities.draw(120, 1, initialUtilityVisibility(), 'upper')
    expect(placed()).toEqual([])
    utilities.container.destroy({ children: true })
  })

  it('plumes each smoke out from its centre, then holds it still', () => {
    const utilities = createUtilityRenderer(round(), map, icons, 0x111111)
    const smoke = utilities.container.children[1] as Graphics
    const widths = [100, 101, 102, 106, 118].map((tick) => {
      utilities.draw(tick, 1, initialUtilityVisibility(), 'upper')
      return Math.round(smoke.context.bounds.width)
    })
    expect(widths).toEqual([44, 113, 135, 145, 145])
    utilities.draw(100, 1, initialUtilityVisibility(), 'upper', true)
    expect(Math.round(smoke.context.bounds.width)).toEqual(145)
    utilities.container.destroy({ children: true })
  })

  it('punches a hole through smoke where an HE blows, then lets it refill', () => {
    const recorded = round()
    recorded.endTick = 200
    recorded.smokes[0]!.endTick = 200
    recorded.detonations = [
      { tick: 110, kind: 'he', entity: 4, x: 200, y: 100, z: 1 },
      { tick: 110, kind: 'he', entity: 5, x: 900, y: 900, z: 1 },
      { tick: 110, kind: 'he', entity: 6, x: 200, y: 100, z: 400 },
    ]
    const utilities = createUtilityRenderer(recorded, map, icons, 0x111111)
    const holes = utilities.container.children[7] as Graphics
    const holeWidths = [109, 110, 111, 120, 130, 135, 140, 120].map((tick) => {
      utilities.draw(tick, 1, initialUtilityVisibility(), 'upper')
      return Math.round(holes.context.bounds.width)
    })
    expect(holeWidths).toEqual([0, 0, 116, 120, 108, 12, 0, 120])
    expect(utilities.container.children[1]!.mask).toBe(holes)
    utilities.container.destroy({ children: true })
  })

  it('marks a live decoy with its icon and sound waves either side until it stops', () => {
    const recorded = round()
    recorded.tickInterval = 1
    recorded.endTick = 200
    recorded.detonations = [{ tick: 100, kind: 'decoy', entity: 7, x: 200, y: 100, z: 1 }]
    const utilities = createUtilityRenderer(recorded, map, icons, 0x111111)
    const waves = utilities.container.children[5] as Graphics
    const areaIcons = utilities.container.children[6] as Container
    const decoyIcon = () => {
      const badge = (areaIcons.children as Container[]).find((child) => child.visible)
      const icon = badge?.children.at(-1) as Sprite | undefined
      return icon && [badge!.x, badge!.y, icon.width, icon.tint]
    }
    const visibility = initialUtilityVisibility()
    visibility.smokes = visibility.fires = false
    utilities.draw(99, 1, visibility, 'upper')
    expect([bounds(waves), decoyIcon()]).toEqual([[0, 0, 0, 0], undefined])
    utilities.draw(100, 1, visibility, 'upper')
    expect(bounds(waves).map(Math.round)).toEqual([961, 44, 987, 56])
    expect(decoyIcon()).toEqual([974, 50, 12, 0xaaa9dd])
    utilities.draw(114, 1, visibility, 'upper')
    expect(decoyIcon()).toEqual([974, 50, 12, 0xaaa9dd])
    utilities.draw(115, 1, visibility, 'upper')
    expect([bounds(waves), decoyIcon()]).toEqual([[0, 0, 0, 0], undefined])
    visibility.decoys = false
    utilities.draw(100, 1, visibility, 'upper')
    expect([waves.visible, decoyIcon()]).toEqual([false, undefined])
    utilities.container.destroy({ children: true })
  })

  it('fires each tracer from the shooter as they move, fading it out', () => {
    const recorded = testRound({
      tickInterval: 0.1,
      players: [{ steamId: 'a', name: 'A' }],
      ticks: new Uint32Array([100, 101]),
      shots: round().shots,
    })
    recorded.positions = new Float32Array([100, 200, 1, 110, 200, 1])
    const utilities = createUtilityRenderer(recorded, map, icons, 0x111111)
    const shots = utilities.container.children[2] as Graphics
    const tracer = () => {
      const [instruction] = shots.context.instructions
      const alpha = instruction?.action === 'fill' ? instruction.data.style.alpha : 0
      return [...bounds(shots), Number(alpha.toFixed(2))]
    }
    utilities.draw(100, 1, initialUtilityVisibility(), 'upper')
    expect(tracer()).toEqual([1023.25, 10, 1024.75, 58, 0.9])
    utilities.draw(101, 1, initialUtilityVisibility(), 'upper')
    expect(tracer()).toEqual([1023.25, 15, 1024.75, 63, 0.1])
    utilities.draw(100, 1, initialUtilityVisibility(), 'upper')
    expect(tracer()).toEqual([1023.25, 10, 1024.75, 58, 0.9])
    utilities.container.destroy({ children: true })
  })
})
