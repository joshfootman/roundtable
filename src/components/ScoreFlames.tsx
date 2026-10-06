import { useEffect, useId, useRef } from 'react'
import { mountScoreFlames } from './score-flames'

export function ScoreFlames({ side }: { side: 'ct' | 't' }) {
  const gradient = useId()
  const surface = useRef<HTMLSpanElement>(null)
  const fallback = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const host = surface.current
    if (!host) return
    if (fallback.current) fallback.current.hidden = true
    const canvas = document.createElement('canvas')
    canvas.className = 'absolute inset-0 size-full'
    host.append(canvas)
    const dispose = mountScoreFlames(canvas, side, () => {
      canvas.hidden = true
      if (fallback.current) fallback.current.hidden = false
    })
    return () => {
      canvas.remove()
      dispose()
    }
  }, [side])
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <span ref={surface} className="absolute inset-0" />
      <span ref={fallback} hidden>
        <svg
          viewBox="0 0 72 72"
          preserveAspectRatio="none"
          className={`absolute inset-0 size-full opacity-30 ${side === 'ct' ? 'text-blue-500' : 'text-orange-500'}`}
        >
          <defs>
            <linearGradient id={gradient} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor={side === 'ct' ? '#e6fbff' : '#fff6d2'} />
              <stop offset=".3" stopColor={side === 'ct' ? '#62dcff' : '#ffc649'} />
              <stop offset="1" stopColor={side === 'ct' ? '#0c6ae8' : '#f34d0c'} />
            </linearGradient>
          </defs>
          <path fill={side === 'ct' ? '#164c80' : '#773016'} fillOpacity=".8" d="M0 0H72V72H0Z" />
          <path
            fill={`url(#${gradient})`}
            d="M0 72V48C8 43 3 24 17 10C9 28 29 25 24 46C22 57 37 47 34 35C31 20 40 8 47 0C40 23 54 20 51 39C49 48 60 50 61 31C61 23 67 17 72 12V72Z"
          />
          <path
            fill={side === 'ct' ? '#e6fbff' : '#fff6d2'}
            fillOpacity=".8"
            d="M0 72V65C14 69 13 58 17 50C15 65 30 68 34 48C44 59 39 69 50 68C55 65 61 56 62 49C60 68 71 65 72 64V72Z"
          />
        </svg>
      </span>
    </span>
  )
}
