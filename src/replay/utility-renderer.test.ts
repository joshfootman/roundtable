import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import { createUtilityRenderer } from './utility-renderer'
import { initialUtilityVisibility } from './utility'
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
    tickInterval: 0.1,
    droppedItems: [],
    shots: [{ tick: 100, player: 'a', weapon: 7, x: 100, y: 200, z: 1, pitch: 0, yaw: 0 }],
    fires: [
      { tick: 90, fires: [] },
      { tick: 100, fires: [{ entity: 1, serial: 1, positions: [180, 120, 1] }] },
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
    detonations: [{ tick: 100, kind: 'he', entity: 4, x: 180, y: 120, z: 1 }],
    bombEvents: [],
    bomb: [],
    inspection: [],
    deaths: [],
    players: [],
    ticks: new Uint32Array(),
    positions: new Float32Array(),
    teams: new Uint8Array(),
    alive: new Uint8Array(),
    health: new Int32Array(),
    yaw: new Float32Array(),
  }
}

function bounds(graphics: Graphics) {
  const { minX, minY, maxX, maxY } = graphics.getLocalBounds()
  return [minX, minY, maxX, maxY]
}

describe('recorded utility rendering', () => {
  it('projects smoke, fire, detonations and shots onto the rotated radar', () => {
    const utilities = createUtilityRenderer(round(), map)
    utilities.draw(100, 1, initialUtilityVisibility(), 'upper')
    const [fire, smoke, shots, , detonation] = utilities.container.children as Graphics[]
    expect(bounds(fire!)).toEqual([954, 10, 1014, 70])
    expect(bounds(smoke!)).toEqual([901.5, -22.5, 1046.5, 122.5])
    expect(bounds(shots!)).toEqual([1023.5, -0.5, 1024.5, 48.5])
    expect(bounds(detonation!)).toEqual([967, 23, 1001, 57])
    utilities.draw(100, 2, initialUtilityVisibility(), 'upper')
    expect(bounds(fire!)).toEqual([954, 10, 1014, 70])
    expect(bounds(smoke!)).toEqual([901, -23, 1047, 123])
    expect(bounds(shots!)).toEqual([1023, -1, 1025, 97])
    expect(bounds(detonation!)).toEqual([950, 6, 1018, 74])
    utilities.container.destroy({ children: true })
  })

  it('expires, rewinds and filters effects, including empty utility tracks', () => {
    const recorded = round()
    const utilities = createUtilityRenderer(recorded, map)
    const layers = utilities.container.children as Graphics[]
    const visibility = initialUtilityVisibility()
    utilities.draw(100, 1, visibility, 'upper')
    const initialBounds = layers.map(bounds)
    expect(initialBounds[0]).toEqual([954, 10, 1014, 70])
    expect(initialBounds[2]).toEqual([1023.5, -0.5, 1024.5, 48.5])
    utilities.draw(102, 1, visibility, 'upper')
    expect(bounds(layers[2]!)).toEqual([0, 0, 0, 0])
    utilities.draw(120, 1, visibility, 'upper')
    expect(layers.map(bounds)).toEqual(Array(5).fill([0, 0, 0, 0]))
    utilities.draw(100, 1, visibility, 'upper')
    expect(layers.map(bounds)).toEqual(initialBounds)
    visibility.shots = visibility.smokes = false
    utilities.draw(100, 1, visibility, 'upper')
    expect(layers.map((layer) => layer.visible)).toEqual([true, false, false, true, true])
    expect([bounds(layers[1]!), bounds(layers[2]!)]).toEqual([
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ])
    expect(bounds(layers[0]!)).toEqual(initialBounds[0])
    recorded.fires = []
    recorded.smokes = []
    recorded.shots = []
    recorded.projectiles = []
    recorded.detonations = []
    utilities.draw(100, 1, initialUtilityVisibility(), 'upper')
    expect(layers.map((layer) => layer.visible)).toEqual([true, true, true, true, true])
    expect(layers.map(bounds)).toEqual(Array(5).fill([0, 0, 0, 0]))
    utilities.container.destroy({ children: true })
  })

  it('filters floors without connecting trajectories across hidden floor samples', () => {
    const utilities = createUtilityRenderer(round(), map)
    const layers = utilities.container.children as Graphics[]
    utilities.draw(103, 1, initialUtilityVisibility(), 'upper')
    const trajectory = layers[3]!.context.instructions[0]!
    expect(trajectory.action === 'stroke' ? trajectory.data.path.instructions : null).toEqual([
      { action: 'moveTo', data: [964, 60] },
      { action: 'lineTo', data: [954, 70] },
    ])
    utilities.draw(103, 1, initialUtilityVisibility(), 'lower')
    expect([layers[0]!, layers[1]!, layers[2]!, layers[4]!].map(bounds)).toEqual(
      Array(4).fill([0, 0, 0, 0]),
    )
    const lowerTrajectory = layers[3]!.context.instructions[0]!
    expect(
      lowerTrajectory.action === 'stroke' ? lowerTrajectory.data.path.instructions : null,
    ).toEqual([{ action: 'moveTo', data: [974, 50] }])
    utilities.container.destroy({ children: true })
  })
})
