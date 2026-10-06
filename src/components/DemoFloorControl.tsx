import type { MapDefinition } from '#/replay/maps'
import type { DemoPlaybackState } from './DemoMap'

export function DemoFloorControl({
  map,
  playback,
}: {
  map: MapDefinition
  playback: DemoPlaybackState
}) {
  if (map.floors === 'single') return null
  const selected = playback.status === 'ready' ? playback.floor : map.initialFloor
  const nextFloor = selected === 'upper' ? 'lower' : 'upper'
  const label = `${selected === 'upper' ? 'Upper' : 'Lower'} floor — switch to ${nextFloor} floor`

  return (
    <button
      type="button"
      aria-label={label}
      title={`${label} (F)`}
      aria-keyshortcuts="f"
      disabled={playback.status !== 'ready'}
      onClick={() => playback.status === 'ready' && playback.controller.setFloor(nextFloor)}
      className="demo-floor-controls flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-neutral-700/50 text-mauve-200 outline-offset-2 focus-visible:outline-2 focus-visible:outline-mauve-200 enabled:hover:bg-neutral-700 disabled:cursor-default disabled:opacity-35"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        className="size-5"
      >
        <path
          d="m3 15 9-5 9 5-9 5-9-5Z"
          fill={selected === 'lower' ? 'currentColor' : 'none'}
          opacity={selected === 'lower' ? 1 : 0.4}
        />
        <path
          d="m3 8 9-5 9 5-9 5-9-5Z"
          fill={selected === 'upper' ? 'currentColor' : 'var(--color-neutral-800)'}
          fillOpacity={selected === 'upper' ? 1 : 0.8}
          strokeOpacity={selected === 'upper' ? 1 : 0.4}
        />
      </svg>
    </button>
  )
}
