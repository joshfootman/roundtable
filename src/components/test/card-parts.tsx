import { equipmentName } from '#/replay/equipment'
import { equipmentIcon, equipmentIconForDefinition } from '#/replay/icons'
import type { PlayerCardData } from '#/replay/player-cards'
import type { ReplayWeapon } from '#/replay/types'

export function sideText(player: PlayerCardData) {
  return player.team === 3 ? 'text-(--side-ct)' : 'text-(--side-t)'
}
export function sideFill(player: PlayerCardData) {
  return player.team === 3 ? 'bg-(--side-ct)' : 'bg-(--side-t)'
}
export function health(player: PlayerCardData) {
  return player.alive ? Math.max(0, Math.min(100, player.health)) : 0
}

export function weaponLabel(weapon: ReplayWeapon) {
  if (weapon.type === 'none') return 'No weapon'
  return `${equipmentName(weapon.definition)}${weapon.type === 'gun' ? `, ${weapon.magazine}/${weapon.reserve}` : ''}`
}

export function WeaponIcon({ weapon, className }: { weapon: ReplayWeapon; className: string }) {
  if (weapon.type === 'none') return null
  const src = equipmentIconForDefinition(weapon.definition)
  const label = weaponLabel(weapon)
  return src ? (
    <img src={src} alt={label} title={label} className={`object-contain ${className}`} />
  ) : null
}

export function Grenades({ player, className }: { player: PlayerCardData; className: string }) {
  return player.inspection.grenades.flatMap((grenade) =>
    Array.from({ length: grenade.count }, (_, index) => (
      <img
        key={`${grenade.definition}-${index}`}
        src={equipmentIconForDefinition(grenade.definition)}
        alt={index === 0 ? `${equipmentName(grenade.definition)} × ${grenade.count}` : ''}
        title={equipmentName(grenade.definition)}
        className={`object-contain ${className}`}
      />
    )),
  )
}

export function Armour({ player, className }: { player: PlayerCardData; className: string }) {
  const { armour, helmet } = player.inspection
  if (!player.alive || armour <= 0) return null
  const label = `${armour} armour${helmet ? ', helmet' : ''}`
  return (
    <img
      src={equipmentIcon(helmet ? 'helmet' : 'kevlar')}
      alt={label}
      title={label}
      className={`object-contain ${className}`}
    />
  )
}

export function Bomb({ player, className }: { player: PlayerCardData; className: string }) {
  return player.carriesBomb ? (
    <img
      src={equipmentIcon('c4')}
      alt="Carrying C4"
      title="Carrying C4"
      className={`object-contain ${className}`}
    />
  ) : null
}

export function Flashed({ player, className }: { player: PlayerCardData; className: string }) {
  return player.alive && player.flashSeconds > 0 ? (
    <span className={className} title={`Flashed for ${player.flashSeconds.toFixed(1)}s`}>
      <img
        src={equipmentIcon('flashbang_assist')}
        alt=""
        className="h-full w-auto object-contain"
      />
      <span className="sr-only">Flashed for {player.flashSeconds.toFixed(1)} seconds</span>
    </span>
  ) : null
}

export function KillsDeaths({ player }: { player: PlayerCardData }) {
  return (
    <span className="data">
      <span className="text-(--text-muted)">K </span>
      {player.kills}
      <span className="text-(--text-muted)"> D </span>
      {player.deaths}
    </span>
  )
}

export function OwnedWeapons({ player, className }: { player: PlayerCardData; className: string }) {
  if (!player.alive) return null
  return player.otherWeapons.map((weapon) => (
    <WeaponIcon
      key={weapon.type === 'none' ? 'none' : weapon.definition}
      weapon={weapon}
      className={className}
    />
  ))
}
