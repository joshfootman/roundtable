/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- Scrollable history needs keyboard focus for Arrow/Page Up/Page Down navigation. */
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
    <section className="demo-kill-feed" aria-label="Kill feed">
      {entries.length === 0 ? (
        <></>
      ) : (
        <ol
          ref={feed}
          className="demo-kill-feed-list"
          tabIndex={0}
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
                className="demo-kill-feed-entry"
                aria-label={description}
                title={description}
              >
                {!entry.suicide && (
                  <span className="demo-kill-feed-name" data-team={entry.attacker?.team}>
                    {entry.attacker?.name ?? 'World'}
                  </span>
                )}
                <span className="demo-kill-feed-weapon" aria-hidden="true">
                  {icon ? <img src={icon} alt="" /> : <span>{weapon}</span>}
                  {entry.headshot && (
                    <img className="demo-kill-feed-headshot" src={headshotIcon} alt="" />
                  )}
                </span>
                <span className="demo-kill-feed-name" data-team={entry.target.team}>
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
