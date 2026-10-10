// Longer gaps (a hidden tab, a stall) advance by this much instead of jumping ahead.
const maxFrameMS = 100

/** A requestAnimationFrame loop reporting elapsed time per frame, independent of any renderer. */
export function createFrameLoop(onFrame: (elapsedMS: number) => void) {
  let handle: number | undefined
  let last = 0
  function frame(now: number) {
    const elapsed = Math.min(maxFrameMS, now - last)
    last = now
    handle = requestAnimationFrame(frame)
    onFrame(elapsed)
  }
  return {
    get running() {
      return handle !== undefined
    },
    start() {
      if (handle !== undefined) return
      last = performance.now()
      handle = requestAnimationFrame(frame)
    },
    stop() {
      if (handle !== undefined) cancelAnimationFrame(handle)
      handle = undefined
    },
  }
}
