import { playerTrackNames } from './tracks.ts'
import type { ReplayRound } from './types.ts'

export function replayBuffers(round: ReplayRound): ArrayBuffer[] {
  return [
    round.ticks.buffer,
    ...playerTrackNames.map((name) => round[name].buffer),
    ...round.projectiles.flatMap((projectile) => [
      projectile.ticks.buffer,
      projectile.positions.buffer,
    ]),
  ]
}
