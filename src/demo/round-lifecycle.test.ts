import { expect, test } from 'vitest'
import { createRoundTracker, type ReplayEvent, type RoundRules } from './round-lifecycle'

const rules: RoundRules = {
  warmup: false,
  started: true,
  totalRoundsPlayed: 0,
  reason: 0,
  phase: 2,
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
        },
      ])
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
      startTick: 30,
      liveStartTick: 31,
      endTick: 33,
      tickInterval: 1 / 64,
      players: [{ steamId: '76561198201620490', name: 'broky', team: 2 }],
      ticks: new Uint32Array([30, 31, 32]),
      positions: new Float32Array([30, 20, 30, 31, 20, 30, 32, 20, 30]),
      alive: new Uint8Array([1, 1, 1]),
    },
  })
  expect(packet(34, {}, ['round_start'])).toEqual([
    { type: 'reset' },
    { type: 'round-start', number: 1, startTick: 34 },
  ])
  expect(retained).toEqual([])
})
