import { sampleAtTick } from './frames'
import type { ReplayRound } from './types'

export function playerNumbers(round: ReplayRound): ReadonlyMap<string, number> {
  const numbers = new Map<string, number>()
  const next = { 3: 1, 2: 6 }
  const offset = sampleAtTick(round.ticks, round.liveStartTick) * round.players.length
  round.players.forEach((player, index) => {
    const team = round.teams[offset + index]
    if (team === 2 || team === 3) numbers.set(player.steamId, next[team]++)
  })
  return numbers
}
