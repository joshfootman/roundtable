import type { GrenadeKind, GrenadeDetonation } from './types.ts'

export const utilityAppearance: Record<
  GrenadeKind | GrenadeDetonation['kind'],
  { name: string; color: number }
> = {
  flash: { name: 'Flashbang', color: 0xffe9a1 },
  he: { name: 'HE grenade', color: 0xef8d7c },
  smoke: { name: 'Smoke grenade', color: 0x9cd3ae },
  molotov: { name: 'Molotov', color: 0xffb778 },
  incendiary: { name: 'Incendiary grenade', color: 0xffb778 },
  fire: { name: 'Fire grenade', color: 0xffb778 },
  decoy: { name: 'Decoy', color: 0xaaa9dd },
}
export const DETONATION_DISPLAY_SECONDS = 1

export const APPROXIMATE_SMOKE_RADIUS = 144

export const APPROXIMATE_FIRE_CELL_RADIUS = 60

export const SHOT_DISPLAY_SECONDS = 0.15
export const SHOT_TRACE_LENGTH = 48

export const utilityOverlays = [
  { key: 'trajectories', label: 'Grenade trajectories' },
  { key: 'detonations', label: 'Grenade detonations' },
  { key: 'smokes', label: 'Smoke areas' },
  { key: 'fires', label: 'Fire areas' },
  { key: 'shots', label: 'Bullet traces' },
  { key: 'flashes', label: 'Flashed players' },
] as const
export type UtilityVisibility = Record<(typeof utilityOverlays)[number]['key'], boolean>
export function initialUtilityVisibility(): UtilityVisibility {
  return {
    trajectories: true,
    detonations: true,
    smokes: true,
    fires: true,
    shots: true,
    flashes: true,
  }
}
