import type { ImportState } from '../demo/session'

type Status = { status: 'idle' | 'loading' | 'success' } | { status: 'error'; message: string }

function importStatus(state: ImportState): Status {
  switch (state.status) {
    case 'reading':
      return { status: 'loading' }
    case 'error':
      return { status: 'error', message: state.message }
    case 'ready':
      switch (state.parsing.status) {
        case 'active':
          return { status: 'loading' }
        case 'complete':
          return { status: 'success' }
        case 'failed':
          return { status: 'error', message: state.parsing.message }
        case 'cancelled':
          return { status: 'idle' }
      }
    case 'empty':
    case 'cancelled':
      return { status: 'idle' }
  }
}

const labels = {
  idle: '',
  loading: 'Parsing demo.',
  success: 'Demo parsed.',
  error: 'Demo import failed.',
}

export function DemoImportStatus({ state }: { state: ImportState }) {
  const visual = importStatus(state)

  return (
    <>
      <span
        className="group/import-status pointer-events-none ml-3 inline-flex size-7 flex-none pr-2"
        data-state={visual.status}
        aria-live="polite"
        aria-atomic="true"
      >
        <svg
          className="block text-blue-400 transition-[color,opacity] duration-240 ease-out group-data-[state=error]/import-status:text-red-400 group-data-[state=idle]/import-status:opacity-0 group-data-[state=success]/import-status:text-green-400 motion-reduce:transition-none"
          width="28"
          height="28"
          viewBox="0 0 32 32"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect
            className="transition-opacity duration-240 ease-out group-data-[state=loading]/import-status:opacity-30 motion-reduce:transition-none motion-reduce:group-data-[state=loading]/import-status:opacity-100"
            x="1"
            y="1"
            width="30"
            height="30"
            rx="11"
          />
          <rect
            className="animate-demo-import-status-travel stroke-blue-400 opacity-0 transition-opacity duration-240 ease-out [animation-play-state:paused] group-data-[state=loading]/import-status:opacity-100 group-data-[state=loading]/import-status:[animation-play-state:running] motion-reduce:animate-none motion-reduce:transition-none motion-reduce:group-data-[state=loading]/import-status:opacity-0"
            x="1"
            y="1"
            width="30"
            height="30"
            rx="11"
            pathLength="100"
            strokeDasharray="20 80"
          />
          <path
            className="origin-center scale-94 opacity-0 transition-[opacity,scale] duration-240 ease-[cubic-bezier(0.19,1,0.22,1)] transform-fill group-data-[state=success]/import-status:scale-100 group-data-[state=success]/import-status:opacity-100 motion-reduce:scale-100 motion-reduce:transition-none"
            d="m10 16 4 4 8-8"
          />
          <path
            className="origin-center scale-94 opacity-0 transition-[opacity,scale] duration-240 ease-[cubic-bezier(0.19,1,0.22,1)] transform-fill group-data-[state=error]/import-status:scale-100 group-data-[state=error]/import-status:opacity-100 motion-reduce:scale-100 motion-reduce:transition-none"
            d="m12 12 8 8m0-8-8 8"
          />
        </svg>
        <span className="sr-only">{labels[visual.status]}</span>
      </span>
      {visual.status === 'error' && (
        <span
          role="alert"
          className="demo-import-error mt-2 min-w-0 basis-full rounded-xl bg-neutral-800 px-3 py-2 text-xs leading-normal wrap-anywhere text-red-300 replay-desktop:absolute replay-desktop:top-full replay-desktop:right-0 replay-desktop:left-0 replay-desktop:z-50"
        >
          {visual.message}
        </span>
      )}
    </>
  )
}
