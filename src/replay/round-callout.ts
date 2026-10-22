import type { ReplayRound } from './types.ts'

export type RoundCallout =
  | { kind: 'round'; number: number }
  | { kind: 'win'; side: 'ct' | 't'; team: string }

export function winCallout(outcome: NonNullable<ReplayRound['outcome']>): RoundCallout {
  const team = outcome.teamName?.trim() || outcome.winner.toUpperCase()
  return { kind: 'win', side: outcome.winner, team }
}
