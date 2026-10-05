import { expect, test } from 'vitest'
import { mapDefinition, mapFacing, visibleOnFloor, worldToMap, type MapDefinition } from './maps'

const map: MapDefinition = {
  name: 'Test radar',
  floors: 'single',
  image: 'radar.png',
  imageSize: 1024,
  defaultZoom: 1,
  origin: { x: -100, y: 200 },
  scale: 2,
  rotation: 0,
}

test('projects positions and facing through the same radar rotation', () => {
  const registered = mapDefinition('de_dust2')!
  expect(worldToMap(registered, -2476, 3239)).toEqual({ x: 0, y: 0 })
  const inferno = worldToMap(mapDefinition('de_inferno')!, 2472.34985, 2005.96997)
  expect(inferno.x).toBeCloseTo(380.41429, 3)
  expect(inferno.y).toBeCloseTo(93.52044, 3)
  const mirage = worldToMap(mapDefinition('de_mirage')!, -253.96875, -2154.4375)
  expect(mirage.x).toBeCloseTo(595.20625, 3)
  expect(mirage.y).toBeCloseTo(773.4875, 3)
  expect(mapDefinition('__proto__')).toBeUndefined()
  expect(mapDefinition('de_unknown')).toBeUndefined()
  expect(worldToMap(map, 300, 100)).toEqual({ x: 200, y: 50 })
  expect(mapFacing(map, 90)).toBe(-Math.PI / 2)
  const rotated = { ...map, rotation: 90 as const }
  expect(worldToMap(rotated, 300, 100)).toEqual({ x: 974, y: 200 })
  expect(mapFacing(rotated, 90)).toBe(0)
  expect(worldToMap({ ...map, rotation: 180 }, 300, 100)).toEqual({ x: 824, y: 974 })
  expect(worldToMap({ ...map, rotation: 270 }, 300, 100)).toEqual({ x: 50, y: 824 })
})

test('assigns every height to exactly one floor and leaves single floor maps visible', () => {
  const train = mapDefinition('de_train')!
  expect(train.floors).toBe('split')
  if (train.floors === 'split') expect(visibleOnFloor(train, train.initialFloor, -327)).toBe(true)
  const split: MapDefinition = {
    ...map,
    floors: 'split',
    images: { upper: 'upper.png', lower: 'lower.png' },
    boundaryZ: -495,
    initialFloor: 'upper',
  }
  expect(
    [-496, -495, -494].map((z) => [
      visibleOnFloor(split, 'upper', z),
      visibleOnFloor(split, 'lower', z),
    ]),
  ).toEqual([
    [false, true],
    [true, false],
    [true, false],
  ])
  expect([visibleOnFloor(map, 'upper', -10000), visibleOnFloor(map, 'lower', 10000)]).toEqual([
    true,
    true,
  ])
})

test('places independent Nuke spawn coordinates on the native radar instead of beyond its edge', () => {
  // demoinfocs reference: fixtures/maps-reference/astralis-vs-mouz-m2-nuke.json, round 1.
  // Native overview uses pos_x -3453, pos_y 2887 and scale 7 at the pinned radar revision.
  const nuke = mapDefinition('de_nuke')!
  const ctSpawn = worldToMap(nuke, 2504, -344)
  const tSpawn = worldToMap(nuke, -1808, -1025)
  expect(ctSpawn.x).toBeCloseTo(851, 3)
  expect(ctSpawn.y).toBeCloseTo(461.571, 3)
  expect(tSpawn.x).toBeCloseTo(235, 3)
  expect(tSpawn.y).toBeCloseTo(558.857, 3)
})
