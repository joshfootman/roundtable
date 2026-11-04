import { expect, test } from 'vitest'
import { activeBombTimers, bombTimers } from './bomb-timers'
import type { BombEvent } from './types'

const tickInterval = 1 / 64
const planter = '76561198068422762'
const defuser = '76561197978835160'

// Round 4 of the Dust2 replay fixture: a tap, then a kit defuse.
const defusedRound: BombEvent[] = [
  { tick: 30355, type: 'plant-start', player: planter },
  { tick: 30555, type: 'planted', player: planter },
  { tick: 31328, type: 'defuse-start', player: defuser },
  { tick: 31528, type: 'defuse-abort', player: defuser },
  { tick: 31645, type: 'defuse-start', player: defuser },
  { tick: 31965, type: 'defused', player: defuser },
]

test('times plants, the fuse and defuses from recorded bomb events', () => {
  expect(bombTimers({ bombEvents: defusedRound, tickInterval })).toEqual([
    { kind: 'plant', start: 30355, end: 30555, stop: 30555 },
    { kind: 'fuse', start: 30555, end: 33179, stop: 31965 },
    { kind: 'defuse', start: 31328, end: 31648, stop: 31528 },
    { kind: 'defuse', start: 31645, end: 31965, stop: 31965 },
  ])
})

test('reports the bomb and defuse progress at a tick', () => {
  const timers = bombTimers({ bombEvents: defusedRound, tickInterval })
  expect(activeBombTimers(timers, 30000)).toEqual({ bomb: undefined, defuse: undefined })
  expect(activeBombTimers(timers, 30455)).toEqual({
    bomb: { kind: 'plant', progress: 0.5 },
    defuse: undefined,
  })
  expect(activeBombTimers(timers, 31211)).toEqual({
    bomb: { kind: 'fuse', progress: 0.25 },
    defuse: undefined,
  })
  expect(activeBombTimers(timers, 31805)).toEqual({
    bomb: { kind: 'fuse', progress: 1250 / 2624 },
    defuse: 0.5,
  })
  expect(activeBombTimers(timers, 31965)).toEqual({ bomb: undefined, defuse: undefined })
})

test('falls back to measured lengths for attempts that never finish', () => {
  const timers = bombTimers({
    bombEvents: [
      { tick: 100, type: 'plant-start', player: planter },
      { tick: 150, type: 'plant-abort', player: planter },
      { tick: 200, type: 'plant-start', player: planter },
      { tick: 400, type: 'planted', player: planter },
      { tick: 1000, type: 'defuse-start', player: defuser },
      { tick: 1100, type: 'defuse-abort', player: defuser },
      { tick: 3024, type: 'exploded' },
    ],
    tickInterval,
  })
  expect(timers).toEqual([
    { kind: 'plant', start: 100, end: 300, stop: 150 },
    { kind: 'plant', start: 200, end: 400, stop: 400 },
    { kind: 'fuse', start: 400, end: 3024, stop: 3024 },
    { kind: 'defuse', start: 1000, end: 1640, stop: 1100 },
  ])
  expect(activeBombTimers(timers, 1064)).toEqual({
    bomb: { kind: 'fuse', progress: 664 / 2624 },
    defuse: 0.1,
  })
})

test('ends a defuse when the bomb explodes under it', () => {
  const timers = bombTimers({
    bombEvents: [
      { tick: 0, type: 'planted', player: planter },
      { tick: 2500, type: 'defuse-start', player: defuser },
      { tick: 2624, type: 'exploded' },
    ],
    tickInterval,
  })
  expect(timers).toEqual([
    { kind: 'fuse', start: 0, end: 2624, stop: 2624 },
    { kind: 'defuse', start: 2500, end: 3140, stop: 2624 },
  ])
  expect(activeBombTimers(timers, 2624)).toEqual({ bomb: undefined, defuse: undefined })
})
