import type { ComponentType } from 'react'
import type { PlayerCardData } from '#/replay/player-cards'
import { PlayerCard as CurrentCard } from '../DemoPlayerCards'
import {
  Armour,
  Bomb,
  Flashed,
  Grenades,
  KillsDeaths,
  OwnedWeapons,
  WeaponIcon,
  health,
  sideFill,
  sideText,
} from './card-parts'

/** One card design: how it lays out a player and whether teams sit in side columns or a strip. */
export interface CardVariant {
  id: string
  label: string
  layout: 'columns' | 'strip'
  Card: ComponentType<{ player: PlayerCardData }>
}

export const cardVariants: CardVariant[] = [
  { id: 'current', label: 'Current', layout: 'columns', Card: CurrentCard },
  { id: 'iem', label: 'IEM 2026', layout: 'columns', Card: IemCard },
  { id: 'blast', label: 'BLAST', layout: 'strip', Card: BlastCard },
  { id: 'pgl', label: 'PGL', layout: 'columns', Card: PglCard },
  { id: 'starladder', label: 'StarLadder / CCT', layout: 'strip', Card: StarLadderCard },
]

function label(player: PlayerCardData) {
  return `${player.name}, ${player.alive ? `${health(player)} health` : 'dead'}`
}

/** IEM: number, name and K/D/money stacked; weapon and utility beside; health as the big number. */
function IemCard({ player }: { player: PlayerCardData }) {
  const t = player.team === 2
  return (
    <li
      aria-label={label(player)}
      className={`@container flex rounded-(--radius-xs) bg-(--neutral-2) ${t ? 'flex-row-reverse' : ''} ${player.alive ? '' : 'opacity-50'}`}
    >
      <span
        className={`flex w-(--space-xl) shrink-0 items-start justify-center pt-(--space-xs) data type-s weight-medium text-(--neutral-1) ${sideFill(player)} ${t ? 'rounded-r-(--radius-xs)' : 'rounded-l-(--radius-xs)'}`}
      >
        {player.number}
      </span>
      <div
        className={`flex min-w-0 flex-1 items-center gap-(--space-s) px-(--space-s) py-(--space-xs) ${t ? 'flex-row-reverse text-right' : ''}`}
      >
        <div className="flex min-w-0 flex-col">
          <span className="truncate type-m weight-medium uppercase">{player.name}</span>
          <span className="type-s">
            <KillsDeaths player={player} />
          </span>
          <span className="data type-s text-(--money)">${player.inspection.money}</span>
        </div>
        <div
          className={`flex min-w-0 flex-1 flex-col gap-(--space-xxs) ${t ? 'items-start' : 'items-end'}`}
        >
          <span className={`flex items-center gap-(--space-xs) ${t ? 'flex-row-reverse' : ''}`}>
            <OwnedWeapons player={player} className="h-(--line-xs) max-w-10 opacity-60" />
            {player.alive && (
              <WeaponIcon weapon={player.inspection.weapon} className="h-(--line-m) max-w-24" />
            )}
          </span>
          <span className={`flex items-center gap-(--space-xxs) ${t ? 'flex-row-reverse' : ''}`}>
            {player.alive && <Grenades player={player} className="h-(--line-xs) w-auto" />}
            <Bomb player={player} className="h-(--line-xs) w-auto" />
            <Flashed player={player} className="h-(--line-xs)" />
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-(--space-xxs)">
          <span className="data type-l weight-medium">{player.alive ? health(player) : '–'}</span>
          <Armour player={player} className="size-(--space-m) opacity-70" />
        </div>
      </div>
    </li>
  )
}

/** BLAST: a tall card in team colour, health large in the corner, weapon along the bottom. */
function BlastCard({ player }: { player: PlayerCardData }) {
  return (
    <li
      aria-label={label(player)}
      className={`@container flex flex-col overflow-hidden rounded-(--radius-xs) ${player.alive ? `${sideFill(player)} text-(--neutral-1)` : 'bg-(--neutral-3) text-(--text-muted)'}`}
    >
      <div className="flex items-start justify-between gap-(--space-xs) px-(--space-s) pt-(--space-xs)">
        <span className="data type-xs weight-medium">{player.number}</span>
        <span className="flex items-center gap-(--space-xxs)">
          <Flashed player={player} className="h-(--line-xs) invert" />
          <Bomb player={player} className="h-(--line-xs) w-auto invert" />
          <span className="data type-xl weight-medium">{player.alive ? health(player) : 0}</span>
        </span>
      </div>
      <span className="truncate px-(--space-s) text-right type-s weight-medium uppercase">
        {player.name}
      </span>
      <div className="flex justify-between gap-(--space-xs) bg-(--neutral-2) px-(--space-s) py-(--space-xxs) data type-xs text-(--text-strong)">
        <span>
          <KillsDeaths player={player} />
        </span>
        <span className="text-(--money)">${player.inspection.money}</span>
      </div>
      <div className="flex flex-col gap-(--space-xxs) bg-(--neutral-1) px-(--space-s) py-(--space-xs)">
        <span className="flex min-h-(--line-s) min-w-0 items-center justify-between gap-(--space-xs)">
          {player.alive && (
            <WeaponIcon weapon={player.inspection.weapon} className="h-(--line-s) max-w-20" />
          )}
          <span className="flex items-center gap-(--space-xs)">
            <OwnedWeapons player={player} className="h-(--line-xxs) max-w-8 opacity-60" />
          </span>
        </span>
        <span className="flex min-h-(--line-xs) items-center justify-between gap-(--space-xxs)">
          <span className="flex items-center gap-(--space-xxs)">
            {player.alive && <Grenades player={player} className="h-(--line-xs) w-auto" />}
          </span>
          <Armour player={player} className="size-(--space-m) opacity-70" />
        </span>
      </div>
    </li>
  )
}

