import React from 'react'
import { playerTexture } from '#/components/DemoPlayerCards'
import {
  beats,
  type IntroBeat,
  type IntroCast,
  type IntroEvent,
  type IntroState,
  type IntroTeam,
  type SwitchCast,
} from './intro'
import './intro.css'

const modifiers = new Set(['Alt', 'Control', 'Meta', 'Shift'])
// The name's row and the rows either side of it, enough to fill the stage behind the players.
const wallRows = [-3, -2, -1, 0, 1, 2, 3, 4]
// Copies per row, centred so the middle one lines up over the name.
const rowCopies = 9

export function DemoIntro({
  cast,
  state,
  dispatch,
}: {
  cast: IntroCast | SwitchCast
  state: IntroState
  dispatch: (event: IntroEvent) => void
}) {
  const overlay = React.useRef<HTMLDivElement>(null)
  const photo = React.useRef<HTMLImageElement>(null)

  // The map beat starts once its photo can be drawn, so an uncached one never pops in partway.
  const opening = 'title' in cast
  // A side switch has no photo: it wipes on straight over the HUD.
  const [photoReady, setPhotoReady] = React.useState(!opening)
  React.useEffect(() => {
    if (!opening) return
    let current = true
    const ready = () => current && setPhotoReady(true)
    photo.current!.decode().then(ready, ready)
    return () => {
      current = false
    }
  }, [opening])

  const lineupReady = opening && cast.lineup !== undefined
  React.useEffect(() => {
    if (lineupReady) dispatch('lineup-ready')
  }, [lineupReady, dispatch])

  React.useEffect(() => {
    function skip(event: KeyboardEvent) {
      if (modifiers.has(event.key) || event.metaKey || event.ctrlKey || event.altKey) return
      // Keeps Space and the other replay shortcuts from acting on the HUD underneath.
      event.stopPropagation()
      dispatch('skip')
    }
    window.addEventListener('keydown', skip, true)
    return () => window.removeEventListener('keydown', skip, true)
  }, [dispatch])

  // A beat ends when everything on its page has finished, dwell included. The handoff has no
  // page: it waits for everything the intro animates on the stage, the overlay's wipe and the
  // HUD's build included, which are found by name.
  React.useEffect(() => {
    if (!photoReady) return
    const root = overlay.current!
    const animations =
      state.phase === 'handoff'
        ? root
            .parentElement!.getAnimations({ subtree: true })
            .filter(
              (animation) =>
                animation instanceof CSSAnimation && animation.animationName.startsWith('intro-'),
            )
        : (root.querySelector(`[data-page="${state.phase}"]`)?.getAnimations({ subtree: true }) ??
          [])
    let current = true
    void settled(animations).then(() => {
      if (current) dispatch(state.phase === 'map' ? 'map-shown' : 'beat-shown')
    })
    return () => {
      current = false
    }
  }, [state.phase, photoReady, dispatch])

  // Each page mounts when its beat starts. The next page's blade wipes it off as it wipes on, so
  // the photo underneath shows through both.
  const reached = beats.findIndex((beat) => beat === state.phase)
  const shown = (beat: IntroBeat) => beats.indexOf(beat) <= reached
  const covered = (beat: IntroBeat) => beats.indexOf(beat) < reached || undefined
  const lineup = opening ? cast.lineup : undefined

  return (
    <div
      ref={overlay}
      aria-hidden="true"
      data-phase={state.phase}
      data-kind={opening ? 'opening' : 'switch'}
      className="intro"
      onClick={() => dispatch('skip')}
    >
      {opening ? (
        <div className="intro-photo" data-ready={photoReady || undefined}>
          <img ref={photo} src={cast.map.photo} alt="" />
          <img src={cast.map.photo} alt="" className="intro-blur intro-blur-near" />
          <img src={cast.map.photo} alt="" className="intro-blur intro-blur-far" />
        </div>
      ) : (
        <SwitchPage cast={cast} />
      )}
      {photoReady && opening && (
        <div className="intro-page" data-page="map" data-covered={covered('map')}>
          <p className="intro-title">{cast.title}</p>
          <p className="intro-map-name">{cast.map.name}</p>
        </div>
      )}
      {lineup && shown('ct') && <TeamPage side="ct" team={lineup.ct} covered={covered('ct')} />}
      {lineup && shown('t') && <TeamPage side="t" team={lineup.t} covered={covered('t')} />}
      <div className="intro-skip rounded-control bg-control/75 px-4 py-2">
        <p>Click anywhere to skip</p>
      </div>
      {/*
        Rings the glyphs' combined shape. text-stroke outlines every contour, so Geist's
        overlapping strokes would show inside letters like F.
      */}
      <svg className="intro-filters" width="0" height="0">
        <filter id="intro-hollow">
          <feMorphology in="SourceGraphic" operator="dilate" radius="1" result="grown" />
          <feMorphology in="SourceAlpha" operator="erode" radius="1" result="shrunk" />
          <feComposite in="grown" in2="shrunk" operator="out" />
        </filter>
      </svg>
    </div>
  )
}

