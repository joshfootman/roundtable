import { useId, useState, type ReactNode } from 'react'
import type { ReplayRound } from '#/replay/types'
import type { ExampleId } from '#/demo/examples'
import { roundTeams, type TeamIdentity } from '#/replay/team-identity'
import { RollingNumber } from '#/components/RollingNumber'
import { DemoRoundPicker } from './DemoRoundPicker'
import { ScoreFlames } from './ScoreFlames'
import { roundWinningStreaks, winningStreakThreshold } from '#/replay/winning-streaks'

export function DemoRoundControl({
  rounds,
  round,
  tick,
  onSelectRound,
  previousRound,
  focusRoundPicker = false,
  example,
  highlightNextRound = false,
  mobileControls,
  desktop,
}: {
  desktop: boolean
  mobileControls?: ReactNode
  rounds: readonly ReplayRound[]
  round: ReplayRound
  tick: number
  previousRound?: number
  focusRoundPicker?: boolean
  example?: ExampleId
  highlightNextRound?: boolean
  onSelectRound: (number: number, focusPicker?: boolean) => void
}) {
  const streakDescription = useId()
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
  const streaks = roundWinningStreaks(rounds, round, tick)
  const button =
    'flex cursor-pointer items-center justify-center rounded-xl outline-offset-2 enabled:hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-mauve-200 disabled:cursor-default disabled:opacity-35'

  const scoreboard = (
    <div
      key="scoreboard"
      className="col-span-full row-start-2 grid h-12 min-w-0 grid-cols-[minmax(0,1fr)_40px_64px_40px_minmax(0,1fr)] grid-rows-1 items-center rounded-xl bg-neutral-700/50 @min-[560px]:grid-cols-[minmax(0,1fr)_72px_112px_72px_minmax(0,1fr)] replay-desktop:col-span-1 replay-desktop:col-start-2 replay-desktop:row-start-1 replay-desktop:h-14"
    >
      <Team identity={teams.ct} />
      <div
        aria-label="Counter-Terrorist score"
        aria-describedby={
          streaks.ct >= winningStreakThreshold ? `${streakDescription}-ct` : undefined
        }
        className="relative isolate flex h-15 items-center justify-center self-start overflow-hidden rounded-b-xl bg-ct/80 text-2xl font-bold text-neutral-800 @min-[560px]:text-3xl replay-desktop:h-18"
      >
        {streaks.ct >= winningStreakThreshold && <ScoreFlames side="ct" />}
        <span className="relative z-10">
          <RollingNumber value={score?.ct} />
        </span>
        {streaks.ct >= winningStreakThreshold && (
          <span id={`${streakDescription}-ct`} className="sr-only">
            {streaks.ct} consecutive round wins
          </span>
        )}
      </div>
      <DemoRoundPicker
        rounds={rounds}
        round={round}
        time={time}
        previousRound={previousRound}
        focusOnMount={focusRoundPicker}
        onSelectRound={onSelectRound}
      />
      <div
        aria-label="Terrorist score"
        aria-describedby={
          streaks.t >= winningStreakThreshold ? `${streakDescription}-t` : undefined
        }
        className="relative isolate flex h-15 items-center justify-center self-start overflow-hidden rounded-b-xl bg-t/80 text-2xl font-bold text-neutral-800 @min-[560px]:text-3xl replay-desktop:h-18"
      >
        {streaks.t >= winningStreakThreshold && <ScoreFlames side="t" />}
        <span className="relative z-10">
          <RollingNumber value={score?.t} />
        </span>
        {streaks.t >= winningStreakThreshold && (
          <span id={`${streakDescription}-t`} className="sr-only">
            {streaks.t} consecutive round wins
          </span>
        )}
      </div>
      <Team identity={teams.t} reverse />
    </div>
  )

  return (
    <section
      aria-label="Round controls"
      className="demo-round-controls @container z-30 w-full min-w-0 self-center text-mauve-200 tabular-nums sm:w-[min(100%,840px)] replay-desktop:absolute replay-desktop:top-4 replay-desktop:left-1/2 replay-desktop:w-[min(840px,calc(100%-32px))] replay-desktop:-translate-x-1/2 replay-landscape:col-start-1 replay-landscape:row-start-1 replay-landscape:w-full"
    >
      <nav
        aria-label="Round navigation"
        className="grid grid-cols-[minmax(44px,1fr)_auto_minmax(44px,1fr)] items-center gap-2 pb-4 replay-desktop:grid-cols-[56px_minmax(0,1fr)_56px]"
      >
        <button
          type="button"
          aria-label="Previous round"
          aria-keyshortcuts="ArrowLeft"
          title="Previous round (←)"
          disabled={!previous}
          onClick={() => previous && onSelectRound(previous.number)}
          className={`${button} col-start-1 row-start-1 h-11 w-full min-w-11 shrink-0 bg-neutral-700/50 replay-desktop:h-14 replay-desktop:w-14`}
        >
          <Chevron direction="left" />
        </button>
        {desktop ? (
          scoreboard
        ) : (
          <div className="col-start-2 row-start-1 flex items-center justify-center gap-2">
            {mobileControls}
          </div>
        )}
        <button
          type="button"
          aria-label="Next round"
          aria-keyshortcuts="ArrowRight"
          title="Next round (→)"
          disabled={!next}
          onClick={() => next && onSelectRound(next.number)}
          className={`${button} relative col-start-3 row-start-1 h-11 w-full min-w-11 shrink-0 bg-neutral-700/50 replay-desktop:h-14 replay-desktop:w-14`}
        >
          <Chevron direction="right" />
          {highlightNextRound && next && (
            <span
              aria-hidden="true"
              className="demo-next-round-hint pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 ring-2 ring-ct motion-safe:animate-demo-next-round-hint motion-reduce:opacity-70"
            />
          )}
        </button>
        {!desktop && scoreboard}
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
