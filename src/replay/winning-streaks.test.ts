import { expect, test } from 'vitest'
import { roundWinningStreaks } from './winning-streaks'
import type { ReplayRound } from './types'

function round(number: number, winner?: 'ct' | 't', swapped = false): ReplayRound {
  return {
    number,
    outcome: winner ? { winner, reason: 1 } : undefined,
    teamNames: swapped ? { ct: 'B', t: 'A' } : { ct: 'A', t: 'B' },
    score: { ct: 0, t: 0 },
    overtime: 0,
    startTick: 0,
    liveStartTick: 10,
    resultTick: 100,
    endTick: 110,
    tickInterval: 1,
    players: [
      { steamId: 'a', name: 'A' },
      { steamId: 'b', name: 'B' },
    ],
    ticks: new Uint32Array([0, 10]),
    teams: new Uint8Array([1, 1, ...(swapped ? [2, 3] : [3, 2])]),
    present: new Uint8Array([1, 1, 1, 1, 1]),
    pitch: new Float32Array(5),
    damage: [],
    positions: new Float32Array(),
    alive: new Uint8Array(),
    health: new Int32Array(),
    yaw: new Float32Array(),
    droppedItems: [],
    shots: [],
    fires: [],
    smokes: [],
    projectiles: [],
    detonations: [],
    bombEvents: [],
    bomb: [],
    inspection: [],
    deaths: [],
  }
}

test('includes only outcomes visible at the result boundary and reconstructs a rewind', () => {
  const rounds = [round(1, 'ct'), round(2, 'ct'), round(3, 'ct'), round(4, 't')]
  expect(roundWinningStreaks(rounds, rounds[2], 99)).toEqual({ ct: 2, t: 0 })
  expect(roundWinningStreaks(rounds, rounds[2], 100)).toEqual({ ct: 3, t: 0 })
  expect(roundWinningStreaks(rounds, rounds[2], 99)).toEqual({ ct: 2, t: 0 })
  expect(roundWinningStreaks(rounds, rounds[3], 10)).toEqual({ ct: 3, t: 0 })
  expect(roundWinningStreaks(rounds, rounds[3], 100)).toEqual({ ct: 0, t: 1 })
})

test('stops evidence at missing results or round gaps without inferring earlier scores', () => {
  const rounds = [round(1, 'ct'), round(2), round(3, 'ct'), round(5, 'ct')]
  expect(roundWinningStreaks(rounds, rounds[2], 100)).toEqual({ ct: 1, t: 0 })
  expect(roundWinningStreaks(rounds, rounds[3], 100)).toEqual({ ct: 1, t: 0 })
  expect(roundWinningStreaks(rounds, rounds[1], 100)).toEqual({ ct: 0, t: 0 })
})

test('follows the roster through halftime and overtime even with duplicated clan names', () => {
  const rounds = [round(11, 'ct'), round(12, 'ct'), round(13, 't', true), round(14, 't', true)]
  rounds.forEach((item) => {
    item.teamNames = { ct: 'same', t: 'same' }
  })
  expect(roundWinningStreaks(rounds, rounds[2], 10)).toEqual({ ct: 0, t: 2 })
  expect(roundWinningStreaks(rounds, rounds[2], 100)).toEqual({ ct: 0, t: 3 })
  rounds[2].overtime = 1
  rounds[3].overtime = 1
  expect(roundWinningStreaks(rounds, rounds[3], 100)).toEqual({ ct: 0, t: 4 })
})

test('uses distinct names only when roster evidence is unavailable', () => {
  const rounds = [round(1, 'ct'), round(2, 'ct'), round(3, 't', true)]
  rounds.forEach((item) => {
    item.players = []
    item.teams = new Uint8Array()
  })
  expect(roundWinningStreaks(rounds, rounds[2], 100)).toEqual({ ct: 0, t: 3 })
  rounds[1].teamNames = { ct: 'same', t: 'same' }
  expect(roundWinningStreaks(rounds, rounds[2], 100)).toEqual({ ct: 0, t: 1 })
})

test('does not bridge uncertain roster continuity with apparently matching names', () => {
  const rounds = [round(1, 'ct'), round(2, 'ct')]
  rounds[1].players[0].steamId = 'unknown'
  expect(roundWinningStreaks(rounds, rounds[1], 100)).toEqual({ ct: 1, t: 0 })
  rounds[1].players[0].steamId = 'b'
  rounds[1].players[1].steamId = 'b'
  expect(roundWinningStreaks(rounds, rounds[1], 10)).toEqual({ ct: 0, t: 0 })
})
