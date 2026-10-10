import { flashRemaining, recordAtTick, sampleAtTick } from './frames'
import type { PlayerInspection, ReplayRound } from './types'

/** What a player is doing with the bomb at this moment. */
export type BombRole = 'none' | 'carrying' | 'planting' | 'defusing'

/** One player in world space, independent of how the scene is drawn. */
export interface ScenePlayer {
  index: number
  steamId: string
  team: number
  present: boolean
  alive: boolean
  health: number
  x: number
  y: number
  z: number
  /** Degrees, as recorded. */
  yaw: number
  pitch: number
  inspection: PlayerInspection
  flashSeconds: number
  bomb: BombRole
}

// Movement faster than this between consecutive samples is a teleport, not motion.
const teleportUnits = 128

/**
 * Players at a possibly fractional tick. Position and facing blend toward the next sample,
 * except across a death, respawn, team change, disconnect or teleport, where the
 * earlier sample holds.
 */
export function scenePlayers(round: ReplayRound, tick: number): ScenePlayer[] {
  const sample = sampleAtTick(round.ticks, tick)
  const next = Math.min(sample + 1, round.ticks.length - 1)
  const from = round.ticks[sample]!
  const to = round.ticks[next]!
  const blend = to > from ? Math.min(1, Math.max(0, (tick - from) / (to - from))) : 0
  const count = round.players.length
  const bomb = recordAtTick(round.bomb, tick)?.state
  return round.players.map(({ steamId }, index) => {
    const a = sample * count + index
    const b = next * count + index
    const x = round.positions[a * 3]!
    const y = round.positions[a * 3 + 1]!
    const z = round.positions[a * 3 + 2]!
    const dx = round.positions[b * 3]! - x
    const dy = round.positions[b * 3 + 1]! - y
    const dz = round.positions[b * 3 + 2]! - z
    const t =
      blend > 0 &&
      round.alive[a] === round.alive[b] &&
      round.teams[a] === round.teams[b] &&
      round.present[a] === round.present[b] &&
      dx * dx + dy * dy + dz * dz < teleportUnits * teleportUnits
        ? blend
        : 0
    const alive = round.alive[a] === 1
    const inspection = recordAtTick(round.inspection[index]!, tick)
    const carrying = bomb?.type === 'carried' && bomb.carrier === steamId
    return {
      index,
      steamId,
      team: round.teams[a]!,
      present: round.present[a] === 1,
      alive,
      health: round.health[a]!,
      x: x + dx * t,
      y: y + dy * t,
      z: z + dz * t,
      yaw: lerpDegrees(round.yaw[a]!, round.yaw[b]!, t),
      pitch: round.pitch[a]! + (round.pitch[b]! - round.pitch[a]!) * t,
      inspection,
      flashSeconds: flashRemaining(inspection.flash, tick, round.tickInterval),
      bomb: carrying
        ? bomb.planting
          ? 'planting'
          : 'carrying'
        : bomb?.type === 'planted' &&
            bomb.defuser.type === 'player' &&
            bomb.defuser.steamId === steamId
          ? 'defusing'
          : 'none',
    }
  })
}

/** Blend two headings along the shorter arc. */
export function lerpDegrees(from: number, to: number, t: number): number {
  const delta = ((((to - from) % 360) + 540) % 360) - 180
  return from + delta * t
}
