import { equipmentName } from '#/replay/equipment'
import { EquipmentIcon, GameIcon, equipmentIcon } from '#/replay/icons'
import { playerCardsAtTick } from '#/replay/player-cards'
import type { PlayerCardData } from '#/replay/player-cards'
import type { ReplayRound, ReplayWeapon } from '#/replay/types'

export function DemoPlayerCards({
  rounds,
  round,
  tick,
  hasFloorControl = false,
}: {
  rounds: readonly ReplayRound[]
  round: ReplayRound
  tick: number
  hasFloorControl?: boolean
}) {
  const players = playerCardsAtTick(rounds, round, tick)
  return (
    <div
      aria-label="Player cards"
      className="pointer-events-none absolute inset-4 bottom-24 grid grid-cols-2 items-end gap-4 xl:bottom-4"
    >
      {([3, 2] as const).map((team) => (
        <ul
          key={team}
          aria-label={team === 3 ? 'Counter-Terrorist players' : 'Terrorist players'}
          className={`pointer-events-auto flex ${hasFloorControl ? 'max-h-[calc(100%-10rem)] md:max-h-[calc(100%-7rem)]' : 'max-h-[calc(100%-7rem)]'} min-h-0 w-full max-w-80 flex-col gap-1 overflow-y-auto ${team === 2 ? 'justify-self-end' : ''}`}
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

function PlayerCard({ player }: { player: PlayerCardData }) {
  const { money, armour, helmet, grenades } = player.inspection
  const weapon = player.inspection.weapon
  const mirrored = player.team === 2
  const direction = mirrored ? 'flex-row-reverse' : ''
  const colour = mirrored ? 'text-t' : 'text-ct'
  const health = player.alive ? Math.max(0, Math.min(100, player.health)) : 0
  const weaponLabel = `Active weapon, ${weaponDescription(weapon)}`
  return (
    <li
      aria-label={`${player.name}, ${player.alive ? `${health} health` : 'dead'}`}
      className={`shrink-0 rounded-lg bg-neutral-700/50 px-2 py-1.5 text-base leading-tight text-mauve-200 tabular-nums ${player.alive ? '' : 'opacity-55'}`}
    >
      <div className={`flex flex-wrap items-center gap-2 py-1 ${direction}`}>
        <div className={`flex min-w-16 flex-1 items-center gap-2 ${direction}`}>
          <span
            className={`flex size-5 shrink-0 items-center justify-center rounded-md text-xs font-bold text-neutral-800 ${mirrored ? 'bg-t' : 'bg-ct'}`}
          >
            <span className="sr-only">Player </span>
            {player.number}
          </span>
          <span className="truncate font-bold" title={player.name}>
            {player.name}
          </span>
        </div>
        <div
          className={`flex shrink-0 items-center gap-1 ${mirrored ? 'mr-auto' : 'ml-auto flex-row-reverse'}`}
        >
          <span
            title={weaponLabel}
            className={`flex w-10 shrink-0 items-center sm:w-14 [&_img]:mr-0 [&_img]:h-5 [&_img]:w-full ${mirrored ? 'justify-start [&_img]:object-left' : 'justify-end [&_img]:object-right'}`}
          >
            {weapon.type !== 'none' && <EquipmentIcon definition={weapon.definition} />}
            <span className="sr-only">{weaponLabel}</span>
          </span>
          {player.otherWeapons.map((owned) => {
            const label = `Owned weapon, ${weaponDescription(owned)}`
            return (
              <span
                key={owned.type === 'none' ? 'none' : owned.definition}
                title={label}
                className="flex w-4 shrink-0 items-center opacity-65 sm:w-6 [&_img]:mr-0 [&_img]:h-3 [&_img]:w-full"
              >
                {owned.type !== 'none' && <EquipmentIcon definition={owned.definition} />}
                <span className="sr-only">{label}</span>
              </span>
            )
          })}
        </div>
      </div>
      <div className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 ${direction}`}>
        <div className="flex flex-wrap items-center gap-x-2 font-semibold">
          {mirrored && (
            <span className="text-green-400" title="Money">
              ${money}
            </span>
          )}
          <span>
            <span className={`${colour} text-sm`} aria-hidden="true">
              K
            </span>
            <span className="sr-only">Kills</span> {player.kills}
          </span>
          <span>
            <span className={`${colour} text-sm`} aria-hidden="true">
              D
            </span>
            <span className="sr-only">Deaths</span> {player.deaths}
          </span>
          {!mirrored && (
            <span className="text-green-400" title="Money">
              ${money}
            </span>
          )}
        </div>
        <div
          className={`flex flex-wrap items-center gap-1 [&_img]:mr-0 [&_img]:h-4 [&_img]:w-3 ${mirrored ? 'mr-auto' : 'ml-auto'}`}
        >
          {armour > 0 && (
            <span title={`Armour ${armour}${helmet ? ', helmet equipped' : ', no helmet'}`}>
              <GameIcon src={equipmentIcon(helmet ? 'helmet' : 'kevlar')} />
              <span className="sr-only">
                {armour} armour{helmet ? ', helmet equipped' : ''}
              </span>
            </span>
          )}
          {grenades.map((grenade) => (
            <span
              key={grenade.definition}
              title={`${equipmentName(grenade.definition)} × ${grenade.count}`}
              className="flex items-center gap-0.5"
            >
              {Array.from({ length: grenade.count }, (_, index) => (
                <EquipmentIcon key={index} definition={grenade.definition} />
              ))}
              <span className="sr-only">
                {equipmentName(grenade.definition)} × {grenade.count}
              </span>
            </span>
          ))}
          {player.carriesBomb && (
            <span title="Carrying C4">
              <EquipmentIcon definition={49} />
              <span className="sr-only">Carrying C4</span>
            </span>
          )}
          {player.flashSeconds > 0 && (
            <span title={`Flashed for ${player.flashSeconds.toFixed(1)} seconds`}>
              <GameIcon src={equipmentIcon('flashbang_assist')} />
              <span className="sr-only">Flashed for {player.flashSeconds.toFixed(1)} seconds</span>
            </span>
          )}
        </div>
      </div>
      <div className={`flex items-center gap-1.5 ${direction}`}>
        <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-xs bg-mauve-200/15">
          <div
            className={`h-full rounded-xs ${mirrored ? 'ml-auto bg-t' : 'bg-ct'}`}
            style={{ width: `${health}%` }}
          />
        </div>
        <span
          className={`w-8 shrink-0 font-bold ${mirrored ? 'text-left' : 'text-right'}`}
          title="Health"
        >
          {health}
        </span>
      </div>
    </li>
  )
}

function weaponDescription(weapon: ReplayWeapon): string {
  if (weapon.type === 'none') return 'No active weapon'
  return `${equipmentName(weapon.definition)}${weapon.type === 'gun' ? `, ${weapon.magazine}/${weapon.reserve} ammunition` : ''}`
}
