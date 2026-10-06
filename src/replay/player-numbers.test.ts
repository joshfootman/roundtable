import { describe, expect, it } from 'vitest'
import { playerNumbers } from './player-numbers'
import type { ReplayRound } from './types'

function round(): ReplayRound {
  return {
    number: 1,
    overtime: 0,
    startTick: 100,
    liveStartTick: 115,
    resultTick: 120,
    endTick: 120,
    tickInterval: 1 / 64,
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
    players: [
      { steamId: 'ct-a', name: 'Counter A' },
      { steamId: 't-a', name: 'Terror A' },
      { steamId: 'observer', name: 'Observer' },
      { steamId: 'ct-b', name: 'Counter B' },
      { steamId: 't-b', name: 'Terror B' },
      { steamId: 'ct-c', name: 'Counter C' },
      { steamId: 't-c', name: 'Terror C' },
      { steamId: 'ct-d', name: 'Counter D' },
      { steamId: 't-d', name: 'Terror D' },
      { steamId: 'ct-e', name: 'Counter E' },
      { steamId: 't-e', name: 'Terror E' },
    ],
    ticks: new Uint32Array([100, 110, 120]),
    teams: new Uint8Array([
      2, 3, 1, 2, 3, 2, 3, 2, 3, 2, 3, 3, 2, 1, 3, 2, 3, 2, 3, 2, 3, 2, 2, 3, 1, 2, 3, 2, 3, 2, 3,
      2, 3,
    ]),
    positions: new Float32Array(99),
    alive: new Uint8Array(33),
    health: new Int32Array(33),
    yaw: new Float32Array(33),
  }
}

describe('player numbers', () => {
  it('numbers interleaved teammates by the live-start sample without numbering spectators', () => {
    expect([...playerNumbers(round())]).toEqual([
      ['ct-a', 1],
      ['t-a', 6],
      ['ct-b', 2],
      ['t-b', 7],
      ['ct-c', 3],
      ['t-c', 8],
      ['ct-d', 4],
      ['t-d', 9],
      ['ct-e', 5],
      ['t-e', 10],
    ])
  })

  it('does not renumber dead players or use later team samples', () => {
    const replayRound = round()
    replayRound.alive[11] = 0
    replayRound.alive[14] = 1
    const numbers = playerNumbers(replayRound)
    expect(numbers.get('ct-a')).toBe(1)
    expect(numbers.get('ct-b')).toBe(2)
    expect(numbers.get('t-a')).toBe(6)
    expect(numbers.get('observer')).toBeUndefined()
  })

  it('assigns the side ranges again when teams switch in another round', () => {
    const replayRound = round()
    replayRound.liveStartTick = 120
    const numbers = playerNumbers(replayRound)
    expect(numbers.get('ct-a')).toBe(6)
    expect(numbers.get('t-a')).toBe(1)
    expect(numbers.get('ct-e')).toBe(10)
    expect(numbers.get('t-e')).toBe(5)
  })
})
