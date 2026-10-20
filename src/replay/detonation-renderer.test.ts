import { describe, expect, it } from 'vitest'
import type { Container } from 'pixi.js'
import { createDetonationRenderer } from './detonation-renderer'
import type { MapDefinition } from './maps'
import { testRound } from './test-round'

const map: MapDefinition = {
  name: 'Test',
  imageSize: 1024,
  defaultZoom: 1,
  focusCenter: { x: 0.5, y: 0.5 },
  origin: { x: 0, y: 0 },
  scale: 1,
  rotation: 0,
  floors: 'split',
  images: { upper: '', lower: '' },
  boundaryZ: 0,
  initialFloor: 'upper',
}

function renderer() {
  return createDetonationRenderer(
    testRound({
      tickInterval: 0.1,
      detonations: [
        { tick: 100, kind: 'flash', entity: 1, x: 10, y: -20, z: 1 },
        { tick: 100, kind: 'he', entity: 2, x: 30, y: -40, z: 1 },
        { tick: 100, kind: 'smoke', entity: 3, x: 50, y: -60, z: 1 },
      ],
    }),
    map,
  )
}

function state(burst: Container) {
  const [outer] = burst.children
  return [burst.visible, Number(outer!.scale.x.toFixed(2)), Number(outer!.alpha.toFixed(2))]
}

describe('grenade detonation bursts', () => {
  it('bursts flashes and HE grenades, but not smokes, and replays them when scrubbed back', () => {
    const detonations = renderer()
    const [flash, he] = detonations.container.children as Container[]
    expect(detonations.container.children.map((child) => child.label)).toEqual([
      'flash-burst',
      'he-burst',
    ])
    expect([flash!.children.length, he!.children.length]).toEqual([2, 13])
    detonations.draw(99, 1, true, 'upper')
    expect([flash!.visible, he!.visible]).toEqual([false, false])
    detonations.draw(101, 1, true, 'upper')
    expect([flash!.x, flash!.y, he!.x, he!.y]).toEqual([10, 20, 30, 40])
    expect(state(flash!)).toEqual([true, 2.01, 0.6])
    expect(state(he!)).toEqual([true, 0.87, 0.35])
    detonations.draw(104, 1, true, 'upper')
    expect(state(flash!)).toEqual([true, 2.4, 0.01])
    expect(state(he!)).toEqual([true, 1.08, 0.31])
    detonations.draw(106, 1, true, 'upper')
    expect([flash!.visible, he!.visible]).toEqual([false, true])
    detonations.draw(109, 1, true, 'upper')
    expect(he!.visible).toBe(false)
    detonations.draw(101, 1, true, 'upper')
    expect(state(flash!)).toEqual([true, 2.01, 0.6])
    detonations.container.destroy({ children: true })
  })

  it('hides bursts on another floor or when toggled off, and holds size under reduced motion', () => {
    const detonations = renderer()
    const [flash] = detonations.container.children as Container[]
    detonations.draw(101, 1, true, 'lower')
    expect(flash!.visible).toBe(false)
    detonations.draw(101, 1, false, 'upper')
    expect(flash!.visible).toBe(false)
    detonations.draw(100, 2, true, 'upper', true)
    expect([flash!.scale.x, ...state(flash!)]).toEqual([2, true, 2.4, 1])
    const he = detonations.container.children[1] as Container
    detonations.draw(100, 1, true, 'upper', true)
    expect(he.children.filter((child) => child.visible)).toHaveLength(4)
    detonations.container.destroy({ children: true })
  })
})