/** PGL: name and K/D first, money and utility next, then a full-width health bar holding the weapon. */
function PglCard({ player }: { player: PlayerCardData }) {
  const t = player.team === 2
  return (
    <li
      aria-label={label(player)}
      className={`@container flex flex-col overflow-hidden rounded-(--radius-xs) bg-(--neutral-2) ${player.alive ? '' : 'opacity-50'}`}
    >
      <div
        className={`flex items-baseline justify-between gap-(--space-s) px-(--space-s) pt-(--space-xs) ${t ? 'flex-row-reverse' : ''}`}
      >
        <span className="truncate type-m weight-medium">{player.name}</span>
        <span className="shrink-0 type-s">
          <KillsDeaths player={player} />
        </span>
      </div>
      <div
        className={`flex items-center justify-between gap-(--space-s) px-(--space-s) pb-(--space-xs) ${t ? 'flex-row-reverse' : ''}`}
      >
        <span className="data type-s weight-medium">${player.inspection.money}</span>
        <span className={`flex items-center gap-(--space-xxs) ${t ? 'flex-row-reverse' : ''}`}>
          {player.alive && <Grenades player={player} className="h-(--line-xs) w-auto" />}
          <Bomb player={player} className="h-(--line-xs) w-auto" />
          <Flashed player={player} className="h-(--line-xs)" />
        </span>
      </div>
      <div
        className={`flex min-h-(--line-m) items-center gap-(--space-xs) px-(--space-s) pb-(--space-xs) ${t ? 'flex-row-reverse' : ''}`}
      >
        {player.alive && (
          <WeaponIcon weapon={player.inspection.weapon} className="h-(--line-s) max-w-20" />
        )}
        <OwnedWeapons player={player} className="h-(--line-xs) max-w-10 opacity-60" />
      </div>
      <div className={`flex items-stretch ${t ? 'flex-row-reverse' : ''}`}>
        <span className="flex items-center gap-(--space-xxs) bg-(--neutral-1) px-(--space-s) data type-s weight-medium">
          {player.alive ? health(player) : 0}
          <Armour player={player} className="size-(--space-m) opacity-70" />
        </span>
        <span className={`relative h-(--line-m) flex-1 bg-(--neutral-3)`}>
          <span
            className={`absolute inset-y-0 ${t ? 'right-0' : 'left-0'} ${sideFill(player)}`}
            style={{ width: `${health(player)}%` }}
          />
        </span>
      </div>
    </li>
  )
}

/** StarLadder / CCT: tall card, health and utility across the top, weapon centred, stats below. */
function StarLadderCard({ player }: { player: PlayerCardData }) {
  return (
    <li
      aria-label={label(player)}
      className={`@container flex flex-col overflow-hidden rounded-(--radius-s) bg-(--neutral-2) ${player.alive ? '' : 'opacity-50'}`}
    >
      <div
        className={`flex flex-col gap-(--space-xs) p-(--space-s) ${player.alive ? `${sideFill(player)} text-(--neutral-1)` : 'bg-(--neutral-3)'}`}
      >
        <div className="flex items-start justify-between gap-(--space-xs)">
          <span className="data type-m weight-medium">{player.alive ? health(player) : 0}</span>
          <span className="flex flex-wrap justify-end gap-(--space-xxs)">
            {player.alive && <Grenades player={player} className="h-(--line-xs) w-auto invert" />}
            <Bomb player={player} className="h-(--line-xs) w-auto invert" />
            <Flashed player={player} className="h-(--line-xs) invert" />
          </span>
        </div>
        <div className="flex min-h-(--line-l) items-center justify-center">
          {player.alive && (
            <WeaponIcon
              weapon={player.inspection.weapon}
              className="h-(--line-m) max-w-24 invert"
            />
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-(--space-xs) px-(--space-s) pt-(--space-xs) data type-xs">
        <span className="text-(--money)">${player.inspection.money}</span>
        <KillsDeaths player={player} />
      </div>
      <div className="flex min-h-(--line-xs) items-center justify-between gap-(--space-xs) px-(--space-s) pt-(--space-xxs)">
        <span className="flex items-center gap-(--space-xs)">
          <OwnedWeapons player={player} className="h-(--line-xxs) max-w-10 opacity-60" />
        </span>
        <Armour player={player} className="size-(--space-m) opacity-70" />
      </div>
      <span
        className={`truncate px-(--space-s) pb-(--space-xs) text-center type-s weight-medium ${sideText(player)}`}
      >
        {player.name}
      </span>
    </li>
  )
}