function TeamPage({
  side,
  team,
  covered,
}: {
  side: 'ct' | 't'
  team: IntroTeam
  covered: true | undefined
}) {
  return (
    <div
      className="intro-page"
      data-page={side}
      data-covered={covered}
      style={
        {
          '--intro-chars': team.name.length,
        } as React.CSSProperties
      }
    >
      <Wall text={team.name} />
      <ol className="intro-players">
        {team.players.map((player) => (
          <li key={player.steamId} className="intro-player frame-field">
            <span
              className="intro-player-art player-texture rounded-inset-2.5"
              style={playerTexture(player.number)}
            >
              <span className="intro-player-figure" />
            </span>
            <span className="intro-player-id">
              <span className="intro-player-number">{player.number}</span>
              <span className="intro-player-name">{player.name}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function Wall({ text }: { text: string }) {
  const flank = (rowCopies - 1) / 2
  return (
    <div className="intro-wall" style={{ '--intro-copies': rowCopies } as React.CSSProperties}>
      {wallRows.map((row) => (
        <div
          key={row}
          className="intro-wall-row"
          style={
            {
              '--intro-k': Math.abs(row),
              // Every other row sits half a name along, like brickwork.
              '--intro-brick': Math.abs(row) % 2,
            } as React.CSSProperties
          }
        >
          {row === 0 ? (
            <>
              <Hollow tag={text} copies={flank} />
              <span className="intro-team-name">{text}</span>
              <Hollow tag={text} copies={flank} />
            </>
          ) : (
            <Hollow tag={text} copies={rowCopies} />
          )}
        </div>
      ))}
    </div>
  )
}

/*
 * Halftime and overtime: the headline as a wall, and the handoff underneath rebuilds the HUD with
 * the teams on their new sides.
 */
function SwitchPage({ cast }: { cast: SwitchCast }) {
  return (
    <div
      className="intro-page"
      data-page="switch"
      style={{ '--intro-chars': cast.headline.length } as React.CSSProperties}
    >
      <Wall text={cast.headline} />
      <div className="intro-tables">
        <StatTable team={cast.lineup.ct} />
        <StatTable team={cast.lineup.t} />
      </div>
    </div>
  )
}

const stats = [
  ['kills', 'Kills'],
  ['deaths', 'Deaths'],
  ['assists', 'Assists'],
] as const

/**
 * A team's half, built from the HUD's own pieces on opaque surfaces: its half of the scoreboard
 * over its players as their cards show them, best fragger first. No side colours, as the sides are
 * about to swap.
 */
function StatTable({ team }: { team: SwitchCast['lineup']['ct'] }) {
  const players = [...team.players].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)
  return (
    <div className="intro-table flex w-[min(30cqw,26rem)] flex-col gap-1 text-foreground tabular-nums">
      <div className="relative z-10 flex h-14 items-center gap-3 rounded-field bg-canvas px-4">
        {team.logo && <img src={team.logo} alt="" className="size-9 shrink-0 object-contain" />}
        <span className="min-w-0 flex-1 truncate text-2xl font-bold uppercase">{team.name}</span>
        {team.score !== undefined && (
          <span className="text-[7rem] leading-none font-extrabold tracking-tight">
            {team.score}
          </span>
        )}
      </div>
      <div className="mt-4 flex justify-end rounded-control bg-canvas px-3 py-1.5 text-2xs font-semibold text-muted uppercase">
        {stats.map(([stat, label]) => (
          <span key={stat} className="w-14 text-right">
            {label}
          </span>
        ))}
      </div>
      {players.map((player) => (
        <div
          key={player.steamId}
          className="player-texture flex items-center gap-3 rounded-control bg-canvas px-3 py-2.5"
          style={playerTexture(player.number)}
        >
          <span className="min-w-0 flex-1 truncate text-lg leading-5.5 font-bold">
            {player.name}
          </span>
          <span className="flex font-semibold">
            {stats.map(([stat]) => (
              <span key={stat} className="w-14 text-right">
                {player[stat]}
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  )
}

function Hollow({ tag, copies }: { tag: string; copies: number }) {
  return (
    <span className="intro-hollow">
      {Array.from({ length: copies }, (_, index) => (
        <span key={index}>{tag}</span>
      ))}
    </span>
  )
}

// A cancelled animation means the intro was skipped or unmounted, which the caller checks.
function settled(animations: Animation[]) {
  return Promise.allSettled(animations.map((animation) => animation.finished))
}
