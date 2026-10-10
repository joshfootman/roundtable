import { afterEach, expect, test, vi } from 'vitest'
import { createFrameLoop } from './frame-loop'

afterEach(() => vi.unstubAllGlobals())

test('reports elapsed time per frame, caps stalls and stops cleanly', () => {
  const frames: FrameRequestCallback[] = []
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback))
  vi.stubGlobal('cancelAnimationFrame', () => frames.splice(0))
  vi.spyOn(performance, 'now').mockReturnValue(1000)
  const elapsed: number[] = []
  const loop = createFrameLoop((ms) => elapsed.push(ms))
  loop.start()
  loop.start()
  expect(frames).toHaveLength(1)
  frames.shift()!(1016)
  frames.shift()!(6016)
  expect(elapsed).toEqual([16, 100])
  loop.stop()
  expect([loop.running, frames.length]).toEqual([false, 0])
})
