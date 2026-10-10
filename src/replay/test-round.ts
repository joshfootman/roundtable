import { mapPlayerTracks, playerTrackLayout, type PlayerTracks } from './tracks'
import type { ReplayRound } from './types'

/**
 * A complete round for tests. Event lists start empty and player tracks are sized from
 * `ticks` and `players`, with everyone present and alive at full health.
 */
export function testRound(overrides: Partial<ReplayRound> = {}): ReplayRound {
  const ticks = overrides.ticks ?? new Uint32Array([0])
  const players = overrides.players ?? []
  const states = ticks.length * players.length
  const fill: Partial<Record<keyof PlayerTracks, number>> = { present: 1, alive: 1, health: 100 }
  const startTick = overrides.startTick ?? ticks[0] ?? 0
  const endTick = overrides.endTick ?? ticks.at(-1) ?? startTick
  return {
    number: 1,
    overtime: 0,
    startTick,
    liveStartTick: startTick,
    resultTick: endTick,
    endTick,
    tickInterval: 1 / 64,
    players,
    ticks,
    ...(mapPlayerTracks((name) => {
      const { type, width } = playerTrackLayout[name]
      return type.from(Array.from({ length: states * width }, () => fill[name] ?? 0))
    }) as PlayerTracks),
    deaths: [],
    damage: [],
    inspection: players.map(() => []),
    bomb: [{ tick: startTick, state: { type: 'inactive' } }],
    bombEvents: [],
    projectiles: [],
    detonations: [],
    droppedItems: [],
    shots: [],
    fires: [],
    smokes: [],
    ...overrides,
  }
}
