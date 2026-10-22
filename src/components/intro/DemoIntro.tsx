import React from 'react'
import { playerTexture } from '#/components/DemoPlayerCards'
import {
  beats,
  type IntroBeat,
  type IntroCast,
  type IntroEvent,
  type IntroState,
  type IntroTeam,
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
  cast: IntroCast
  state: IntroState
  dispatch: (event: IntroEvent) => void
}) {
  const overlay = React.useRef<HTMLDivElement>(null)
  const photo = React.useRef<HTMLImageElement>(null)

  // The map beat starts once its photo can be drawn, so an uncached one never pops in partway.
  const [photoReady, setPhotoReady] = React.useState(false)
  React.useEffect(() => {
    let current = true
    const ready = () => current && setPhotoReady(true)
    photo.current!.decode().then(ready, ready)
    return () => {
      current = false
    }
  }, [])

  const lineupReady = cast.lineup !== undefined
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
  const lineup = cast.lineup

  return (
    <div
      ref={overlay}
      aria-hidden="true"
      data-phase={state.phase}
      className="intro"
      onClick={() => dispatch('skip')}
    >
      <div className="intro-photo" data-ready={photoReady || undefined}>
        <img ref={photo} src={cast.map.photo} alt="" />
        <img src={cast.map.photo} alt="" className="intro-blur intro-blur-near" />
        <img src={cast.map.photo} alt="" className="intro-blur intro-blur-far" />
      </div>
      {photoReady && (
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
  const flank = (rowCopies - 1) / 2
  return (
    <div
      className="intro-page"
      data-page={side}
      data-covered={covered}
      style={
        {
          '--intro-chars': team.tag.length,
          '--intro-copies': rowCopies,
        } as React.CSSProperties
      }
    >
      <div className="intro-wall">
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
                <Hollow tag={team.tag} copies={flank} />
                <span className="intro-team-name">{team.tag}</span>
                <Hollow tag={team.tag} copies={flank} />
              </>
            ) : (
              <Hollow tag={team.tag} copies={rowCopies} />
            )}
          </div>
        ))}
      </div>
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
