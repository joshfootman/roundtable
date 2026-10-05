import { useState } from 'react'
import type { ReplayRound } from '#/replay/types'
import type { ExampleId } from '#/demo/examples'
import { roundTeams, type TeamIdentity } from '#/replay/team-identity'
import { RollingNumber } from '#/components/RollingNumber'
import { DemoRoundPicker } from './DemoRoundPicker'

export function DemoRoundControl({
  rounds,
  round,
  tick,
  onSelectRound,
  previousRound,
  example,
}: {
  rounds: readonly ReplayRound[]
  round: ReplayRound
  tick: number
  previousRound?: number
  example?: ExampleId
  onSelectRound: (number: number) => void
}) {
  const winner = tick >= round.resultTick ? round.outcome?.winner : undefined
  const score = round.score && {
    ct: round.score.ct + Number(winner === 'ct'),
    t: round.score.t + Number(winner === 't'),
  }
  const previous = rounds.find((candidate) => candidate.number === round.number - 1)
  const next = rounds.find((candidate) => candidate.number === round.number + 1)
  const seconds = Math.floor(
    Math.max(0, Math.min(tick, round.resultTick) - round.liveStartTick) * round.tickInterval,
  )
  const time = `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
  const teams = roundTeams(round, example)
  const button =
    'flex cursor-pointer items-center justify-center rounded-xl outline-offset-2 enabled:hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-mauve-200 disabled:cursor-default disabled:opacity-35'

  return (
    <section
      aria-label="Round controls"
      className="demo-round-controls @container z-30 w-full min-w-0 self-center text-mauve-200 tabular-nums sm:w-[min(100%,840px)] replay-desktop:absolute replay-desktop:top-4 replay-desktop:left-1/2 replay-desktop:w-[min(840px,calc(100%-32px))] replay-desktop:-translate-x-1/2 replay-landscape:col-start-1 replay-landscape:row-start-1 replay-landscape:w-full"
    >
      <nav aria-label="Round navigation" className="flex items-center gap-2 pb-4">
        <button
          type="button"
          aria-label="Previous round"
          disabled={!previous}
          onClick={() => previous && onSelectRound(previous.number)}
          className={`${button} h-14 w-8 shrink-0 bg-neutral-700/50 @min-[560px]:w-14`}
        >
          <Chevron direction="left" />
        </button>
        <div className="grid h-14 min-w-0 flex-1 grid-cols-[minmax(0,1fr)_40px_64px_40px_minmax(0,1fr)] grid-rows-1 items-center rounded-xl bg-neutral-700/50 @min-[560px]:grid-cols-[minmax(0,1fr)_72px_112px_72px_minmax(0,1fr)]">
          <Team identity={teams.ct} />
          <div
            aria-label="Counter-Terrorist score"
            className="flex h-18 items-center justify-center self-start rounded-b-xl bg-ct/80 text-3xl font-bold text-neutral-800 @min-[560px]:text-3xl"
          >
            <RollingNumber value={score?.ct} />
          </div>
          <DemoRoundPicker
            rounds={rounds}
            round={round}
            time={time}
            previousRound={previousRound}
            onSelectRound={onSelectRound}
          />
          <div
            aria-label="Terrorist score"
            className="flex h-18 items-center justify-center self-start rounded-b-xl bg-t/80 text-3xl font-bold text-neutral-800 @min-[560px]:text-3xl"
          >
            <RollingNumber value={score?.t} />
          </div>
          <Team identity={teams.t} reverse />
        </div>
        <button
          type="button"
          aria-label="Next round"
          disabled={!next}
          onClick={() => next && onSelectRound(next.number)}
          className={`${button} h-14 w-8 shrink-0 bg-neutral-700/50 @min-[560px]:w-14`}
        >
          <Chevron direction="right" />
        </button>
      </nav>
    </section>
  )
}

function Team({ identity, reverse = false }: { identity: TeamIdentity; reverse?: boolean }) {
  const [failedLogo, setFailedLogo] = useState<string>()
  return (
    <div
      title={identity.name}
      className={`flex min-w-0 items-center justify-center gap-2 px-1 @min-[560px]:gap-3 @min-[560px]:px-6 ${reverse ? '@min-[560px]:flex-row-reverse @min-[560px]:justify-end' : '@min-[560px]:justify-end'}`}
    >
      <span
        className={`truncate text-sm font-semibold @min-[560px]:whitespace-nowrap ${identity.logo && failedLogo !== identity.logo ? 'sr-only @min-[560px]:not-sr-only' : ''}`}
      >
        {identity.name}
      </span>
      {identity.logo && failedLogo !== identity.logo && (
        <img
          src={identity.logo}
          alt=""
          className="size-6 shrink-0 object-contain @min-[560px]:size-9"
          onError={() => setFailedLogo(identity.logo)}
        />
      )}
    </div>
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
