import { Popover } from '@base-ui/react/popover'
import { useCallback, useRef } from 'react'
import { replayShortcuts } from '../replay/shortcuts'

export function DemoShortcutHelp({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  // The panel grows out of the playback bar, so it anchors to the bar and publishes its size there.
  const bar = useRef<HTMLElement | null>(null)
  const trigger = useCallback((button: HTMLButtonElement | null) => {
    bar.current = button?.closest<HTMLElement>('.demo-playback-controls') ?? null
  }, [])
  const popup = useCallback((panel: HTMLDivElement | null) => {
    if (!panel) return
    const publish = () => {
      bar.current?.style.setProperty('--shortcuts-width', `${panel.offsetWidth}px`)
      bar.current?.style.setProperty('--shortcuts-height', `${panel.offsetHeight}px`)
    }
    // Measured on mount so the lobe starts rising in the same frame as the panel's reveal.
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(panel)
    return () => observer.disconnect()
  }, [])
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger
        ref={trigger}
        aria-label="Keyboard shortcuts"
        aria-keyshortcuts="Shift+/"
        title="Keyboard shortcuts (?)"
        className="demo-shortcuts-trigger flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-inset-2 text-foreground outline-offset-2 hover:bg-ghost-hover focus-visible:bg-ghost-hover focus-visible:outline-2 focus-visible:outline-focus"
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
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 15h10" />
        </svg>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          anchor={bar}
          side="top"
          align="end"
          collisionPadding={16}
          className="z-50"
        >
          <Popover.Popup
            ref={popup}
            aria-label="Keyboard shortcuts"
            className="demo-shortcuts-popup mb-2 max-h-[var(--available-height)] w-[min(360px,calc(100vw-32px))] overflow-y-auto frame-panel border border-line bg-surface p-4 text-sm text-foreground shadow-popover outline-none"
          >
            <Popover.Title className="mb-3 font-semibold">Keyboard shortcuts</Popover.Title>
            <dl className="flex flex-col gap-3">
              {replayShortcuts.map(({ keys, action }) => (
                <div key={keys} className="flex items-center justify-between gap-4">
                  <dt className="text-muted">{action}</dt>
                  <dd className="shrink-0">
                    <kbd className="rounded-chip bg-control px-2 py-1 font-sans text-xs whitespace-nowrap">
                      {keys}
                    </kbd>
                  </dd>
                </div>
              ))}
            </dl>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
