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
    present: new Uint8Array([1, 1, 1, 1, 1, 1]),
    pitch: new Float32Array(6),
    damage: [],
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
        flashAssist: false,
      },
      {
        tick: 115,
        victim: 'ct',
        killer: { type: 'world' },
        weapon: 'world',
        headshot: false,
        flashAssist: false,
      },
      {
        tick: 125,
        victim: 't',
        killer: { type: 'player', steamId: 't' },
        weapon: 'hegrenade',
        headshot: false,
        flashAssist: false,
      },
    ],
  }
}

describe('kill feed', () => {
  it('reveals only elapsed kills, latest first, and removes future kills on backward seeks', () => {
    const replay = round()
    expect(killFeedAtTick(replay, 100)).toEqual([])
    expect(
      killFeedAtTick(replay, 130).map(({ tick, attacker, target, weapon, headshot }) => [
        tick,
        attacker?.name,
        attacker?.team,
        target.name,
        target.team,
        weapon,
        headshot,
      ]),
    ).toEqual([
      [125, 'Terror', 3, 'Terror', 3, 'hegrenade', false],
      [115, undefined, undefined, 'Counter', 3, 'world', false],
      [105, 'Counter', 3, 'Terror', 2, 'ak47', true],
    ])
    expect(killFeedAtTick(replay, 105).map((entry) => entry.tick)).toEqual([105])
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
