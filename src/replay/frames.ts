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
