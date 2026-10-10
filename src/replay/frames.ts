import type { FlashState, ReplayRound } from './types.ts'

/** Index of the first player state in the sample at `tick`; add a player index to address one. */
export function frameAt(round: Pick<ReplayRound, 'ticks' | 'players'>, tick: number): number {
  return sampleAtTick(round.ticks, tick) * round.players.length
}

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

export function flashRemaining(flash: FlashState, tick: number, tickInterval: number): number {
  return flash.type === 'none'
    ? 0
    : Math.max(0, flash.durationSeconds - (tick - flash.startTick) * tickInterval)
}
