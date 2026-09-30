import type { ReplayRound, BombState } from './types.ts'

export function sampleAtTick(ticks: Uint32Array, tick: number): number {
  let low = 0
  let high = ticks.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (ticks[middle]! <= tick) low = middle + 1
    else high = middle
  }
  return Math.max(0, low - 1)
}

export function recordAtTick<T extends { tick: number }>(track: readonly T[], tick: number): T {
  let low = 0
  let high = track.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (track[middle]!.tick <= tick) low = middle + 1
    else high = middle
  }
  return track[Math.max(0, low - 1)]!
}

export function bombPosition(round: ReplayRound, state: BombState, sample: number) {
  if (state.type === 'inactive') return undefined
  if (state.type !== 'carried') return { x: state.x, y: state.y, z: state.z }
  const player = round.players.findIndex((player) => player.steamId === state.carrier)
  const offset = (sample * round.players.length + player) * 3
  return {
    x: round.positions[offset]!,
    y: round.positions[offset + 1]!,
    z: round.positions[offset + 2]!,
  }
}
