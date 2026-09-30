import type { ReplayRound } from './types.ts'

export function replayBuffers(round: ReplayRound): ArrayBuffer[] {
  return [
    round.ticks.buffer,
    round.positions.buffer,
    round.alive.buffer,
    round.health.buffer,
    round.yaw.buffer,
    round.teams.buffer,
    ...round.projectiles.flatMap((projectile) => [
      projectile.ticks.buffer,
      projectile.positions.buffer,
    ]),
  ]
}
