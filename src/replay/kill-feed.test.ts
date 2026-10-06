import { describe, expect, it } from 'vitest'
import { killFeedAtTick } from './kill-feed'
import type { ReplayRound } from './types'

function round(): ReplayRound {
  return {
    number: 1,
    overtime: 0,
    startTick: 100,
    liveStartTick: 100,
    resultTick: 120,
    endTick: 130,
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
    players: [
      { steamId: 'ct', name: 'Counter' },
      { steamId: 't', name: 'Terror' },
    ],
    ticks: new Uint32Array([100, 110, 120]),
    teams: new Uint8Array([3, 2, 3, 2, 2, 3]),
    positions: new Float32Array(),
    alive: new Uint8Array(),
    health: new Int32Array(),
    yaw: new Float32Array(),
    deaths: [
      {
        tick: 105,
        victim: 't',
        killer: { type: 'player', steamId: 'ct' },
        weapon: 'ak47',
        headshot: true,
      },
      { tick: 115, victim: 'ct', killer: { type: 'world' }, weapon: 'world', headshot: false },
      {
        tick: 125,
        victim: 't',
        killer: { type: 'player', steamId: 't' },
        weapon: 'hegrenade',
        headshot: false,
      },
    ],
  }
}

describe('kill feed', () => {
  it('reveals only elapsed kills, latest first, and removes future kills on backward seeks', () => {
    const replay = round()
    expect(killFeedAtTick(replay, 100)).toEqual([])
    expect(killFeedAtTick(replay, 130).map((entry) => entry.tick)).toEqual([125, 115, 105])
    expect(killFeedAtTick(replay, 105).map((entry) => entry.tick)).toEqual([105])
  })

  it('keeps names, headshots and team colours from the time of the kill', () => {
    const entry = killFeedAtTick(round(), 130).at(-1)!
    expect(entry.attacker).toEqual({ name: 'Counter', team: 3 })
    expect(entry.target).toEqual({ name: 'Terror', team: 2 })
    expect(entry.weapon).toBe('ak47')
    expect(entry.headshot).toBe(true)
  })

  it('distinguishes world deaths and suicides and handles an unknown player', () => {
    const replay = round()
    const [suicide, world] = killFeedAtTick(replay, 130)
    expect(suicide?.suicide).toBe(true)
    expect(world?.attacker).toBeUndefined()
    replay.deaths[0]!.victim = 'missing'
    expect(killFeedAtTick(replay, 105)[0]?.target).toEqual({
      name: 'Unknown player',
      team: undefined,
    })
  })
})
