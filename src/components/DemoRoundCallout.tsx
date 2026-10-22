import type { RoundCallout } from '#/replay/round-callout'
import './round-callout.css'

export function DemoRoundCallout({
  callout,
  onDone,
}: {
  callout: RoundCallout
  onDone: () => void
}) {
  const headline = callout.kind === 'round' ? `Round ${callout.number}` : `${callout.team} win`
  return (
    <output
      aria-live="polite"
      className="round-callout"
      data-side={callout.kind === 'win' ? callout.side : undefined}
      style={{ '--callout-chars': headline.length } as React.CSSProperties}
      onAnimationEnd={(event) => {
        if (event.animationName === 'callout-out') onDone()
      }}
    >
      <span className="row-start-2">{headline}</span>
    </output>
  )
}
