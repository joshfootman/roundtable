import { examples, type ExampleId } from '../demo/examples.ts'
import { frameAt } from './frames.ts'
import type { ReplayRound } from './types.ts'

export type TeamIdentity = { name: string; logo?: string }

type HalftimeRound = Pick<
  ReplayRound,
  'number' | 'overtime' | 'teamNames' | 'players' | 'ticks' | 'teams' | 'liveStartTick'
>

export function halftimeBefore(
  previous: HalftimeRound | undefined,
  current: HalftimeRound,
): boolean {
  if (!previous || current.number !== previous.number + 1 || previous.overtime || current.overtime)
    return false

  const names = [
    previous.teamNames?.ct,
    previous.teamNames?.t,
    current.teamNames?.ct,
    current.teamNames?.t,
  ].map((name) => name?.trim().toLowerCase())
  if (names.every(Boolean)) {
    return names[0] !== names[1] && names[0] === names[3] && names[1] === names[2]
  }

  const previousOffset = frameAt(previous, previous.liveStartTick)
  const currentOffset = frameAt(current, current.liveStartTick)
  const previousSides = new Map(
    previous.players.map((player, index) => [
      player.steamId,
      previous.teams[previousOffset + index],
    ]),
  )
  const sides = new Set<number>()
  for (const [index, player] of current.players.entries()) {
    const before = previousSides.get(player.steamId)
    const after = current.teams[currentOffset + index]
    if ((before !== 2 && before !== 3) || (after !== 2 && after !== 3)) continue
    if (before === after) return false
    sides.add(before)
  }
  return sides.size === 2
}

const recordedNames: Record<string, string> = {
  FaZe: 'FaZe Clan',
  Spirit: 'Team Spirit',
}

export function roundTeams(
  round: Pick<ReplayRound, 'teamNames'>,
  example?: ExampleId,
): Record<'ct' | 't', TeamIdentity> {
  function identity(side: 'ct' | 't'): TeamIdentity {
    const name = round.teamNames?.[side]?.trim()
    if (!name) return { name: side.toUpperCase() }
    const curated =
      example &&
      examples[example].teams.find(
        (team) => (recordedNames[team.name] ?? team.name).toLowerCase() === name.toLowerCase(),
      )
    return { name, ...(curated ? { logo: curated.logo } : {}) }
  }
  return { ct: identity('ct'), t: identity('t') }
}
