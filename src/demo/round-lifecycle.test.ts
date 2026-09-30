import { expect, test } from 'vitest'
import { createRoundTracker, type ReplayEvent, type RoundRules } from './round-lifecycle'

const rules: RoundRules = {
  warmup: false,
  started: true,
  totalRoundsPlayed: 0,
  reason: 0,
  phase: 2,
  overtime: 0,
}

test('discards knife stages and completed match attempts when recorded rules restart', () => {
  const tracker = createRoundTracker()
  const retained: ReplayEvent[] = []
  function packet(tick: number, changes: Partial<RoundRules>, events: string[] = []) {
    const output = tracker.update(tick, { ...rules, ...changes }, events, 1 / 64)
    for (const event of output) {
      if (event.type === 'reset') retained.length = 0
      else if (event.type === 'round') retained.push(event)
    }
    if (tracker.recording)
      tracker.sample(tick, [
        {
          steamId: '76561198201620490',
          name: 'broky',
          team: 2,
          x: tick,
          y: 20,
          z: 30,
          alive: true,
          health: 100,
          yaw: 90,
          money: 800,
          armour: 0,
          helmet: false,
          grenades: [],
          weapon: { type: 'none' },
        },
      ])
    tracker.bomb(tick, { type: 'inactive' })
    return output
  }
  packet(0, { warmup: true, started: false }, ['round_start'])
  expect(packet(1, { reason: 16 }, ['round_start'])).toEqual([])
  packet(10, {}, ['round_start'])
  packet(11, {}, ['round_freeze_end'])
  packet(12, { reason: 8, totalRoundsPlayed: 1 }, ['round_end'])
  expect(packet(13, { reason: 8, totalRoundsPlayed: 1 }, ['round_officially_ended'])).toEqual([])
  expect(packet(14, { warmup: true, started: false })).toEqual([{ type: 'reset' }])
  expect(retained).toEqual([])
  packet(20, {}, ['round_start'])
  packet(21, {}, ['round_freeze_end'])
  packet(22, { reason: 8, totalRoundsPlayed: 1 }, ['round_end'])
  packet(23, { totalRoundsPlayed: 1 }, ['round_start'])
  expect(retained).toMatchObject([
    { type: 'round', round: { number: 1, startTick: 20, endTick: 23 } },
  ])
  packet(24, { totalRoundsPlayed: 1 }, ['round_freeze_end'])
  expect(packet(25, { started: false, totalRoundsPlayed: 1 })).toEqual([{ type: 'reset' }])
  expect(retained).toEqual([])
  expect(packet(30, {}, ['round_start'])).toEqual([
    { type: 'round-start', number: 1, startTick: 30 },
  ])
  packet(31, {}, ['round_freeze_end'])
  packet(32, { reason: 8, totalRoundsPlayed: 1 }, ['round_end'])
  const [completed] = packet(33, { totalRoundsPlayed: 1 }, ['round_start'])
  expect(completed).toEqual({
    type: 'round',
    round: {
      number: 1,
      overtime: 0,
      resultTick: 32,
      startTick: 30,
      liveStartTick: 31,
      endTick: 33,
      tickInterval: 1 / 64,
      players: [{ steamId: '76561198201620490', name: 'broky' }],
      ticks: new Uint32Array([30, 31, 32]),
      positions: new Float32Array([30, 20, 30, 31, 20, 30, 32, 20, 30]),
      alive: new Uint8Array([1, 1, 1]),
      inspection: [
        [
          {
            tick: 30,
            money: 800,
            armour: 0,
            helmet: false,
            grenades: [],
            weapon: { type: 'none' },
          },
        ],
      ],
      bomb: [{ tick: 30, state: { type: 'inactive' as const } }],
      bombEvents: [],
      deaths: [],
      health: new Int32Array([100, 100, 100]),
      yaw: new Float32Array([90, 90, 90]),
      teams: new Uint8Array([2, 2, 2]),
    },
  })
  expect(packet(34, {}, ['round_start'])).toEqual([
    { type: 'reset' },
    { type: 'round-start', number: 1, startTick: 34 },
  ])
  expect(retained).toEqual([])
})

test('captures overtime freeze time and postmatch activity without a regulation round cap', () => {
  const completed = [
    { totalRoundsPlayed: 24, overtime: 1 },
    { totalRoundsPlayed: 30, overtime: 2 },
  ].map((input) => {
    const tracker = createRoundTracker()
    const events: ReplayEvent[] = []
    function packet(tick: number, changes: Partial<RoundRules>, names: string[] = []) {
      events.push(...tracker.update(tick, { ...rules, ...input, ...changes }, names, 1 / 64))
      if (tracker.recording)
        tracker.sample(tick, [
          {
            steamId: '76561198201620490',
            name: 'broky',
            team: 3,
            x: tick,
            y: 20,
            z: 30,
            alive: tick < 105,
            health: tick < 105 ? 100 : 0,
            yaw: 90,
            money: 800,
            armour: 0,
            helmet: false,
            grenades: [],
            weapon: { type: 'none' },
          },
        ])
      tracker.bomb(tick, { type: 'inactive' })
    }
    packet(100, {}, ['round_start'])
    packet(102, {}, ['round_freeze_end'])
    const final = {
      started: false,
      phase: 5,
      reason: 9,
      totalRoundsPlayed: input.totalRoundsPlayed + 1,
    }
    packet(105, final)
    packet(106, final, ['round_officially_ended'])
    packet(109, final)
    expect(events).toEqual([
      { type: 'round-start', number: input.totalRoundsPlayed + 1, startTick: 100 },
    ])
    return tracker.end(110)
  })
  const expected = {
    startTick: 100,
    liveStartTick: 102,
    resultTick: 105,
    endTick: 110,
    tickInterval: 1 / 64,
    players: [{ steamId: '76561198201620490', name: 'broky' }],
    ticks: new Uint32Array([100, 102, 105, 106, 109]),
    positions: new Float32Array([100, 20, 30, 102, 20, 30, 105, 20, 30, 106, 20, 30, 109, 20, 30]),
    alive: new Uint8Array([1, 1, 0, 0, 0]),
    inspection: [
      [{ tick: 100, money: 800, armour: 0, helmet: false, grenades: [], weapon: { type: 'none' } }],
    ],
    bomb: [{ tick: 100, state: { type: 'inactive' as const } }],
    bombEvents: [],
    deaths: [],
    health: new Int32Array([100, 100, 0, 0, 0]),
    yaw: new Float32Array([90, 90, 90, 90, 90]),
    teams: new Uint8Array([3, 3, 3, 3, 3]),
  }
  expect(completed).toEqual([
    [{ type: 'round', round: { ...expected, number: 25, overtime: 1 } }],
    [{ type: 'round', round: { ...expected, number: 31, overtime: 2 } }],
  ])
})
