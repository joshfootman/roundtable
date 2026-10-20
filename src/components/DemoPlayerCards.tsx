import { useState } from 'react'
import { RollingNumber } from '#/components/RollingNumber'
import { equipmentName } from '#/replay/equipment'
import { EquipmentIcon, GameIcon, equipmentIcon } from '#/replay/icons'
import type { PlayerCardData } from '#/replay/player-cards'
import type { ReplayWeapon } from '#/replay/types'

export function DemoPlayerCards({
  players,
  presentation,
}: {
  players: readonly PlayerCardData[]
  presentation: 'inline' | 'overlay'
}) {
  return (
    <div
      aria-label="Player cards"
      className={`demo-player-cards ${presentation === 'inline' ? 'demo-player-cards-inline grid grid-cols-1 gap-4 px-2 pb-2 sm:grid-cols-2 replay-landscape:grid-cols-1' : 'demo-player-cards-overlay replay-desktop:pointer-events-none replay-desktop:absolute replay-desktop:inset-4 replay-desktop:top-[calc(--spacing(4)+var(--stage-lift))] replay-desktop:bottom-24 replay-desktop:grid replay-desktop:grid-cols-2 replay-desktop:items-end replay-desktop:gap-4'}`}
    >
      {([3, 2] as const).map((team) => (
        <ul
          key={team}
          tabIndex={-1}
          aria-label={team === 3 ? 'Counter-Terrorist players' : 'Terrorist players'}
          className={`demo-player-team flex min-h-0 min-w-0 flex-col gap-1 ${presentation === 'overlay' ? 'replay-desktop:pointer-events-auto replay-desktop:max-h-[calc(100%-200px)] replay-desktop:w-[min(100%,27vw,320px)] replay-desktop:overflow-y-auto replay-desktop:group-data-[multifloor=true]/round:max-h-[calc(100%-256px)] replay-desktop:last:justify-self-end min-[1728px]:replay-desktop:max-h-[calc(100%-268px)] min-[1728px]:replay-desktop:group-data-[multifloor=true]/round:max-h-[calc(100%-320px)]' : ''}`}
        >
          {players
            .filter((player) => player.team === team)
            .map((player) => (
              <PlayerCard key={player.steamId} player={player} />
            ))}
        </ul>
      ))}
    </div>
  )
}

