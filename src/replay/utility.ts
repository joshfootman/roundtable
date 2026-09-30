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
