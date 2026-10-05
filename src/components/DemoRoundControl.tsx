import type { ReplayRound } from '#/replay/types'

export function DemoRoundControl({
  rounds,
  round,
  tick,
  onSelectRound,
}: {
  rounds: readonly ReplayRound[]
  round: ReplayRound
  tick: number
  onSelectRound: (number: number) => void
}) {
  const previous = rounds.find((candidate) => candidate.number === round.number - 1)
  const next = rounds.find((candidate) => candidate.number === round.number + 1)
  const seconds = Math.floor(
    Math.max(0, Math.min(tick, round.resultTick) - round.liveStartTick) * round.tickInterval,
  )
  const time = `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
  const tile = 'flex items-center justify-center rounded-xl'
  const button = `${tile} bg-neutral-700/50 size-11 cursor-pointer outline-offset-2 enabled:hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-mauve-200 disabled:cursor-default disabled:opacity-35`

  return (
    <section
      aria-label="Round controls"
      className="demo-round-controls z-10 flex flex-col gap-2 text-base text-mauve-200 tabular-nums"
    >
      <nav aria-label="Round navigation" className="grid grid-cols-[auto_1fr_auto] gap-2">
        <button
          type="button"
          aria-label="Previous round"
          disabled={!previous}
          onClick={() => previous && onSelectRound(previous.number)}
          className={button}
        >
          <Chevron direction="left" />
        </button>
        <div aria-live="polite" aria-atomic="true" className={`${tile} bg-neutral-700/50`}>
          Round {round.number}
        </div>
        <button
          type="button"
          aria-label="Next round"
          disabled={!next}
          onClick={() => next && onSelectRound(next.number)}
          className={button}
        >
          <Chevron direction="right" />
        </button>
      </nav>
      <div aria-label="Round score and time" className="grid grid-cols-[1fr_1fr_1.5fr_1fr_1fr]">
        <div
          aria-label="Counter-Terrorist score"
          className={`${tile} h-12 rounded-r-none bg-neutral-700/50 font-bold`}
        >
          {round.score?.ct ?? '—'}
        </div>
        <div className={`${tile} h-14 rounded-t-none bg-ct/25 pb-2 font-bold text-ct`}>CT</div>
        <time
          aria-label="Elapsed round time"
          className={`${tile} h-12 rounded-l-none rounded-r-none bg-neutral-700/50`}
        >
          {time}
        </time>
        <div className={`${tile} h-14 rounded-t-none bg-t/25 pb-2 font-bold text-t`}>T</div>
        <div
          aria-label="Terrorist score"
          className={`${tile} h-12 rounded-l-none bg-neutral-700/50 font-bold`}
        >
          {round.score?.t ?? '—'}
        </div>
      </div>
    </section>
  )
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
    >
      <path d={direction === 'left' ? 'm15 6-6 6 6 6' : 'm9 6 6 6-6 6'} />
    </svg>
  )
}
