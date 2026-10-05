import { examples, type ExampleId } from '../demo/examples.ts'
import type { ReplayRound } from './types.ts'

export type TeamIdentity = { name: string; logo?: string }

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
