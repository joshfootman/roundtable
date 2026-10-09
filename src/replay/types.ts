import type { PlayerTracks } from './tracks.ts'

export type FlashState =
  | { type: 'none' }
  | { type: 'flashed'; startTick: number; durationSeconds: number }

export interface ReplayShot {
  tick: number
  player: string
  weapon: number
  x: number
  y: number
  z: number
  pitch: number
  yaw: number
}

export interface DroppedItem {
  entity: number
  serial: number
  definition: number
  x: number
  y: number
  z: number
}

export interface FireArea {
  entity: number
  serial: number
  positions: number[]
}

export interface ReplaySmoke {
  entity: number
  startTick: number
  endTick: number
  x: number
  y: number
  z: number
}

export type GrenadeKind = 'flash' | 'he' | 'smoke' | 'molotov' | 'incendiary' | 'decoy'
export interface ReplayProjectile {
  entity: number
  serial: number
  kind: GrenadeKind
  thrower: string
  startTick: number
  endTick: number
  ticks: Uint32Array<ArrayBuffer>
  positions: Float32Array<ArrayBuffer>
}
export interface GrenadeDetonation {
  tick: number
  kind: 'flash' | 'he' | 'smoke' | 'fire' | 'decoy'
  entity: number
  x: number
  y: number
  z: number
}

export type BombEvent =
  | {
      tick: number
      type: 'plant-start' | 'plant-abort' | 'planted' | 'defuse-start' | 'defuse-abort' | 'defused'
      player: string
    }
  | { tick: number; type: 'exploded' }

export type BombState =
  | { type: 'inactive' }
  | { type: 'carried'; carrier: string; planting: boolean }
  | { type: 'dropped'; x: number; y: number; z: number }
  | {
      type: 'planted'
      x: number
      y: number
      z: number
      defuser: { type: 'none' } | { type: 'player'; steamId: string }
    }

export type ReplayWeapon =
  | { type: 'none' }
  | { type: 'item'; definition: number }
  | { type: 'gun'; definition: number; magazine: number; reserve: number }

export interface PlayerInspection {
  tick: number
  onLadder?: boolean
  money: number
  armour: number
  flash: FlashState
  helmet: boolean
  grenades: { definition: number; count: number }[]
  weapon: ReplayWeapon
  weapons: ReplayWeapon[]
}

export interface ReplayDeath {
  tick: number
  victim: string
  killer: { type: 'player'; steamId: string } | { type: 'world' }
  weapon: string
  headshot: boolean
}

export interface ReplayRound extends PlayerTracks {
  number: number
  teamNames?: { ct?: string; t?: string }
  score?: { ct: number; t: number }
  outcome?: { winner: 'ct' | 't'; reason: number; teamName?: string; mvp?: { name: string } }
  overtime: number
  startTick: number
  liveStartTick: number
  resultTick: number
  endTick: number
  tickInterval: number
  droppedItems: { tick: number; items: DroppedItem[] }[]
  shots: ReplayShot[]
  fires: { tick: number; fires: FireArea[] }[]
  smokes: ReplaySmoke[]
  projectiles: ReplayProjectile[]
  detonations: GrenadeDetonation[]
  bombEvents: BombEvent[]
  bomb: { tick: number; state: BombState }[]
  inspection: PlayerInspection[][]
  deaths: ReplayDeath[]
  players: { steamId: string; name: string }[]
  ticks: Uint32Array<ArrayBuffer>
}
