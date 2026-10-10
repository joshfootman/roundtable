import { expect, test } from 'vitest'
import { lerpDegrees, scenePlayers } from './scene'
import { testRound } from './test-round'

function round() {
  return testRound({
    players: [
      { steamId: 'walker', name: 'Walker' },
      { steamId: 'teleporter', name: 'Teleporter' },
      { steamId: 'victim', name: 'Victim' },
    ],
    ticks: new Uint32Array([100, 102]),
    // prettier-ignore
    positions: new Float32Array([
      0, 0, 0,   0, 0, 0,     0, 0, 0,
      10, 20, 4, 500, 0, 0,  10, 0, 0,
    ]),
    yaw: new Float32Array([170, 0, 0, -170, 90, 90]),
    alive: new Uint8Array([1, 1, 1, 1, 1, 0]),
  })
}

test('blends position and facing toward the next sample', () => {
  const [walker] = scenePlayers(round(), 101)
  expect([walker!.x, walker!.y, walker!.z]).toEqual([5, 10, 2])
  expect(walker!.yaw).toBeCloseTo(180)
})

test('holds the earlier sample across a teleport or a death', () => {
  const [, teleporter, victim] = scenePlayers(round(), 101)
  expect([teleporter!.x, teleporter!.yaw]).toEqual([0, 0])
  expect([victim!.x, victim!.alive]).toEqual([0, true])
})

test('lands exactly on recorded samples', () => {
  const players = scenePlayers(round(), 102)
  expect(players.map((player) => [player.x, player.yaw, player.alive])).toEqual([
    [10, -170, true],
    [500, 90, true],
    [10, 90, false],
  ])
})

test('turns along the shorter arc', () => {
  expect(lerpDegrees(350, 10, 0.5)).toBeCloseTo(360)
  expect(lerpDegrees(10, 350, 0.5)).toBeCloseTo(0)
  expect(lerpDegrees(0, 90, 0.5)).toBe(45)
})
