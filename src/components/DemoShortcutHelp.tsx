import { Popover } from '@base-ui/react/popover'
import { replayShortcuts } from '../replay/shortcuts'

export function DemoShortcutHelp({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger
        aria-label="Keyboard shortcuts"
        aria-keyshortcuts="Shift+/"
        title="Keyboard shortcuts (?)"
        className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-neutral-700/50 text-mauve-200 outline-offset-2 hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-mauve-200"
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
          side="bottom"
          align="start"
          sideOffset={8}
          collisionPadding={16}
          className="z-50"
        >
          <Popover.Popup
            aria-label="Keyboard shortcuts"
            className="max-h-[var(--available-height)] w-[min(360px,calc(100vw-32px))] overflow-y-auto rounded-2xl border border-neutral-700 bg-neutral-800 p-4 text-sm text-mauve-200 shadow-xl outline-none"
          >
            <Popover.Title className="mb-3 font-semibold">Keyboard shortcuts</Popover.Title>
            <dl className="flex flex-col gap-3">
              {replayShortcuts.map(({ keys, action }) => (
                <div key={keys} className="flex items-center justify-between gap-4">
                  <dt className="text-mauve-300">{action}</dt>
                  <dd className="shrink-0">
                    <kbd className="rounded bg-neutral-700/50 px-2 py-1 font-sans text-xs whitespace-nowrap">
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
