import { describe, expect, it } from 'vitest'
import { playerCardsAtTick } from './player-cards'
import type { PlayerInspection, ReplayDeath, ReplayRound, ReplayWeapon } from './types'

function inspection(tick: number, money = 800): PlayerInspection {
  return {
    tick,
    money,
    armour: 100,
    helmet: true,
    grenades: [{ definition: 43, count: 2 }],
    weapon: { type: 'gun', definition: 7, magazine: 25, reserve: 60 },
    weapons: [{ type: 'gun', definition: 7, magazine: 25, reserve: 60 }],
    flash: { type: 'none' },
  }
}

function round(startTick: number, deaths: ReplayDeath[] = []): ReplayRound {
  return {
    number: 1,
    overtime: 0,
    startTick,
    liveStartTick: startTick,
    resultTick: startTick + 10,
    endTick: startTick + 10,
    tickInterval: 1 / 64,
    droppedItems: [],
    shots: [],
    fires: [],
    smokes: [],
    projectiles: [],
    detonations: [],
    bombEvents: [],
    bomb: [{ tick: startTick, state: { type: 'inactive' } }],
    inspection: [[inspection(startTick)], [inspection(startTick)], [inspection(startTick)]],
    deaths,
    players: [
      { steamId: 'ct', name: 'Counter' },
      { steamId: 't', name: 'Terror' },
      { steamId: 'spectator', name: 'Observer' },
    ],
    ticks: new Uint32Array([startTick, startTick + 10]),
    positions: new Float32Array(18),
    alive: new Uint8Array([1, 1, 0, 1, 0, 0]),
    health: new Int32Array([100, 80, 0, 60, 0, 0]),
    yaw: new Float32Array(6),
    teams: new Uint8Array([3, 2, 1, 3, 2, 1]),
  }
}

function death(tick: number, victim: string, killer?: string): ReplayDeath {
  return {
    tick,
    victim,
    killer: killer ? { type: 'player', steamId: killer } : { type: 'world' },
    weapon: 'ak47',
    headshot: false,
  }
}

describe('demo player cards', () => {
  it('keeps live-start numbers when a player dies or changes team during playback', () => {
    const replayRound = round(100)
    replayRound.teams.set([2, 3, 1], 3)
    expect(
      playerCardsAtTick([replayRound], replayRound, 110).map(
        ({ steamId, number, alive, team }) => ({
          steamId,
          number,
          alive,
          team,
        }),
      ),
    ).toEqual([
      { steamId: 'ct', number: 1, alive: true, team: 2 },
      { steamId: 't', number: 6, alive: false, team: 3 },
    ])
  })

  it('uses team and health samples while equipment and bomb follow their own ticks', () => {
    const replayRound = round(100)
    replayRound.inspection[0]!.push({
      ...inspection(105, 150),
      armour: 94,
      helmet: false,
      flash: { type: 'flashed', startTick: 105, durationSeconds: 2 },
    })
    replayRound.bomb.push(
      { tick: 105, state: { type: 'carried', carrier: 'ct', planting: false } },
      { tick: 110, state: { type: 'dropped', x: 0, y: 0, z: 0 } },
    )

    const cards = playerCardsAtTick([replayRound], replayRound, 106)
    expect(
      cards.map(({ name, number, team, health, alive }) => ({ name, number, team, health, alive })),
    ).toEqual([
      { name: 'Counter', number: 1, team: 3, health: 100, alive: true },
      { name: 'Terror', number: 6, team: 2, health: 80, alive: true },
    ])
    expect(cards[0]).toMatchObject({
      carriesBomb: true,
      flashSeconds: 2 - 1 / 64,
      inspection: {
        money: 150,
        armour: 94,
        helmet: false,
        grenades: [{ definition: 43, count: 2 }],
        weapon: { magazine: 25, reserve: 60 },
      },
    })
    expect(playerCardsAtTick([replayRound], replayRound, 110)[0]).toMatchObject({
      health: 60,
      carriesBomb: false,
    })
    expect(playerCardsAtTick([replayRound], replayRound, 110)[1]).toMatchObject({
      alive: false,
      health: 0,
    })
  })

  it('counts previous and elapsed deaths without revealing future round or current events', () => {
    const earlier = round(10, [death(12, 't', 'ct'), death(14, 'ct', 't')])
    const current = round(100, [death(104, 't', 'ct'), death(109, 'ct', 't')])
    const future = round(200, [death(202, 'ct', 't')])
    expect(
      playerCardsAtTick([earlier, current, future], current, 105).map(({ kills, deaths }) => ({
        kills,
        deaths,
      })),
    ).toEqual([
      { kills: 2, deaths: 1 },
      { kills: 1, deaths: 2 },
    ])
  })

  it('counts world, suicide and teamkill deaths without awarding enemy kills', () => {
    const replayRound = round(100, [death(101, 'ct'), death(102, 't', 't'), death(103, 't', 'ct')])
    replayRound.teams[1] = 3
    replayRound.teams[4] = 2
    expect(
      playerCardsAtTick([replayRound], replayRound, 110).map(({ kills, deaths, team }) => ({
        kills,
        deaths,
        team,
      })),
    ).toEqual([
      { kills: 0, deaths: 1, team: 3 },
      { kills: 0, deaths: 2, team: 2 },
    ])
  })
})

