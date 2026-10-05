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

  return (
    <nav
      aria-label="Map floor"
      className="demo-floor-controls z-20 flex items-center gap-3 rounded-2xl bg-neutral-700/50 p-2 text-sm text-mauve-200 sm:w-[min(100%,640px)] sm:self-center replay-desktop:w-auto replay-landscape:col-start-1 replay-landscape:row-start-2 replay-landscape:w-full"
    >
      <span className="flex shrink-0 items-center gap-2 px-2 text-mauve-400">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="size-4"
        >
          <path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5" />
        </svg>
        Floor
      </span>
      <div className="grid min-w-0 flex-1 grid-cols-2 gap-1">
        {(['upper', 'lower'] as const).map((floor) => (
          <button
            key={floor}
            type="button"
            aria-pressed={selected === floor}
            disabled={playback.status !== 'ready'}
            onClick={() => playback.status === 'ready' && playback.controller.setFloor(floor)}
            className={`min-h-10 cursor-pointer rounded-lg px-4 outline-offset-2 focus-visible:outline-2 focus-visible:outline-mauve-200 enabled:hover:bg-neutral-700 disabled:cursor-default disabled:opacity-35 ${selected === floor ? 'bg-neutral-700 font-semibold' : 'text-mauve-300'}`}
          >
            {floor === 'upper' ? 'Upper' : 'Lower'}
          </button>
        ))}
      </div>
    </nav>
  )
}
