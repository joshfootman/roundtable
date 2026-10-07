import { Fragment, useRef, useEffect } from 'react'
import { Popover } from '@base-ui/react/popover'
import type { ReplayRound } from '#/replay/types'
import { halftimeBefore } from '#/replay/team-identity'
import { RollingNumber } from './RollingNumber'

export function DemoRoundPicker({
  rounds,
  round,
  time,
  previousRound,
  focusOnMount = false,
  onSelectRound,
}: {
  rounds: readonly ReplayRound[]
  round: ReplayRound
  time: string
  previousRound?: number
  focusOnMount?: boolean
  onSelectRound: (number: number, focusPicker?: boolean) => void
}) {
  const trigger = useRef<HTMLButtonElement>(null)
  const currentRound = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (focusOnMount) trigger.current?.focus({ preventScroll: true })
  }, [focusOnMount])
  return (
    <Popover.Root>
      <Popover.Trigger
        ref={trigger}
        type="button"
        aria-label={`Choose round, current round ${round.number}`}
        className="flex h-full w-full min-w-0 cursor-pointer flex-col items-center justify-center gap-0 outline-offset-2 hover:bg-neutral-800/50 focus-visible:bg-neutral-800/50 focus-visible:outline-2 focus-visible:outline-mauve-200"
      >
        <time
          aria-label="Elapsed round time"
          className="text-lg leading-none font-semibold @min-[560px]:text-2xl"
        >
          {time}
        </time>
        <span
          aria-live="polite"
          aria-atomic="true"
          className="flex items-center gap-1 text-[10px] font-semibold text-mauve-300 uppercase replay-desktop:text-xs"
        >
          Round <RollingNumber value={round.number} previous={previousRound} />
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={12} collisionPadding={16} className="z-50">
          <Popover.Popup
            aria-label="Select round"
            initialFocus={currentRound}
            className="max-h-[min(400px,var(--available-height))] w-[min(320px,calc(100vw-32px))] overflow-y-auto overscroll-contain rounded-2xl border border-neutral-700 bg-neutral-800 p-2 text-mauve-200 shadow-xl outline-none [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-neutral-600 [&::-webkit-scrollbar-track]:bg-transparent"
          >
            <div className="flex flex-col gap-2">
              {rounds.map((candidate, index) => {
                const outcome = candidate.outcome
                const winner =
                  outcome?.teamName ||
                  (outcome?.winner === 'ct' ? 'CT' : outcome?.winner === 't' ? 'T' : undefined)
                const score =
                  candidate.score &&
                  `${candidate.score.ct + Number(outcome?.winner === 'ct')}–${candidate.score.t + Number(outcome?.winner === 't')}`
                return (
                  <Fragment key={candidate.number}>
                    {halftimeBefore(rounds[index - 1], candidate) && (
                      <div className="flex items-center gap-2 px-3 py-1 text-xs text-mauve-300">
                        <span className="h-px flex-1 bg-neutral-700" />
                        <span>Halftime</span>
                        <span className="h-px flex-1 bg-neutral-700" />
                      </div>
                    )}
                    <Popover.Close
                      ref={candidate.number === round.number ? currentRound : undefined}
                      type="button"
                      aria-current={candidate.number === round.number ? 'step' : undefined}
                      aria-label={`Round ${candidate.number}${winner ? `, ${winner} won` : ''}${score ? `, score ${score}` : ''}`}
                      onClick={() => onSelectRound(candidate.number, true)}
                      className={`flex min-h-15 min-w-0 shrink-0 cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm tabular-nums outline-offset-2 hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-mauve-200 ${candidate.number === round.number ? 'bg-neutral-600/50 ring-1 ring-mauve-300/30 ring-inset' : 'bg-neutral-700/40'}`}
                    >
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="font-semibold">Round {candidate.number}</span>
                        {winner && (
                          <span
                            className={`truncate text-xs ${outcome?.winner === 'ct' ? 'text-ct' : 'text-t'}`}
                          >
                            {winner}
                          </span>
                        )}
                      </span>
                      {score && (
                        <span className="shrink-0 font-semibold text-mauve-300">{score}</span>
                      )}
                    </Popover.Close>
                  </Fragment>
                )
              })}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
