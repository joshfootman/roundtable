import { useLayoutEffect, useRef } from 'react'

export function DemoDrawingControl({
  enabled,
  count,
  ready,
  onToggle,
  onClear,
}: {
  enabled: boolean
  count: number
  ready: boolean
  onToggle(): void
  onClear(): void
}) {
  const pen = useRef<HTMLButtonElement>(null)
  const clear = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!enabled && clear.current?.contains(document.activeElement)) pen.current?.focus()
  }, [enabled])
  return (
    <div className="demo-drawing-control relative shrink-0" data-drawing-open={enabled}>
      <button
        ref={pen}
        type="button"
        aria-label="Draw on map"
        aria-pressed={enabled}
        aria-keyshortcuts="d"
        disabled={!ready}
        title="Draw on map (D)"
        onClick={onToggle}
        className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-inset-2 text-foreground outline-offset-2 hover:bg-ghost-hover focus-visible:bg-ghost-hover focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-default disabled:opacity-35 aria-pressed:bg-ct/20 aria-pressed:text-ct"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-5"
        >
          <path d="m15 4 5 5M4 20l5-1 12-12a2 2 0 0 0-5-5L4 14v6Z" />
        </svg>
      </button>
      <div
        ref={clear}
        inert={!enabled}
        aria-hidden={!enabled}
        className="demo-drawing-clear absolute bottom-full -left-2 mb-4 frame-panel bg-surface p-2"
      >
        <button
          type="button"
          aria-label="Clear map drawings"
          aria-keyshortcuts="Shift+d"
          aria-disabled={!ready || count === 0}
          title="Clear map drawings (Shift + D)"
          onClick={() => {
            if (ready && count > 0) onClear()
          }}
          className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-inset-2 text-foreground outline-offset-2 hover:bg-ghost-hover focus-visible:bg-ghost-hover focus-visible:outline-2 focus-visible:outline-focus aria-disabled:cursor-default aria-disabled:opacity-35"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-5"
          >
            <path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6" />
          </svg>
        </button>
      </div>
      <output aria-label="Drawing count" aria-live="polite" className="sr-only">
        {count} {count === 1 ? 'drawing' : 'drawings'} on this floor
      </output>
    </div>
  )
}
