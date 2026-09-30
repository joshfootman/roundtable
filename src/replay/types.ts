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
  money: number
  armour: number
  helmet: boolean
  grenades: { definition: number; count: number }[]
  weapon: ReplayWeapon
}

export interface ReplayDeath {
  tick: number
  victim: string
  killer: { type: 'player'; steamId: string } | { type: 'world' }
  headshot: boolean
}

export interface ReplayRound {
  number: number
  overtime: number
  startTick: number
  liveStartTick: number
  resultTick: number
  endTick: number
  tickInterval: number
  projectiles: ReplayProjectile[]
  detonations: GrenadeDetonation[]
  bombEvents: BombEvent[]
  bomb: { tick: number; state: BombState }[]
  inspection: PlayerInspection[][]
  deaths: ReplayDeath[]
  players: { steamId: string; name: string }[]
  ticks: Uint32Array<ArrayBuffer>
  positions: Float32Array<ArrayBuffer>
  alive: Uint8Array<ArrayBuffer>
  health: Int32Array<ArrayBuffer>
  yaw: Float32Array<ArrayBuffer>
  teams: Uint8Array<ArrayBuffer>
}
