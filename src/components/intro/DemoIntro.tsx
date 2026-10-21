import React from 'react'
import type { IntroCast, IntroEvent, IntroState } from './intro'
import './intro.css'

const modifiers = new Set(['Alt', 'Control', 'Meta', 'Shift'])

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
  // page; its animations run on the HUD, so they're found by name.
  React.useEffect(() => {
    if (!photoReady) return
    const root = overlay.current!
    const animations =
      state.phase === 'handoff'
        ? root
            .parentElement!.getAnimations({ subtree: true })
            .filter(
              (animation) =>
                animation instanceof CSSAnimation &&
                animation.animationName.startsWith('intro-handoff-'),
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
        <div className="intro-page" data-page="map">
          <p className="intro-title">{cast.title}</p>
          <p className="intro-map-name">{cast.map.name}</p>
        </div>
      )}
      <p className="intro-skip">Click to skip</p>
    </div>
  )
}

// A cancelled animation means the intro was skipped or unmounted, which the caller checks.
function settled(animations: Animation[]) {
  return Promise.allSettled(animations.map((animation) => animation.finished))
}
