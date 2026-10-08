import { useRef } from 'react'

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
  return (
    <>
      <button
        ref={pen}
        type="button"
        aria-label="Draw on map"
        aria-pressed={enabled}
        aria-keyshortcuts="d"
        disabled={!ready}
        title="Draw on map (D)"
        onClick={onToggle}
        className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-neutral-700/50 text-mauve-200 outline-offset-2 hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-mauve-200 disabled:cursor-default disabled:opacity-35 aria-pressed:bg-ct/20 aria-pressed:text-ct"
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
      {count > 0 && (
        <button
          type="button"
          aria-label="Clear map drawings"
          aria-keyshortcuts="Shift+d"
          disabled={!ready}
          title="Clear map drawings (Shift + D)"
          onClick={() => {
            pen.current?.focus()
            onClear()
          }}
          className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-neutral-700/50 text-mauve-200 outline-offset-2 hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-mauve-200 disabled:cursor-default disabled:opacity-35"
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
      )}
      <output aria-label="Drawing count" aria-live="polite" className="sr-only">
        {count} {count === 1 ? 'drawing' : 'drawings'} on this floor
      </output>
    </>
  )
}
