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
