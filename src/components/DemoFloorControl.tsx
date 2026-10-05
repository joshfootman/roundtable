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
      className="demo-floor-controls z-20 grid min-h-11 grid-cols-2 gap-2 text-base text-mauve-200"
    >
      {(['upper', 'lower'] as const).map((floor) => (
        <button
          key={floor}
          type="button"
          aria-pressed={selected === floor}
          disabled={playback.status !== 'ready'}
          onClick={() => playback.status === 'ready' && playback.controller.setFloor(floor)}
          className={`cursor-pointer rounded-xl outline-offset-2 focus-visible:outline-2 focus-visible:outline-mauve-200 enabled:hover:bg-neutral-700 disabled:cursor-default disabled:opacity-35 ${selected === floor ? 'bg-neutral-700' : 'bg-neutral-700/50'}`}
        >
          {floor === 'upper' ? 'Upper' : 'Lower'}
        </button>
      ))}
    </nav>
  )
}
