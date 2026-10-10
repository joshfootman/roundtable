import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import type { DemoPlaybackState } from './DemoMap'
import type { ReplayRound } from '#/replay/types'

function playbackTime(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)
    .toString()
    .padStart(2, '0')}:${(whole % 60).toString().padStart(2, '0')}`
}

function timelineProgress(round: ReplayRound, tick: number) {
  const span = round.endTick - round.liveStartTick
  return span > 0 ? Math.min(100, Math.max(0, ((tick - round.liveStartTick) / span) * 100)) : 0
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

  const progress = timelineProgress(round, tick)
  const timeline = useRef<HTMLInputElement>(null)
  const controller = ready ? playback.controller : undefined

  // The thumb follows every drawn frame; React only republishes the text a few times a second.
  useEffect(
    () =>
      controller?.subscribeFrame((frameTick) => {
        const input = timeline.current
        if (!input) return
        input.value = String(frameTick)
        input.style.setProperty('--timeline-progress', `${timelineProgress(round, frameTick)}%`)
      }),
    [controller, round],
  )

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
      className="demo-playback-controls z-20 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 rounded-2xl bg-neutral-700/25 px-4 py-2 text-base text-mauve-200 tabular-nums sm:w-[min(100%,640px)] sm:self-center replay-desktop:absolute replay-desktop:right-4 replay-desktop:bottom-4 replay-desktop:left-4 replay-desktop:w-auto replay-desktop:grid-cols-[auto_minmax(0,1fr)_auto] replay-desktop:p-2 replay-landscape:col-start-1 replay-landscape:row-start-2 replay-landscape:w-full"
    >
      <button
        type="button"
        aria-label={playing ? 'Pause round' : 'Play round'}
        aria-pressed={playing}
        aria-keyshortcuts="k Space"
        title={playing ? 'Pause (K / Space)' : 'Play (K / Space)'}
        disabled={!ready}
        className="demo-playback-toggle col-start-1 row-start-2 flex size-11 shrink-0 cursor-pointer items-center justify-start rounded-lg outline-offset-2 focus-visible:bg-neutral-800/50 focus-visible:outline-2 focus-visible:outline-mauve-200 enabled:hover:bg-neutral-800/50 disabled:cursor-default disabled:opacity-35 replay-desktop:row-start-1 replay-desktop:justify-center"
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
        ref={timeline}
        type="range"
        aria-label="Round timeline"
        aria-valuetext={`${elapsed} of ${duration}`}
        min={round.liveStartTick}
        max={round.endTick}
        step={1}
        value={tick}
        disabled={!ready}
        className="demo-timeline col-span-full row-start-1 h-11 w-full min-w-0 flex-1 cursor-pointer appearance-none border-0 bg-transparent outline-none disabled:cursor-default disabled:opacity-35 replay-desktop:col-span-1 replay-desktop:col-start-2 [&::-moz-range-progress]:h-1 [&::-moz-range-progress]:rounded-full [&::-moz-range-progress]:bg-mauve-200 [&::-moz-range-thumb]:size-2.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-mauve-200 [&::-moz-range-thumb]:shadow-none focus-visible:[&::-moz-range-thumb]:outline-2 focus-visible:[&::-moz-range-thumb]:outline-offset-3 focus-visible:[&::-moz-range-thumb]:outline-mauve-200 touch:[&::-moz-range-thumb]:size-3.5 [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:border-0 [&::-moz-range-track]:bg-mauve-200/15 [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:border-0 [&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--color-mauve-200)_var(--timeline-progress),color-mix(in_oklab,var(--color-mauve-200)_15%,transparent)_var(--timeline-progress))] [&::-webkit-slider-thumb]:-mt-[3px] [&::-webkit-slider-thumb]:size-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-mauve-200 [&::-webkit-slider-thumb]:shadow-none focus-visible:[&::-webkit-slider-thumb]:outline-2 focus-visible:[&::-webkit-slider-thumb]:outline-offset-3 focus-visible:[&::-webkit-slider-thumb]:outline-mauve-200 touch:[&::-webkit-slider-thumb]:-mt-[5px] touch:[&::-webkit-slider-thumb]:size-3.5"
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
        className="demo-playback-time col-start-2 row-start-2 flex shrink-0 items-center gap-1 justify-self-end px-2 text-xs whitespace-nowrap replay-desktop:col-start-3 replay-desktop:row-start-1 replay-desktop:text-base"
        aria-label="Playback time"
      >
        <time>{elapsed}</time>
        <span aria-hidden="true">/</span>
        <time>{duration}</time>
      </div>
    </section>
  )
}
