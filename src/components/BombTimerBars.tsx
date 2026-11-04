import { useEffect, useMemo, useState } from 'react'
import { activeBombTimers, bombTimers, type ActiveBombTimers } from '#/replay/bomb-timers'
import { equipmentIcon } from '#/replay/icons'
import type { ReplayRound } from '#/replay/types'

/** Plant and fuse in the T colour, a defuse under it in the CT colour, following every drawn frame. The fuse and defuse empty as they run out. */
export function BombTimerBars({
  round,
  tick,
  subscribeFrame,
}: {
  round: ReplayRound
  tick: number
  subscribeFrame?: (listener: (tick: number) => void) => () => void
}) {
  const timers = useMemo(() => bombTimers(round), [round])
  const [active, setActive] = useState(() => activeBombTimers(timers, tick))
  useEffect(
    () =>
      subscribeFrame?.((frameTick) => {
        const next = activeBombTimers(timers, frameTick)
        setActive((previous) => (same(previous, next) ? previous : next))
      }),
    [subscribeFrame, timers],
  )

  if (!active.bomb && active.defuse === undefined) return null
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-full mt-2 flex flex-col gap-2"
    >
      {active.bomb && (
        <Bar
          side="t"
          fill={active.bomb.kind === 'fuse' ? 1 - active.bomb.progress : active.bomb.progress}
        />
      )}
      {active.defuse !== undefined && <Bar side="ct" fill={1 - active.defuse} />}
    </div>
  )
}

const sides = {
  t: { icon: equipmentIcon('c4'), fill: 'bg-t/80' },
  ct: { icon: equipmentIcon('defuser'), fill: 'bg-ct/80' },
}

function Bar({ side, fill }: { side: keyof typeof sides; fill: number }) {
  return (
    <div className="flex items-center gap-2">
      <img src={sides[side].icon} alt="" className="size-4 shrink-0 object-contain" />
      <div className="h-2.5 flex-1 overflow-hidden rounded-chip bg-field">
        <div
          className={`h-full origin-left ${sides[side].fill}`}
          style={{ transform: `scaleX(${fill})` }}
        />
      </div>
    </div>
  )
}

function same(a: ActiveBombTimers, b: ActiveBombTimers) {
  return (
    a.bomb?.kind === b.bomb?.kind && a.bomb?.progress === b.bomb?.progress && a.defuse === b.defuse
  )
}
