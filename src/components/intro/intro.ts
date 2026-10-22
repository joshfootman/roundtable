import type { ExampleId } from '#/demo/examples'
import type { ReadyImportState } from '#/demo/session'
import type { MapDefinition } from '#/replay/maps'
import { playerCardsAtTick, type PlayerCardData } from '#/replay/player-cards'
import { roundTeams } from '#/replay/team-identity'
import type { ReplayRound } from '#/replay/types'

export type IntroCast = {
  map: { name: string; photo: string }
  title: string
  lineup?: { ct: IntroTeam; t: IntroTeam }
}
export type IntroTeam = { name: string; logo?: string; players: PlayerCardData[] }

/**
 * The page a side switch wipes on with, before the handoff rebuilds the HUD on the new sides: the
 * teams as the half they played ended.
 */
export type SwitchCast = {
  headline: string
  lineup: Record<'ct' | 't', IntroTeam & { score?: number }>
}

export const beats = ['map', 'ct', 't', 'handoff'] as const
export type IntroBeat = (typeof beats)[number]
type LaterBeat = Exclude<IntroBeat, 'map'> | 'switch'
const nextBeat: Record<LaterBeat, LaterBeat | 'done'> = {
  ct: 't',
  t: 'handoff',
  switch: 'handoff',
  handoff: 'done',
}

export type IntroState =
  | { phase: 'map'; mapShown: boolean; lineupReady: boolean }
  | { phase: LaterBeat }
  | { phase: 'done' }
export type IntroEvent = 'map-shown' | 'lineup-ready' | 'beat-shown' | 'skip' | 'switch-sides'

export function startIntro(): IntroState {
  return introEnabled() ? { phase: 'map', mapShown: false, lineupReady: false } : { phase: 'done' }
}

export function advanceIntro(state: IntroState, event: IntroEvent): IntroState {
  if (state.phase === 'done') return event === 'switch-sides' ? { phase: 'switch' } : state
  if (event === 'skip') return { phase: 'done' }
  if (state.phase === 'map') {
    const mapShown = state.mapShown || event === 'map-shown'
    const lineupReady = state.lineupReady || event === 'lineup-ready'
    return mapShown && lineupReady ? { phase: 'ct' } : { phase: 'map', mapShown, lineupReady }
  }
  if (event !== 'beat-shown') return state
  return { phase: nextBeat[state.phase] }
}

// Matches the theater variant in styles.css: the intro plays over the risen stage only.
export function introEnabled(): boolean {
  return (
    matchMedia('(min-width: 1024px) and (min-height: 700px)').matches &&
    CSS.supports('clip-path', 'shape(from 0 0, hline to 0)') &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches &&
    localStorage.getItem('roundtable.intro') !== 'off'
  )
}

export function switchCast(
  rounds: readonly ReplayRound[],
  outgoing: ReplayRound,
  round: ReplayRound,
  example: ExampleId | undefined,
): SwitchCast {
  const lineup = lineupAt(rounds, outgoing, outgoing.endTick, example)
  const score = (side: 'ct' | 't') =>
    outgoing.score && outgoing.score[side] + Number(outgoing.outcome?.winner === side)
  return {
    headline: round.overtime ? `Overtime ${round.overtime}` : 'Halftime',
    lineup: {
      ct: { ...lineup.ct, score: score('ct') },
      t: { ...lineup.t, score: score('t') },
    },
  }
}

function mapPhoto(map: MapDefinition, mapName: string) {
  return { name: map.name, photo: `/images/maps/${mapName.replace(/^de_/, '')}.avif` }
}

export function introCast(
  demo: ReadyImportState,
  map: MapDefinition,
  example: ExampleId | undefined,
): IntroCast {
  const round = demo.rounds.find((round) => round.startTick === demo.selectedStartTick)
  const cast: IntroCast = {
    map: mapPhoto(map, demo.metadata.mapName),
    // Exactly as the header names the demo.
    title: demo.filename,
  }
  if (!round) return cast
  // Who is on each side as the round goes live.
  return { ...cast, lineup: lineupAt(demo.rounds, round, round.liveStartTick, example) }
}

/** Each side's players at a tick, numbered as the HUD numbers them. */
function lineupAt(
  rounds: readonly ReplayRound[],
  round: ReplayRound,
  tick: number,
  example: ExampleId | undefined,
): { ct: IntroTeam; t: IntroTeam } {
  const players = playerCardsAtTick(rounds, round, tick)
  const teams = roundTeams(round, example)
  const team = (side: 'ct' | 't', id: 2 | 3): IntroTeam => ({
    name: teams[side].name,
    logo: teams[side].logo,
    players: players.filter((player) => player.team === id).sort((a, b) => a.number - b.number),
  })
  return { ct: team('ct', 3), t: team('t', 2) }
}
