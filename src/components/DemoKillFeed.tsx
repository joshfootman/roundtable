import { useEffect, useRef } from 'react'
import { killFeedAtTick } from '#/replay/kill-feed'
import { equipmentIcon, recordedWeaponName } from '#/replay/icons'
import type { ReplayRound } from '#/replay/types'
import headshotIcon from '../assets/cs2/deathnotice/icon_headshot.svg?url&no-inline'
import suicideIcon from '../assets/cs2/deathnotice/icon_suicide.svg?url&no-inline'

export function DemoKillFeed({ round, tick }: { round: ReplayRound; tick: number }) {
  const entries = killFeedAtTick(round, tick)
  const feed = useRef<HTMLOListElement>(null)
  const latestId = entries[0]?.id

  useEffect(() => {
    if (feed.current) feed.current.scrollTop = 0
  }, [latestId, round.startTick])

  return (
    <section
      className="demo-kill-feed z-20 w-[min(100%,360px)] min-w-0 self-end text-sm font-medium replay-desktop:absolute replay-desktop:top-28 replay-desktop:right-4 replay-desktop:w-80 min-[1600px]:replay-desktop:top-4 replay-landscape:col-start-1 replay-landscape:row-start-4 replay-landscape:w-full"
      aria-label="Kill feed"
    >
      {entries.length === 0 ? (
        <></>
      ) : (
        <ol
          ref={feed}
          className="demo-kill-feed-list m-0 flex max-h-44 [scrollbar-width:thin] [scrollbar-color:var(--color-neutral-600)_transparent] list-none flex-col items-end gap-1 overflow-y-auto overscroll-contain rounded-[14px] p-0.5 replay-desktop:max-h-[min(176px,23dvh)]"
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
    </section>
  )
}
