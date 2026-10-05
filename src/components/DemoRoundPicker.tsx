import { useRef, useEffect } from 'react'
import * as Popover from '@radix-ui/react-popover'
import type { ReplayRound } from '#/replay/types'
import { RollingNumber } from './RollingNumber'

export function DemoRoundPicker({
  rounds,
  round,
  time,
  previousRound,
  onSelectRound,
}: {
  rounds: readonly ReplayRound[]
  round: ReplayRound
  time: string
  previousRound?: number
  onSelectRound: (number: number) => void
}) {
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (previousRound !== undefined) trigger.current?.focus({ preventScroll: true })
  }, [previousRound])
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          ref={trigger}
          type="button"
          aria-label={`Choose round, current round ${round.number}`}
          className="flex h-full w-full min-w-0 cursor-pointer flex-col items-center justify-center gap-0 outline-offset-2 hover:bg-neutral-800/50 focus-visible:bg-neutral-800/50 focus-visible:outline-2 focus-visible:outline-mauve-200"
        >
          <time
            aria-label="Elapsed round time"
            className="text-xl leading-none font-semibold @min-[560px]:text-2xl"
          >
            {time}
          </time>
          <span
            aria-live="polite"
            aria-atomic="true"
            className="flex items-center gap-1 text-xs font-semibold text-mauve-300 uppercase"
          >
            Round <RollingNumber value={round.number} previous={previousRound} />
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          aria-label="Select round"
          sideOffset={12}
          collisionPadding={16}
          className="z-50 max-h-[min(480px,var(--radix-popover-content-available-height))] w-[min(360px,calc(100vw-32px))] overflow-y-auto overscroll-contain rounded-2xl border border-neutral-700 bg-neutral-800 p-3 text-mauve-200 shadow-xl outline-none"
        >
          <div className="mb-2 flex items-center justify-between pl-1">
            <h2 className="text-sm font-semibold">Choose round</h2>
            <Popover.Close
              aria-label="Close round picker"
              className="flex size-10 cursor-pointer items-center justify-center rounded-lg hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-mauve-200"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="size-4"
              >
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </Popover.Close>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {rounds.map((candidate) => {
              const outcome = candidate.outcome
              const winner =
                outcome?.teamName ||
                (outcome?.winner === 'ct' ? 'CT' : outcome?.winner === 't' ? 'T' : undefined)
              const score =
                candidate.score &&
                `${candidate.score.ct + Number(outcome?.winner === 'ct')}–${candidate.score.t + Number(outcome?.winner === 't')}`
              return (
                <Popover.Close asChild key={candidate.number}>
                  <button
                    type="button"
                    aria-current={candidate.number === round.number ? 'step' : undefined}
                    aria-label={`Round ${candidate.number}${winner ? `, ${winner} won` : ''}${score ? `, score ${score}` : ''}`}
                    onClick={() => onSelectRound(candidate.number)}
                    className={`flex min-h-18 min-w-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-2 text-sm tabular-nums outline-offset-2 hover:bg-neutral-600/60 focus-visible:outline-2 focus-visible:outline-mauve-200 ${candidate.number === round.number ? 'bg-neutral-600 ring-1 ring-mauve-300/50' : 'bg-neutral-700/40'}`}
                  >
                    <span className="font-semibold">Round {candidate.number}</span>
                    {score && <span className="text-xs text-mauve-300">{score}</span>}
                    {winner && (
                      <span
                        className={`w-full truncate text-center text-[10px] ${outcome?.winner === 'ct' ? 'text-ct' : 'text-t'}`}
                      >
                        {winner}
                      </span>
                    )}
                  </button>
                </Popover.Close>
              )
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