describe('player card weapon icons', () => {
  const rifle: ReplayWeapon = { type: 'gun', definition: 16, magazine: 30, reserve: 90 }
  const pistol: ReplayWeapon = { type: 'gun', definition: 61, magazine: 12, reserve: 24 }
  const knife: ReplayWeapon = { type: 'item', definition: 42 }

  it('updates the held weapon and ordered combat icons through switches and rewind', () => {
    const replayRound = round(100)
    const state = replayRound.inspection[0]![0]!
    state.weapon = knife
    state.weapons = [
      { type: 'gun', definition: 31, magazine: 1, reserve: 0 },
      { type: 'item', definition: 43 },
      { type: 'item', definition: 49 },
      knife,
      pistol,
      rifle,
    ]
    replayRound.inspection[0]!.push(
      { ...state, tick: 105, weapon: { ...rifle, magazine: 29 } },
      { ...state, tick: 110, weapon: { ...pistol, magazine: 10 } },
      { ...state, tick: 115, weapon: { type: 'item', definition: 43 } },
    )
    expect(playerCardsAtTick([replayRound], replayRound, 104)[0]).toMatchObject({
      inspection: { weapon: { type: 'item', definition: 42 } },
      otherWeapons: [
        { type: 'gun', definition: 16, magazine: 30, reserve: 90 },
        { type: 'gun', definition: 61, magazine: 12, reserve: 24 },
      ],
    })
    expect(playerCardsAtTick([replayRound], replayRound, 105)[0]).toMatchObject({
      inspection: { weapon: { type: 'gun', definition: 16, magazine: 29, reserve: 90 } },
      otherWeapons: [
        { type: 'gun', definition: 61, magazine: 12, reserve: 24 },
        { type: 'item', definition: 42 },
      ],
    })
    expect(playerCardsAtTick([replayRound], replayRound, 110)[0]).toMatchObject({
      inspection: { weapon: { type: 'gun', definition: 61, magazine: 10, reserve: 24 } },
      otherWeapons: [
        { type: 'gun', definition: 16, magazine: 30, reserve: 90 },
        { type: 'item', definition: 42 },
      ],
    })
    expect(playerCardsAtTick([replayRound], replayRound, 115)[0]).toMatchObject({
      inspection: { weapon: { type: 'item', definition: 43 } },
      otherWeapons: [
        { type: 'gun', definition: 16, magazine: 30, reserve: 90 },
        { type: 'gun', definition: 61, magazine: 12, reserve: 24 },
        { type: 'item', definition: 42 },
      ],
    })
    expect(playerCardsAtTick([replayRound], replayRound, 100)[0]).toMatchObject({
      inspection: { weapon: { type: 'item', definition: 42 } },
      otherWeapons: [
        { type: 'gun', definition: 16, magazine: 30, reserve: 90 },
        { type: 'gun', definition: 61, magazine: 12, reserve: 24 },
      ],
    })
  })

  it('does not invent inventory or an active weapon when either is missing', () => {
    const replayRound = round(100)
    const state = replayRound.inspection[0]![0]!
    state.weapon = rifle
    state.weapons = []
    expect(playerCardsAtTick([replayRound], replayRound, 100)[0]).toMatchObject({
      inspection: { weapon: { type: 'gun', definition: 16, magazine: 30, reserve: 90 } },
      otherWeapons: [],
    })
    state.weapon = { type: 'none' }
    state.weapons = [pistol]
    expect(playerCardsAtTick([replayRound], replayRound, 100)[0]).toMatchObject({
      inspection: { weapon: { type: 'none' } },
      otherWeapons: [{ type: 'gun', definition: 61, magazine: 12, reserve: 24 }],
    })
  })
})