export function PlayerCard({ player }: { player: PlayerCardData }) {
  const { money, armour, helmet } = player.inspection
  const weapon = player.mainWeapon
  const mirrored = player.team === 2
  const direction = mirrored ? 'flex-row-reverse' : ''
  const colour = mirrored ? 'text-t' : 'text-ct'
  const health = player.alive ? Math.max(0, Math.min(100, player.health)) : 0
  const [shownHealth, setShownHealth] = useState({ health, rising: false })
  if (shownHealth.health !== health) setShownHealth({ health, rising: health > shownHealth.health })
  const armoured = player.alive && armour > 0
  const armourLabel = armoured
    ? `${armour} armour, ${helmet ? 'helmet equipped' : 'no helmet'}`
    : 'No armour'
  const weaponLabel = weaponDescription(weapon)
  return (
    <li
      aria-label={`${player.name}, ${player.alive ? `${health} health` : 'dead'}`}
      className={`shrink-0 rounded-control bg-control px-2 py-1.5 text-sm leading-tight text-foreground tabular-nums replay-desktop:text-base ${player.alive ? '' : 'opacity-55'}`}
    >
      <div className={`flex flex-wrap items-center gap-2 py-1 ${direction}`}>
        <div className={`flex min-w-16 flex-1 items-center gap-2 ${direction}`}>
          <span
            className={`flex size-5 shrink-0 items-center justify-center rounded-chip text-xs font-bold text-inverse ${mirrored ? 'bg-t' : 'bg-ct'}`}
          >
            <span className="sr-only">Player </span>
            {player.number}
          </span>
          <span
            className="-translate-y-px truncate text-base leading-5 font-bold replay-desktop:text-lg replay-desktop:leading-5.5"
            title={player.name}
          >
            {player.name}
          </span>
        </div>
        <span
          title={weaponLabel}
          className={`flex w-10 shrink-0 items-center sm:w-14 [&_img]:mr-0 [&_img]:h-5 [&_img]:w-full ${mirrored ? 'justify-start [&_img]:object-left' : 'justify-end [&_img]:object-right'}`}
        >
          {weapon.type !== 'none' && <EquipmentIcon definition={weapon.definition} />}
          <span className="sr-only">{weaponLabel}</span>
        </span>
      </div>
      <div className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 ${direction}`}>
        <div className="flex flex-wrap items-center gap-x-2 font-semibold">
          {mirrored && (
            <span className="text-money" title="Money">
              ${money}
            </span>
          )}
          <span>
            <span className={`${colour} text-xs`} aria-hidden="true">
              K
            </span>
            <span className="sr-only">Kills</span> <RollingNumber value={player.kills} />
          </span>
          <span>
            <span className={`${colour} text-xs`} aria-hidden="true">
              D
            </span>
            <span className="sr-only">Deaths</span> <RollingNumber value={player.deaths} />
          </span>
          {!mirrored && (
            <span className="text-money" title="Money">
              ${money}
            </span>
          )}
        </div>
        <div
          className={`flex items-center gap-1 ${mirrored ? 'mr-auto flex-row-reverse' : 'ml-auto'}`}
        >
          <span className="flex items-center gap-1 [&_img]:mr-0 [&_img]:h-4 [&_img]:w-3">
            {player.carriesBomb && (
              <span title="Carrying C4">
                <EquipmentIcon definition={49} />
                <span className="sr-only">Carrying C4</span>
              </span>
            )}
            {player.flashSeconds > 0 && (
              <span title={`Flashed for ${player.flashSeconds.toFixed(1)} seconds`}>
                <GameIcon src={equipmentIcon('flashbang_assist')} />
                <span className="sr-only">
                  Flashed for {player.flashSeconds.toFixed(1)} seconds
                </span>
              </span>
            )}
          </span>
          <span className="flex items-center gap-0.5 [&_img]:mr-0 [&_img]:size-4">
            {player.utility.map((slot, index) =>
              slot.owned ? (
                <span key={index} title={equipmentName(slot.definition)}>
                  <EquipmentIcon definition={slot.definition} />
                  <span className="sr-only">{equipmentName(slot.definition)}</span>
                </span>
              ) : (
                <span key={index} aria-hidden="true" className="opacity-20">
                  <EquipmentIcon definition={slot.definition} />
                </span>
              ),
            )}
          </span>
        </div>
      </div>
      <div className={`mt-1.25 flex items-center gap-1.5 ${direction}`}>
        <div className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-bar bg-track">
          {/*
            Losses snap the fill and leave the red layer behind; each hit restarts its delayed
            transition, so a burst drains as one chunk. Gains ease the fill up over the red layer.
          */}
          <div
            className={`absolute inset-y-0 rounded-bar bg-damage transition-[width] delay-400 duration-500 ease-in-out motion-reduce:transition-none ${mirrored ? 'right-0' : 'left-0'}`}
            style={{ width: `${health}%` }}
          />
          <div
            className={`absolute inset-y-0 rounded-bar ${mirrored ? 'right-0 bg-t' : 'left-0 bg-ct'} ${shownHealth.rising ? 'transition-[width] duration-300 ease-out-expo motion-reduce:transition-none' : ''}`}
            style={{ width: `${health}%` }}
          />
        </div>
        <span
          className={`w-8 shrink-0 font-bold ${mirrored ? 'text-left' : 'text-right'}`}
          title="Health"
        >
          {health}
        </span>
        <span
          title={armourLabel}
          className="relative flex shrink-0 items-center [&_img]:mr-0 [&_img]:h-4 [&_img]:w-6"
        >
          <span className="opacity-20">
            <GameIcon src={equipmentIcon('armor_helmet')} />
          </span>
          {armoured && (
            // The vest starts at 43% of the icon's width, so clipping there leaves the helmet ghosted.
            <span
              className={`absolute inset-0 flex items-center ${helmet ? '' : '[clip-path:inset(0_0_0_43%)]'}`}
            >
              <GameIcon src={equipmentIcon('armor_helmet')} />
            </span>
          )}
          <span className="sr-only">{armourLabel}</span>
        </span>
      </div>
    </li>
  )
}

function weaponDescription(weapon: ReplayWeapon): string {
  if (weapon.type === 'none') return 'No weapon'
  return `${equipmentName(weapon.definition)}${weapon.type === 'gun' ? `, ${weapon.magazine}/${weapon.reserve} ammunition` : ''}`
}
