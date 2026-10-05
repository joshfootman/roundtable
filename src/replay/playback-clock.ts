export interface PlaybackSnapshot {
  playing: boolean
  tick: number
}

export type PlaybackMovement = {
  from: number
  to: number
  cause: 'advance' | 'seek' | 'restart'
}

export interface PlaybackClock {
  play(): void
  pause(): void
  seek(tick: number): void
  setMinimum(tick: number): void
  advance(elapsedMS: number): void
  getSnapshot(): PlaybackSnapshot
}

export function createPlaybackClock({
  initialTick,
  minimum,
  maximum,
  tickInterval,
  draw,
  publish,
  setRunning,
  onMove,
}: {
  initialTick: number
  minimum: number
  maximum: number
  tickInterval: number
  draw: (tick: number) => void
  publish: (snapshot: PlaybackSnapshot) => void
  setRunning: (running: boolean) => void
  onMove?: (movement: PlaybackMovement) => void
}): PlaybackClock {
  let tick = initialTick
  let playing = false
  let unpublishedMS = 0

  function getSnapshot() {
    return { playing, tick: Math.floor(tick) }
  }

  function notify() {
    unpublishedMS = 0
    publish(getSnapshot())
  }

  function pause() {
    playing = false
    setRunning(false)
    draw(tick)
    notify()
  }

  return {
    getSnapshot,
    play() {
      if (tick < minimum || tick >= maximum) {
        const from = tick
        tick = minimum
        onMove?.({ from, to: tick, cause: 'restart' })
      }
      playing = true
      draw(tick)
      notify()
      setRunning(true)
    },
    pause,
    seek(nextTick) {
      const from = tick
      tick = Math.max(minimum, Math.min(maximum, nextTick))
      onMove?.({ from, to: tick, cause: 'seek' })
      if (tick === maximum) pause()
      else {
        draw(tick)
        notify()
      }
    },
    setMinimum(nextMinimum) {
      minimum = nextMinimum
      tick = Math.max(minimum, tick)
      draw(tick)
      notify()
    },
    advance(elapsedMS) {
      if (!playing) return
      const from = tick
      tick = Math.min(maximum, tick + elapsedMS / (tickInterval * 1000))
      onMove?.({ from, to: tick, cause: 'advance' })
      if (tick >= maximum) pause()
      else {
        draw(tick)
        unpublishedMS += elapsedMS
        if (unpublishedMS >= 250) notify()
      }
    },
  }
}
