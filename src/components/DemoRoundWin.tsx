import type { ReplayRound } from '#/replay/types'

export function DemoRoundWin({ outcome }: { outcome: NonNullable<ReplayRound['outcome']> }) {
  const winner = outcome.teamName || (outcome.winner === 'ct' ? 'Counter-Terrorists' : 'Terrorists')
  const headline = `${winner} won`.toUpperCase()
  return (
    <output
      aria-live="polite"
      className={`demo-round-win @container pointer-events-none absolute top-1/2 left-1/2 z-20 block h-[clamp(82px,20cqw,116px)] w-[min(560px,calc(100%-24px))] -translate-1/2 ${outcome.winner === 'ct' ? 'text-ct' : 'text-t'}`}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 animate-demo-win-surface border-t border-b border-t-white/10 border-b-black/40 bg-[radial-gradient(circle,#ffffff0c_0.6px,transparent_0.8px),linear-gradient(90deg,#252b31ed,#30343aea_50%,#252b31ed)] [background-size:3px_3px,100%_100%] motion-reduce:animate-demo-win-reduced"
      />
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1 animate-demo-win-edge bg-current [--edge-offset:16px] motion-reduce:animate-demo-win-reduced"
      />
      <div
        aria-hidden="true"
        className="absolute inset-y-0 right-0 w-1 animate-demo-win-edge bg-current [--edge-offset:-16px] motion-reduce:animate-demo-win-reduced"
      />
      <div className="absolute inset-0 grid animate-demo-win-title grid-cols-[24px_minmax(0,1fr)_24px] items-center gap-3 px-3 motion-reduce:animate-demo-win-reduced sm:grid-cols-[28px_minmax(0,1fr)_28px] sm:gap-5 sm:px-5">
        <Chevron />
        <div className="grid h-full min-w-0 grid-rows-[1fr_auto_1fr] text-center">
          <p className="sr-only">{headline}</p>
          <svg
            aria-hidden="true"
            viewBox="0 5.344 440 41.552"
            className="row-start-2 block h-[clamp(33.56px,9.589cqw,54.34px)] w-full overflow-visible"
            preserveAspectRatio="none"
          >
            <text
              x="220"
              y="46"
              textAnchor="middle"
              textLength="420"
              lengthAdjust="spacingAndGlyphs"
              fill="currentColor"
              className="font-sans text-[56px] font-semibold"
            >
              {headline}
            </text>
          </svg>
          {outcome.mvp && (
            <p className="row-start-3 self-center truncate text-[clamp(10px,2.5cqw,13px)] leading-tight font-medium text-mauve-100">
              MVP: {outcome.mvp.name}
            </p>
          )}
        </div>
        <Chevron reverse />
      </div>
    </output>
  )
}

function Chevron({ reverse = false }: { reverse?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      className={`w-full opacity-85 ${reverse ? 'rotate-180' : ''}`}
    >
      <path d="m3 7 9 9-9 9m8-18 9 9-9 9" />
    </svg>
  )
}
