import type { DemoCameraState } from './DemoMap'
import { maximumZoom, minimumZoom } from '../replay/map-camera'

export function DemoCameraControls({ camera }: { camera: DemoCameraState }) {
  const ready = camera.status === 'ready'
  const controls = [
    {
      label: 'Zoom in',
      shortcut: '+',
      path: 'M12 5v14M5 12h14',
      disabled: !ready || camera.zoom >= maximumZoom,
      action: ready ? camera.zoomIn : undefined,
    },
    {
      label: 'Zoom out',
      shortcut: '-',
      path: 'M5 12h14',
      disabled: !ready || camera.zoom <= minimumZoom,
      action: ready ? camera.zoomOut : undefined,
    },
    {
      label: 'Focus map',
      shortcut: 'r',
      path: 'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5M9 12h6M12 9v6',
      disabled: !ready,
      action: ready ? camera.focus : undefined,
    },
  ]
  return (
    <>
      {controls.map(({ label, path, disabled, action, shortcut }) => (
        <button
          key={label}
          type="button"
          aria-label={label}
          title={`${label} (${shortcut.toUpperCase()})`}
          aria-keyshortcuts={shortcut}
          disabled={disabled}
          onClick={action}
          className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-neutral-700/50 text-mauve-200 outline-offset-2 focus-visible:outline-2 focus-visible:outline-mauve-200 enabled:hover:bg-neutral-700 disabled:cursor-default disabled:opacity-35"
        >
          <svg
            aria-hidden="true"
            className="size-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={path} />
          </svg>
        </button>
      ))}
      <output aria-label="Map zoom" aria-live="polite" className="sr-only">
        {ready ? `${Math.round(camera.zoom * 100)}%` : 'Loading'}
      </output>
    </>
  )
}
