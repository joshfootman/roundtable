import type { ExampleId } from '#/demo/examples'
import type { ReadyImportState } from '#/demo/session'
import type { MapDefinition } from '#/replay/maps'
import { playerCardsAtTick, type PlayerCardData } from '#/replay/player-cards'
import { roundTeams } from '#/replay/team-identity'

export type IntroCast = {
  map: { name: string; photo: string }
  title: string
  lineup?: { ct: IntroTeam; t: IntroTeam }
}
export type IntroTeam = { tag: string; players: PlayerCardData[] }

export const beats = ['map', 'ct', 't', 'handoff'] as const
export type IntroBeat = (typeof beats)[number]
type LaterBeat = Exclude<IntroBeat, 'map'>
const laterBeats = beats.filter((beat): beat is LaterBeat => beat !== 'map')

export type IntroState =
  | { phase: 'map'; mapShown: boolean; lineupReady: boolean }
  | { phase: LaterBeat }
  | { phase: 'done' }
export type IntroEvent = 'map-shown' | 'lineup-ready' | 'beat-shown' | 'skip'

export function startIntro(): IntroState {
  return introEnabled() ? { phase: 'map', mapShown: false, lineupReady: false } : { phase: 'done' }
}

export function advanceIntro(state: IntroState, event: IntroEvent): IntroState {
  if (state.phase === 'done') return state
  if (event === 'skip') return { phase: 'done' }
  if (state.phase === 'map') {
    const mapShown = state.mapShown || event === 'map-shown'
    const lineupReady = state.lineupReady || event === 'lineup-ready'
    return mapShown && lineupReady
      ? { phase: laterBeats[0]! }
      : { phase: 'map', mapShown, lineupReady }
  }
  if (event !== 'beat-shown') return state
  const next = laterBeats[laterBeats.indexOf(state.phase) + 1]
  return next ? { phase: next } : { phase: 'done' }
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

export function introCast(
  demo: ReadyImportState,
  map: MapDefinition,
  example: ExampleId | undefined,
): IntroCast {
  const round = demo.rounds.find((round) => round.startTick === demo.selectedStartTick)
  const cast: IntroCast = {
    map: {
      name: map.name,
      photo: `/images/maps/${demo.metadata.mapName.replace(/^de_/, '')}.avif`,
    },
    // Exactly as the header names the demo.
    title: demo.filename,
  }
  if (!round) return cast
  // Who is on each side as the round goes live, numbered as the HUD numbers them.
  const players = playerCardsAtTick(demo.rounds, round, round.liveStartTick)
  const teams = roundTeams(round, example)
  const team = (side: 'ct' | 't', id: 2 | 3): IntroTeam => ({
    tag: teamTag(teams[side].name),
    players: players.filter((player) => player.team === id).sort((a, b) => a.number - b.number),
  })
  return { ...cast, lineup: { ct: team('ct', 3), t: team('t', 2) } }
}

const tags = new Map([
  ['faze clan', 'FAZE'],
  ['natus vincere', 'NAVI'],
  ['team spirit', 'SPIRIT'],
])

export function teamTag(name: string): string {
  return tags.get(name.toLowerCase()) ?? name.toUpperCase()
}
