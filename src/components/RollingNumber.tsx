import { useState } from 'react'

export function RollingNumber({
  value,
  previous,
}: {
  value: number | undefined
  previous?: number
}) {
  const [display, setDisplay] = useState({ value, previous })
  if (display.value !== value) setDisplay({ value, previous: display.value })
  const rolls =
    value !== undefined && display.previous !== undefined && value === display.previous + 1

  return (
    <span
      className="demo-number inline-block h-[1.25em] min-w-[0.7em] overflow-hidden text-center align-middle leading-[1.25]"
      aria-label={value === undefined ? 'Unknown' : String(value)}
    >
      <span
        key={value ?? 'unknown'}
        className={`block h-[1.25em] *:block *:h-[1.25em] ${rolls ? 'demo-number-roll animate-demo-number-up motion-reduce:-translate-y-full motion-reduce:animate-none' : ''}`}
        onAnimationEnd={() => setDisplay({ value, previous: undefined })}
        aria-hidden="true"
      >
        {rolls && <span>{display.previous}</span>}
        <span>{value ?? '—'}</span>
      </span>
    </span>
  )
}
