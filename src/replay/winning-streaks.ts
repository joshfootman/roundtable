import { frameAt } from './frames'
import type { ReplayRound } from './types'

type Side = 'ct' | 't'
export const winningStreakThreshold = 5

function roster(round: ReplayRound, side: Side): Set<string> {
  const offset = frameAt(round, round.liveStartTick)
  return new Set(
    round.players.flatMap((player, index) =>
      player.steamId && round.teams[offset + index] === (side === 'ct' ? 3 : 2)
        ? [player.steamId]
        : [],
    ),
  )
}

function correspondingSide(
  current: ReplayRound,
  side: Side,
  previous: ReplayRound,
): Side | undefined {
  const members = roster(current, side)
  if ([...members].some((member) => roster(current, side === 'ct' ? 't' : 'ct').has(member)))
    return undefined
  const before = { ct: roster(previous, 'ct'), t: roster(previous, 't') }
  if (members.size && (before.ct.size || before.t.size)) {
    const matches = (['ct', 't'] as const).filter((candidate) =>
      [...members].some((member) => before[candidate].has(member)),
    )
    return matches.length === 1 ? matches[0] : undefined
  }
  const names = [
    current.teamNames?.ct,
    current.teamNames?.t,
    previous.teamNames?.ct,
    previous.teamNames?.t,
  ].map((name) => name?.trim().toLowerCase())
  if (!names.every(Boolean) || names[0] === names[1] || names[2] === names[3]) return undefined
  const name = names[side === 'ct' ? 0 : 1]
  return name === names[2] ? 'ct' : name === names[3] ? 't' : undefined
}

export function roundWinningStreaks(
  rounds: readonly ReplayRound[],
  current: ReplayRound,
  tick: number,
): Record<Side, number> {
  const streaks = { ct: 0, t: 0 }
  if (tick >= current.resultTick && !current.outcome) return streaks
  const byNumber = new Map(
    rounds.filter((round) => round.number <= current.number).map((round) => [round.number, round]),
  )
  for (const currentSide of ['ct', 't'] as const) {
    let round = current
    let side: Side | undefined = currentSide
    if (tick < current.resultTick || !current.outcome) {
      const previous = byNumber.get(current.number - 1)
      if (!previous) continue
      side = correspondingSide(current, side, previous)
      round = previous
    }
    while (side && round.outcome?.winner === side) {
      streaks[currentSide]++
      const previous = byNumber.get(round.number - 1)
      if (!previous) break
      side = correspondingSide(round, side, previous)
      round = previous
    }
  }
  return streaks
}
