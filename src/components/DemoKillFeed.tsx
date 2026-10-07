import { useEffect, useRef } from 'react'
import { Popover } from '@base-ui/react/popover'
import { killFeedAtTick } from '#/replay/kill-feed'
import { equipmentIcon, recordedWeaponName } from '#/replay/icons'
import type { ReplayRound } from '#/replay/types'
import headshotIcon from '../assets/cs2/deathnotice/icon_headshot.svg?url&no-inline'
import suicideIcon from '../assets/cs2/deathnotice/icon_suicide.svg?url&no-inline'

export function DemoKillFeed({ round, tick }: { round: ReplayRound; tick: number }) {
  return (
    <section
      aria-label="Kill feed"
      className="demo-kill-feed z-20 hidden min-w-0 text-sm font-medium replay-desktop:absolute replay-desktop:top-28 replay-desktop:right-4 replay-desktop:block replay-desktop:w-80 min-[1600px]:replay-desktop:top-4"
    >
      <Feed round={round} tick={tick} />
    </section>
  )
}

export function DemoKillFeedDropdown({ round, tick }: { round: ReplayRound; tick: number }) {
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label="Kill feed"
        className="flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-lg bg-neutral-700/50 px-3 text-xs font-medium text-mauve-200 outline-offset-2 hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-mauve-200"
      >
        Kill feed
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="size-3"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} collisionPadding={16} className="z-50">
          <Popover.Popup
            aria-label="Round kill feed"
            className="max-h-[var(--available-height)] w-[min(320px,calc(100vw-32px))] overflow-y-auto rounded-2xl border border-neutral-700 bg-neutral-800 p-2 text-xs font-medium text-mauve-200 shadow-xl outline-none"
          >
            <Feed round={round} tick={tick} empty />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

function Feed({
  round,
  tick,
  empty = false,
}: {
  round: ReplayRound
  tick: number
  empty?: boolean
}) {
  const entries = killFeedAtTick(round, tick)
  const feed = useRef<HTMLOListElement>(null)
  const latestId = entries[0]?.id

  useEffect(() => {
    if (feed.current) feed.current.scrollTop = 0
  }, [latestId, round.startTick])

  return (
    <>
      {entries.length === 0 ? (
        empty ? (
          <p className="px-3 py-4 text-center text-mauve-300">No kills yet this round</p>
        ) : null
      ) : (
        <ol
          ref={feed}
          className="demo-kill-feed-list m-0 flex max-h-[min(240px,var(--available-height,240px))] [scrollbar-width:thin] [scrollbar-color:var(--color-neutral-600)_transparent] list-none flex-col items-end gap-1 overflow-y-auto overscroll-contain rounded-[14px] p-0.5 replay-desktop:max-h-[min(176px,23dvh)]"
          tabIndex={-1}
          aria-label="Round kills, latest first"
        >
          {entries.map((entry) => {
            const weapon = recordedWeaponName(entry.weapon)
            const icon = entry.suicide ? suicideIcon : equipmentIcon(entry.weapon)
            const description = entry.suicide
              ? `${entry.target.name} died by suicide`
              : `${entry.attacker?.name ?? 'World'} killed ${entry.target.name} with ${weapon}${entry.headshot ? ', headshot' : ''}`
            return (
              <li
                key={entry.id}
                className="demo-kill-feed-entry flex min-h-8 max-w-full shrink-0 items-center justify-end gap-2.5 rounded-xl bg-neutral-700/50 px-2.5 py-[5px]"
                aria-label={description}
                title={description}
              >
                {!entry.suicide && (
                  <span
                    className="demo-kill-feed-name min-w-0 truncate data-[team=2]:text-t data-[team=3]:text-ct"
                    data-team={entry.attacker?.team}
                  >
                    {entry.attacker?.name ?? 'World'}
                  </span>
                )}
                <span
                  className="demo-kill-feed-weapon flex shrink-0 items-center gap-1.5 text-white [&_img]:h-[18px] [&_img]:w-[42px] [&_img]:object-contain"
                  aria-hidden="true"
                >
                  {icon ? <img src={icon} alt="" /> : <span>{weapon}</span>}
                  {entry.headshot && (
                    <img className="demo-kill-feed-headshot !w-[18px]" src={headshotIcon} alt="" />
                  )}
                </span>
                <span
                  className="demo-kill-feed-name min-w-0 truncate data-[team=2]:text-t data-[team=3]:text-ct"
                  data-team={entry.target.team}
                >
                  {entry.target.name}
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </>
  )
}
