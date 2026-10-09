/** Dense per-sample, per-player tracks, indexed `(sample * players.length + player) * width`. */
export interface PlayerTracks {
  positions: Float32Array<ArrayBuffer>
  alive: Uint8Array<ArrayBuffer>
  health: Int32Array<ArrayBuffer>
  yaw: Float32Array<ArrayBuffer>
  pitch: Float32Array<ArrayBuffer>
  teams: Uint8Array<ArrayBuffer>
  /** 0 while the player has no recorded pawn: before joining or after disconnecting. */
  present: Uint8Array<ArrayBuffer>
}

interface TrackType<T> {
  new (buffer: ArrayBuffer, offset: number, length: number): T
  from(values: ArrayLike<number>): T
  BYTES_PER_ELEMENT: number
}

function layout<T>(type: TrackType<T>, width: number) {
  return { type, width }
}

/** Encoding, transfer and capture follow this order; changing it changes the asset format. */
export const playerTrackLayout: {
  [K in keyof PlayerTracks]: { type: TrackType<PlayerTracks[K]>; width: number }
} = {
  positions: layout(Float32Array, 3),
  alive: layout(Uint8Array, 1),
  health: layout(Int32Array, 1),
  yaw: layout(Float32Array, 1),
  pitch: layout(Float32Array, 1),
  teams: layout(Uint8Array, 1),
  present: layout(Uint8Array, 1),
}

export const playerTrackNames = Object.keys(playerTrackLayout) as (keyof PlayerTracks)[]

export function mapPlayerTracks<T>(create: <K extends keyof PlayerTracks>(name: K) => T): {
  [K in keyof PlayerTracks]: T
} {
  return Object.fromEntries(playerTrackNames.map((name) => [name, create(name)])) as {
    [K in keyof PlayerTracks]: T
  }
}
