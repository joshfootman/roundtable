import { frameAt } from './frames'
import type { ReplayRound } from './types'

export function playerNumbers(round: ReplayRound): ReadonlyMap<string, number> {
  const numbers = new Map<string, number>()
  const next = { 3: 1, 2: 6 }
  const offset = frameAt(round, round.liveStartTick)
  // Players present when the round goes live number first; later joiners follow on their team.
  const order = round.players
    .map((player, index) => ({ player, index, late: !round.present[offset + index] }))
    .sort((a, b) => Number(a.late) - Number(b.late))
  for (const { player, index } of order) {
    const team = round.teams[offset + index]
    if (team === 2 || team === 3) numbers.set(player.steamId, next[team]++)
  }
  return numbers
}
