import { expect, test } from 'vitest'
import { createRoundTracker, type ReplayEvent, type RoundRules } from './round-lifecycle'

const rules: RoundRules = {
  warmup: false,
  freezePeriod: true,
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
          flash: { type: 'none' as const },
          grenades: [],
          weapons: [],
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
  expect(packet(14, { warmup: true, started: false })).toEqual([{ type: 'reset', after: 0 }])
  expect(retained).toEqual([])
  packet(20, {}, ['round_start'])
  packet(21, {}, ['round_freeze_end'])
  packet(22, { reason: 8, totalRoundsPlayed: 1 }, ['round_end'])
  packet(23, { totalRoundsPlayed: 1 }, ['round_start'])
  expect(retained).toMatchObject([
    { type: 'round', round: { number: 1, startTick: 20, endTick: 23 } },
  ])
  packet(24, { totalRoundsPlayed: 1 }, ['round_freeze_end'])
  expect(packet(25, { started: false, totalRoundsPlayed: 1 })).toEqual([
    { type: 'reset', after: 0 },
  ])
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
            flash: { type: 'none' as const },
            grenades: [],
            weapons: [],
            weapon: { type: 'none' },
          },
        ],
      ],
      bomb: [{ tick: 30, state: { type: 'inactive' as const } }],
      droppedItems: [{ tick: 30, items: [] }],
      fires: [{ tick: 30, fires: [] }],
      shots: [],
      smokes: [],
      projectiles: [],
      detonations: [],
      bombEvents: [],
      deaths: [],
      health: new Int32Array([100, 100, 100]),
      yaw: new Float32Array([90, 90, 90]),
      teams: new Uint8Array([2, 2, 2]),
    },
  })
  expect(packet(34, {}, ['round_start'])).toEqual([
    { type: 'reset', after: 0 },
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
            flash: { type: 'none' as const },
            grenades: [],
            weapons: [],
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
      [
        {
          tick: 100,
          money: 800,
          armour: 0,
          helmet: false,
          flash: { type: 'none' as const },
          grenades: [],
          weapons: [],
          weapon: { type: 'none' },
        },
      ],
    ],
    bomb: [{ tick: 100, state: { type: 'inactive' as const } }],
    droppedItems: [{ tick: 100, items: [] }],
    fires: [{ tick: 100, fires: [] }],
    shots: [],
    smokes: [],
    projectiles: [],
    detonations: [],
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

test('captures an opening freeze checkpoint without inventing a midround start', () => {
  const openingRules = { ...rules, freezePeriod: true }
  const tracker = createRoundTracker()
  expect(tracker.update(100, openingRules, [], 1 / 64)).toEqual([
    { type: 'round-start', number: 1, startTick: 100 },
  ])
  for (const [tick, names, changes] of [
    [100, [], {}],
    [102, ['round_freeze_end'], { freezePeriod: false }],
    [105, ['round_end'], { freezePeriod: false, reason: 9, totalRoundsPlayed: 1 }],
  ] as const) {
    tracker.update(tick, { ...openingRules, ...changes }, [...names], 1 / 64)
    tracker.sample(tick, [
      {
        steamId: '76561198201620490',
        name: 'broky',
        team: 3,
        x: tick,
        y: 20,
        z: 30,
        alive: true,
        health: 100,
        yaw: 90,
        money: 800,
        armour: 0,
        helmet: false,
        flash: { type: 'none' },
        grenades: [],
        weapons: [],
        weapon: { type: 'none' },
      },
    ])
  }
  const events = tracker.update(
    110,
    { ...openingRules, totalRoundsPlayed: 1 },
    ['round_start'],
    1 / 64,
  )
  expect(
    events.map((event) =>
      event.type === 'round'
        ? {
            type: event.type,
            number: event.round.number,
            startTick: event.round.startTick,
            liveStartTick: event.round.liveStartTick,
            resultTick: event.round.resultTick,
            endTick: event.round.endTick,
            ticks: Array.from(event.round.ticks),
            positions: Array.from(event.round.positions),
          }
        : event,
    ),
  ).toEqual([
    {
      type: 'round',
      number: 1,
      startTick: 100,
      liveStartTick: 102,
      resultTick: 105,
      endTick: 110,
      ticks: [100, 102, 105],
      positions: [100, 20, 30, 102, 20, 30, 105, 20, 30],
    },
    { type: 'round-start', number: 2, startTick: 110 },
  ])
  const midround = createRoundTracker()
  expect(midround.update(100, { ...openingRules, freezePeriod: false }, [], 1 / 64)).toEqual([])
  expect(midround.recording).toBe(false)
})

test('records inventory and ladder changes while the held knife stays unchanged', () => {
  const tracker = createRoundTracker()
  tracker.update(100, rules, ['round_start'], 1 / 64)
  const player = {
    steamId: '77',
    onLadder: false,
    name: 'Player',
    team: 3 as const,
    x: 0,
    y: 0,
    z: 0,
    alive: true,
    health: 100,
    yaw: 0,
    money: 800,
    armour: 0,
    helmet: false,
    flash: { type: 'none' as const },
    grenades: [],
    weapon: { type: 'item' as const, definition: 42 },
  }
  const knife = { type: 'item' as const, definition: 42 }
  tracker.sample(100, [{ ...player, weapons: [knife] }])
  tracker.sample(101, [
    { ...player, weapons: [{ type: 'gun', definition: 7, magazine: 30, reserve: 90 }, knife] },
  ])
  tracker.sample(102, [
    { ...player, weapons: [{ type: 'gun', definition: 7, magazine: 29, reserve: 90 }, knife] },
  ])
  tracker.sample(103, [{ ...player, onLadder: true, weapons: [knife] }])
  tracker.sample(104, [{ ...player, weapons: [knife] }])
  tracker.update(105, { ...rules, freezePeriod: false }, ['round_freeze_end'], 1 / 64)
  tracker.update(106, { ...rules, reason: 8, totalRoundsPlayed: 1 }, ['round_end'], 1 / 64)
  const [event] = tracker.end(107)
  if (event?.type !== 'round') throw new Error('Missing completed round')
  expect(
    event.round.inspection[0]?.map(({ tick, weapon, weapons }) => ({ tick, weapon, weapons })),
  ).toEqual([
    {
      tick: 100,
      weapon: { type: 'item', definition: 42 },
      weapons: [{ type: 'item', definition: 42 }],
    },
    {
      tick: 101,
      weapon: { type: 'item', definition: 42 },
      weapons: [
        { type: 'gun', definition: 7, magazine: 30, reserve: 90 },
        { type: 'item', definition: 42 },
      ],
    },
    {
      tick: 102,
      weapon: { type: 'item', definition: 42 },
      weapons: [
        { type: 'gun', definition: 7, magazine: 29, reserve: 90 },
        { type: 'item', definition: 42 },
      ],
    },
    {
      tick: 103,
      weapon: { type: 'item', definition: 42 },
      weapons: [{ type: 'item', definition: 42 }],
    },
    {
      tick: 104,
      weapon: { type: 'item', definition: 42 },
      weapons: [{ type: 'item', definition: 42 }],
    },
  ])
  expect(event.round.inspection[0]?.map(({ tick, onLadder }) => ({ tick, onLadder }))).toEqual([
    { tick: 100, onLadder: false },
    { tick: 101, onLadder: false },
    { tick: 102, onLadder: false },
    { tick: 103, onLadder: true },
    { tick: 104, onLadder: false },
  ])
})

test('records movement, pickup, re-drop and entity reuse with one final snapshot per tick', () => {
  const tracker = createRoundTracker()
  tracker.update(10, rules, ['round_start'], 1 / 64)
  tracker.sample(10, [
    {
      steamId: '11',
      name: 'Player',
      team: 3,
      x: 1,
      y: 2,
      z: 3,
      alive: true,
      health: 100,
      yaw: 0,
      money: 800,
      armour: 0,
      helmet: false,
      flash: { type: 'none' },
      grenades: [],
      weapons: [],
      weapon: { type: 'none' },
    },
  ])
  tracker.bomb(10, { type: 'inactive' })
  const item = { entity: 3, serial: 5, definition: 7, x: 10, y: 20, z: 30 }
  tracker.droppedItems(10, [])
  tracker.droppedItems(11, [item])
  tracker.droppedItems(12, [item])
  tracker.droppedItems(13, [{ ...item, x: 11 }])
  tracker.droppedItems(14, [])
  tracker.droppedItems(15, [item])
  tracker.droppedItems(16, [{ ...item, serial: 6, definition: 9 }])
  tracker.droppedItems(16, [])
  tracker.droppedItems(17, [{ ...item, serial: 6, definition: 9 }])
  tracker.droppedItems(18, [item])
  tracker.droppedItems(18, [{ ...item, serial: 6, definition: 9 }])
  tracker.update(19, { ...rules, freezePeriod: false }, ['round_freeze_end'], 1 / 64)
  tracker.update(
    20,
    { ...rules, freezePeriod: false, reason: 8, totalRoundsPlayed: 1 },
    ['round_end'],
    1 / 64,
  )
  const [event] = tracker.end(21)
  if (event?.type !== 'round') throw new Error('Missing round')
  expect(event.round.droppedItems).toEqual([
    { tick: 10, items: [] },
    { tick: 11, items: [{ entity: 3, serial: 5, definition: 7, x: 10, y: 20, z: 30 }] },
    { tick: 13, items: [{ entity: 3, serial: 5, definition: 7, x: 11, y: 20, z: 30 }] },
    { tick: 14, items: [] },
    { tick: 15, items: [{ entity: 3, serial: 5, definition: 7, x: 10, y: 20, z: 30 }] },
    { tick: 16, items: [] },
    { tick: 17, items: [{ entity: 3, serial: 6, definition: 9, x: 10, y: 20, z: 30 }] },
  ])
})

test('keeps rounds before a backup restore and voids only the replayed ones', () => {
  const tracker = createRoundTracker()
  const published: number[] = []
  function packet(tick: number, changes: Partial<RoundRules>, events: string[] = []) {
    const output = tracker.update(tick, { ...rules, ...changes }, events, 1 / 64)
    for (const event of output) {
      if (event.type === 'reset') published.splice(event.after)
      else if (event.type === 'round') published.push(event.round.number)
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
          flash: { type: 'none' as const },
          grenades: [],
          weapons: [],
          weapon: { type: 'none' },
        },
      ])
    tracker.bomb(tick, { type: 'inactive' })
    return output
  }
  function playRound(start: number, played: number) {
    packet(start, { totalRoundsPlayed: played }, ['round_start'])
    packet(start + 1, { totalRoundsPlayed: played }, ['round_freeze_end'])
    packet(start + 2, { reason: 8, totalRoundsPlayed: played + 1 }, ['round_end'])
  }
  playRound(10, 0)
  playRound(20, 1)
  playRound(30, 2)
  packet(40, { totalRoundsPlayed: 3 }, ['round_start'])
  expect(published).toEqual([1, 2, 3])
  expect(packet(50, { totalRoundsPlayed: 1 }, ['round_start'])).toEqual([
    { type: 'reset', after: 1 },
    { type: 'round-start', number: 2, startTick: 50 },
  ])
  expect(published).toEqual([1])
})
