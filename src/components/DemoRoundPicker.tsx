import { Fragment, useCallback, useRef, useEffect } from 'react'
import { Popover } from '@base-ui/react/popover'
import type { ReplayRound } from '#/replay/types'
import { halftimeBefore, overtimeBefore } from '#/replay/team-identity'
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
  // The list drops out of the scoreboard, so it publishes its size there for the lobe to match.
  const popup = useCallback((panel: HTMLDivElement | null) => {
    const scoreboard = trigger.current?.closest<HTMLElement>('.demo-scoreboard')
    if (!panel || !scoreboard) return
    // Narrower than the scoreboard by the lobe's two joins, so they never hang past its edges.
    panel.style.maxWidth = `calc(${scoreboard.offsetWidth}px - 2 * var(--radius-panel))`
    const publish = () => {
      scoreboard.style.setProperty('--rounds-width', `${panel.offsetWidth}px`)
      scoreboard.style.setProperty('--rounds-height', `${panel.offsetHeight}px`)
    }
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(panel)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (focusOnMount) trigger.current?.focus({ preventScroll: true })
  }, [focusOnMount])
  return (
    <Popover.Root>
      <Popover.Trigger
        ref={trigger}
        type="button"
        aria-label={`Choose round, current round ${round.number}`}
        className="demo-round-trigger flex h-full w-full min-w-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-control outline-offset-2 hover:bg-ghost-hover focus-visible:bg-ghost-hover focus-visible:outline-2 focus-visible:outline-focus replay-desktop:gap-0"
      >
        <time
          aria-label="Elapsed round time"
          className="text-sm leading-none font-semibold @min-[560px]:text-base replay-desktop:text-2xl"
        >
          {time}
        </time>
        <span
          aria-live="polite"
          aria-atomic="true"
          className="flex items-center gap-1 text-2xs font-semibold text-muted uppercase replay-desktop:text-xs"
        >
          Round <RollingNumber value={round.number} previous={previousRound} />
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner collisionPadding={16} className="z-50">
          <Popover.Popup
            ref={popup}
            aria-label="Select round"
            initialFocus={currentRound}
            className="demo-rounds-popup mt-3 max-h-[min(400px,var(--available-height))] w-[min(320px,calc(100vw-32px))] [scrollbar-width:none] overflow-y-auto overscroll-contain frame-panel border border-line bg-surface p-2 text-foreground shadow-popover outline-none"
          >
            <div className="flex flex-col gap-1">
              {rounds.map((candidate, index) => {
                const outcome = candidate.outcome
                const winner =
                  outcome?.teamName ||
                  (outcome?.winner === 'ct' ? 'CT' : outcome?.winner === 't' ? 'T' : undefined)
                const score =
                  candidate.score &&
                  `${candidate.score.ct + Number(outcome?.winner === 'ct')}–${candidate.score.t + Number(outcome?.winner === 't')}`
                const overtime = overtimeBefore(rounds[index - 1], candidate)
                const divider = halftimeBefore(rounds[index - 1], candidate)
                  ? 'Halftime'
                  : overtime && `Overtime ${overtime}`
                return (
                  <Fragment key={candidate.number}>
                    {divider && (
                      <div className="flex items-center gap-2 px-3 py-1 text-xs text-muted">
                        <span className="h-px flex-1 bg-line" />
                        <span>{divider}</span>
                        <span className="h-px flex-1 bg-line" />
                      </div>
                    )}
                    <Popover.Close
                      ref={candidate.number === round.number ? currentRound : undefined}
                      type="button"
                      aria-current={candidate.number === round.number ? 'step' : undefined}
                      aria-label={`Round ${candidate.number}${winner ? `, ${winner} won` : ''}${score ? `, score ${score}` : ''}`}
                      onClick={() => onSelectRound(candidate.number, true)}
                      className="group flex min-h-15 min-w-0 shrink-0 cursor-pointer items-center justify-between gap-3 rounded-inset-2 bg-control px-3 py-2.5 text-left text-sm tabular-nums outline-offset-2 hover:bg-control-hover focus-visible:outline-2 focus-visible:outline-focus aria-[current=step]:bg-control-raised"
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
                        <span className="shrink-0 font-semibold text-muted group-aria-[current=step]:text-foreground">
                          {score}
                        </span>
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
