export interface ReplayRound {
  number: number
  startTick: number
  liveStartTick: number
  endTick: number
  tickInterval: number
  players: { steamId: string; name: string; team: 2 | 3 }[]
  ticks: Uint32Array<ArrayBuffer>
  positions: Float32Array<ArrayBuffer>
  alive: Uint8Array<ArrayBuffer>
}
