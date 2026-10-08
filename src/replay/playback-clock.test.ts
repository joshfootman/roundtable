import { describe, expect, it } from 'vitest'
import { createPlaybackClock, type PlaybackMovement, type PlaybackSnapshot } from './playback-clock'

function setup(initialTick = 100) {
  const published: PlaybackSnapshot[] = []
  const drawn: number[] = []
  const running: boolean[] = []
  const movements: PlaybackMovement[] = []
  const clock = createPlaybackClock({
    initialTick,
    minimum: 100,
    maximum: 200,
    tickInterval: 0.01,
    draw: (tick) => drawn.push(tick),
    publish: (snapshot) => published.push(snapshot),
    setRunning: (value) => running.push(value),
    onMove: (movement) => movements.push(movement),
  })
  return { clock, published, drawn, running, movements }
}

describe('playback clock', () => {
  it('reports a playback crossing before a throttled snapshot or final pause', () => {
    const { clock, movements, published, running } = setup()
    clock.play()
    clock.advance(100)
    expect(movements).toEqual([{ from: 100, to: 110, cause: 'advance' }])
    expect(published).toHaveLength(1)
    clock.advance(2000)
    expect(movements.at(-1)).toEqual({ from: 110, to: 200, cause: 'advance' })
    expect(clock.getSnapshot()).toEqual({ playing: false, tick: 200 })
    expect(published.at(-1)).toEqual({ playing: false, tick: 200 })
    expect(running.at(-1)).toBe(false)
  })

  it('distinguishes seek and restart from a natural result crossing', () => {
    const { clock, movements, published, running } = setup()
    clock.seek(180)
    clock.play()
    clock.advance(200)
    clock.play()
    expect(movements).toEqual([
      { from: 100, to: 180, cause: 'seek' },
      { from: 180, to: 200, cause: 'advance' },
      { from: 200, to: 100, cause: 'restart' },
    ])
    expect(published.at(-1)).toEqual({ playing: true, tick: 100 })
    expect(running.at(-1)).toBe(true)
    clock.seek(100)
    expect(movements.at(-1)).toEqual({ from: 100, to: 100, cause: 'seek' })
  })

  it('retains fractional ticks while publishing whole ticks every 250ms', () => {
    const { clock, published, drawn } = setup()
    clock.advance(100)
    expect(clock.getSnapshot()).toEqual({ playing: false, tick: 100 })
    expect(drawn).toEqual([])
    clock.play()
    clock.advance(7)
    clock.advance(7)
    expect(clock.getSnapshot()).toEqual({ playing: true, tick: 101 })
    expect(drawn.at(-1)).toBeCloseTo(101.4)
    expect(published).toEqual([{ playing: true, tick: 100 }])
    clock.advance(236)
    expect(published.at(-1)).toEqual({ playing: true, tick: 125 })
  })

  it('pauses at the current position and resumes without losing time', () => {
    const { clock, published, running } = setup()
    clock.play()
    clock.advance(150)
    clock.pause()
    clock.advance(500)
    expect(published.at(-1)).toEqual({ playing: false, tick: 115 })
    clock.play()
    clock.advance(100)
    expect(clock.getSnapshot()).toEqual({ playing: true, tick: 125 })
    expect(running).toEqual([true, false, true])
  })

  it('clamps seeking and publishes immediately while retaining playing state', () => {
    const { clock, published } = setup()
    clock.seek(0)
    expect(published.at(-1)).toEqual({ playing: false, tick: 100 })
    clock.play()
    clock.seek(170)
    expect(published.at(-1)).toEqual({ playing: true, tick: 170 })
    clock.seek(300)
    expect(published.at(-1)).toEqual({ playing: false, tick: 200 })
  })

  it('preserves legacy freeze start until play or minimum changes', () => {
    const { clock, published } = setup(50)
    clock.pause()
    expect(published.at(-1)).toEqual({ playing: false, tick: 50 })
    clock.setMinimum(40)
    expect(published.at(-1)).toEqual({ playing: false, tick: 50 })
    clock.setMinimum(100)
    expect(published.at(-1)).toEqual({ playing: false, tick: 100 })
    const legacy = setup(50)
    legacy.clock.play()
    expect(legacy.clock.getSnapshot()).toEqual({ playing: true, tick: 100 })
  })
})
