import type { ReplayRound } from './types'

// Measured across the bundled demos: plants take 3.125 to 3.19 s, every bomb explodes 41 s after
// it is planted, and defuses take 5 s with a kit or 10 s without. Only an attempt that never
// finishes falls back to these.
const PLANT_SECONDS = 3.125
const FUSE_SECONDS = 41
const DEFUSE_SECONDS = 10

export interface BombTimer {
  kind: 'plant' | 'fuse' | 'defuse'
  start: number
  /** Tick the timer would run out on. */
  end: number
  /** Tick the timer stopped on: its end, or earlier when aborted, defused or exploded. */
  stop: number
}

export interface ActiveBombTimers {
  bomb?: { kind: 'plant' | 'fuse'; progress: number }
  defuse?: number
}

export function bombTimers({
  bombEvents,
  tickInterval,
}: Pick<ReplayRound, 'bombEvents' | 'tickInterval'>): BombTimer[] {
  const ticks = (seconds: number) => Math.round(seconds / tickInterval)
  // A player's finished defuse shows whether they carry a kit, which also times their aborted taps.
  const defuseLength = new Map<string, number>()
  const started = new Map<string, number>()
  for (const event of bombEvents) {
    if (event.type === 'defuse-start') started.set(event.player, event.tick)
    if (event.type === 'defused' && started.has(event.player))
      defuseLength.set(event.player, event.tick - started.get(event.player)!)
  }

  const timers: BombTimer[] = []
  const open = (kind: BombTimer['kind'], tick: number) =>
    timers.filter((timer) => timer.kind === kind && timer.stop > tick).at(-1)
  const start = (kind: BombTimer['kind'], tick: number, length: number) =>
    timers.push({ kind, start: tick, end: tick + length, stop: tick + length })
  const stop = (kind: BombTimer['kind'], tick: number, finished: boolean) => {
    const timer = open(kind, tick)
    if (!timer) return
    timer.stop = tick
    if (finished) timer.end = tick
  }

  for (const event of bombEvents) {
    switch (event.type) {
      case 'plant-start':
        start('plant', event.tick, ticks(PLANT_SECONDS))
        break
      case 'plant-abort':
        stop('plant', event.tick, false)
        break
      case 'planted':
        stop('plant', event.tick, true)
        start('fuse', event.tick, ticks(FUSE_SECONDS))
        break
      case 'defuse-start':
        start('defuse', event.tick, defuseLength.get(event.player) ?? ticks(DEFUSE_SECONDS))
        break
      case 'defuse-abort':
        stop('defuse', event.tick, false)
        break
      case 'defused':
        stop('defuse', event.tick, true)
        stop('fuse', event.tick, false)
        break
      case 'exploded':
        stop('fuse', event.tick, true)
        stop('defuse', event.tick, false)
        break
    }
  }
  return timers
}

export function activeBombTimers(timers: readonly BombTimer[], tick: number): ActiveBombTimers {
  const active = (kind: BombTimer['kind']) =>
    timers.find((timer) => timer.kind === kind && timer.start <= tick && tick < timer.stop)
  const progress = (timer: BombTimer) => (tick - timer.start) / (timer.end - timer.start)
  const plant = active('plant')
  const fuse = active('fuse')
  const defuse = active('defuse')
  return {
    bomb: plant
      ? { kind: 'plant', progress: progress(plant) }
      : fuse && { kind: 'fuse', progress: progress(fuse) },
    defuse: defuse && progress(defuse),
  }
}
