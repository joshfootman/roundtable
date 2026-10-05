import { useRef } from 'react'
import type { CSSProperties } from 'react'
import type { DemoPlaybackState } from './DemoMap'
import type { ReplayRound } from '#/replay/types'

function playbackTime(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)
    .toString()
    .padStart(2, '0')}:${(whole % 60).toString().padStart(2, '0')}`
}

export function DemoPlaybackControl({
  round,
  playback,
}: {
  round: ReplayRound
  playback: DemoPlaybackState
}) {
  const scrub = useRef<{ pointer: number; resume: boolean } | null>(null)
  const ready = playback.status === 'ready'
  const playing = ready && playback.snapshot.playing
  const tick = ready ? playback.snapshot.tick : round.liveStartTick
  const elapsed = playbackTime((tick - round.liveStartTick) * round.tickInterval)
  const duration = playbackTime((round.endTick - round.liveStartTick) * round.tickInterval)

  const progress =
    round.endTick > round.liveStartTick
      ? Math.min(
          100,
          Math.max(0, ((tick - round.liveStartTick) / (round.endTick - round.liveStartTick)) * 100),
        )
      : 0

  function finishScrub() {
    const intent = scrub.current
    scrub.current = null
    if (
      intent?.resume &&
      playback.status === 'ready' &&
      playback.controller.getSnapshot().tick < round.endTick
    ) {
      playback.controller.play()
    }
  }

  return (
    <section
      aria-label="Playback controls"
      className="demo-playback-controls z-20 grid items-center gap-x-2 rounded-2xl bg-neutral-700/50 p-2 text-base text-mauve-200 tabular-nums"
    >
      <button
        type="button"
        aria-label={playing ? 'Pause round' : 'Play round'}
        aria-pressed={playing}
        disabled={!ready}
        className="demo-playback-toggle flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg outline-offset-2 focus-visible:outline-2 focus-visible:outline-mauve-200 enabled:hover:bg-neutral-800/50 disabled:cursor-default disabled:opacity-35"
        onClick={() => {
          if (playback.status !== 'ready') return
          if (playing) playback.controller.pause()
          else playback.controller.play()
        }}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="size-5">
          {playing ? <path d="M6 4h4v16H6zm8 0h4v16h-4z" /> : <path d="m7 4 14 8-14 8z" />}
        </svg>
      </button>
      <input
        type="range"
        aria-label="Round timeline"
        aria-valuetext={`${elapsed} of ${duration}`}
        min={round.liveStartTick}
        max={round.endTick}
        step={1}
        value={tick}
        disabled={!ready}
        className="demo-timeline h-11 min-w-0 flex-1 cursor-pointer disabled:cursor-default disabled:opacity-35"
        style={{ '--timeline-progress': `${progress}%` } as CSSProperties}
        onChange={(event) => {
          if (playback.status === 'ready')
            playback.controller.seek(event.currentTarget.valueAsNumber)
        }}
        onPointerDown={(event) => {
          if (playback.status !== 'ready') return
          scrub.current = {
            pointer: event.pointerId,
            resume: playback.controller.getSnapshot().playing,
          }
          event.currentTarget.setPointerCapture(event.pointerId)
          playback.controller.pause()
        }}
        onPointerUp={finishScrub}
        onPointerCancel={finishScrub}
        onLostPointerCapture={finishScrub}
        onBlur={finishScrub}
      />
      <div
        className="demo-playback-time flex shrink-0 items-center gap-1 whitespace-nowrap"
        aria-label="Playback time"
      >
        <time>{elapsed}</time>
        <span aria-hidden="true">/</span>
        <time>{duration}</time>
      </div>
    </section>
  )
}
