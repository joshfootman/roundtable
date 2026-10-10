import { Schema } from 'effect'
import { firearms } from '../replay/equipment.ts'
import {
  mapPlayerTracks,
  playerTrackLayout,
  playerTrackNames,
  type PlayerTracks,
} from '../replay/tracks.ts'
import type { ReplayRound } from '../replay/types'
import { packTrack, unpackTrack, type Packing } from './track-packing.ts'

const number = Schema.Finite
const integer = Schema.Int.pipe(Schema.nonNegative())
const text = Schema.NonEmptyString
const point = { x: number, y: number, z: number }
const actor = Schema.Union(
  Schema.Struct({ type: Schema.Literal('player'), steamId: text }),
  Schema.Struct({ type: Schema.Literal('world') }),
)
const player = Schema.Struct({ steamId: text, name: text })
const weapon = Schema.Union(
  Schema.Struct({ type: Schema.Literal('none') }),
  Schema.Struct({ type: Schema.Literal('item'), definition: integer }),
  Schema.Struct({
    type: Schema.Literal('gun'),
    definition: integer,
    magazine: integer,
    reserve: integer,
  }),
)
const flash = Schema.Union(
  Schema.Struct({ type: Schema.Literal('none') }),
  Schema.Struct({ type: Schema.Literal('flashed'), startTick: integer, durationSeconds: number }),
)
const bombState = Schema.Union(
  Schema.Struct({ type: Schema.Literal('inactive') }),
  Schema.Struct({ type: Schema.Literal('carried'), carrier: text, planting: Schema.Boolean }),
  Schema.Struct({ type: Schema.Literal('dropped'), ...point }),
  Schema.Struct({
    type: Schema.Literal('planted'),
    ...point,
    defuser: Schema.Union(
      Schema.Struct({ type: Schema.Literal('none') }),
      Schema.Struct({ type: Schema.Literal('player'), steamId: text }),
    ),
  }),
)
const Header = Schema.mutable(
  Schema.Struct({
    number: integer,
    teamNames: Schema.optional(
      Schema.Struct({ ct: Schema.optional(text), t: Schema.optional(text) }),
    ),
    score: Schema.optional(Schema.Struct({ ct: integer, t: integer })),
    outcome: Schema.optional(
      Schema.Struct({
        winner: Schema.Literal('ct', 't'),
        reason: integer,
        teamName: Schema.optional(text),
        mvp: Schema.optional(Schema.Struct({ name: text })),
      }),
    ),
    overtime: integer,
    startTick: integer,
    liveStartTick: integer,
    resultTick: integer,
    endTick: integer,
    tickInterval: Schema.Positive,
    players: Schema.mutable(Schema.NonEmptyArray(player)),
    shots: Schema.mutable(
      Schema.Array(
        Schema.Struct({
          tick: integer,
          player: text,
          weapon: integer,
          ...point,
          pitch: number,
          yaw: number,
        }),
      ),
    ),
    droppedItems: Schema.mutable(
      Schema.Array(
        Schema.Struct({
          entity: integer,
          serial: integer,
          definition: integer,
          ...point,
          from: integer,
          to: integer,
        }),
      ),
    ),
    fires: Schema.mutable(
      Schema.Array(
        Schema.Struct({
          tick: integer,
          fires: Schema.mutable(
            Schema.Array(
              Schema.Struct({
                entity: integer,
                serial: integer,
                positions: Schema.mutable(Schema.Array(number)),
              }),
            ),
          ),
        }),
      ),
    ),
    smokes: Schema.mutable(
      Schema.Array(
        Schema.Struct({ entity: integer, startTick: integer, endTick: integer, ...point }),
      ),
    ),
    projectiles: Schema.mutable(
      Schema.Array(
        Schema.Struct({
          entity: integer,
          serial: integer,
          kind: Schema.Literal('flash', 'he', 'smoke', 'molotov', 'incendiary', 'decoy'),
          thrower: text,
          startTick: integer,
          endTick: integer,
          frames: integer,
        }),
      ),
    ),
    detonations: Schema.mutable(
      Schema.Array(
        Schema.Struct({
          tick: integer,
          kind: Schema.Literal('flash', 'he', 'smoke', 'fire', 'decoy'),
          entity: integer,
          ...point,
        }),
      ),
    ),
    bombEvents: Schema.mutable(
      Schema.Array(
        Schema.Union(
          Schema.Struct({
            tick: integer,
            type: Schema.Literal(
              'plant-start',
              'plant-abort',
              'planted',
              'defuse-start',
              'defuse-abort',
              'defused',
            ),
            player: text,
          }),
          Schema.Struct({ tick: integer, type: Schema.Literal('exploded') }),
        ),
      ),
    ),
    bomb: Schema.mutable(Schema.Array(Schema.Struct({ tick: integer, state: bombState }))),
    inspection: Schema.mutable(
      Schema.Array(
        Schema.mutable(
          Schema.Array(
            Schema.Struct({
              tick: integer,
              money: integer,
              onLadder: Schema.optional(Schema.Boolean),
              armour: integer,
              flash,
              helmet: Schema.Boolean,
              grenades: Schema.mutable(
                Schema.Array(Schema.Struct({ definition: integer, count: integer })),
              ),
              weapon,
              weapons: Schema.mutable(Schema.Array(weapon)),
            }),
          ),
        ),
      ),
    ),
    deaths: Schema.mutable(
      Schema.Array(
        Schema.Struct({
          tick: integer,
          victim: text,
          killer: actor,
          assister: Schema.optional(text),
          flashAssist: Schema.Boolean,
          weapon: text,
          headshot: Schema.Boolean,
        }),
      ),
    ),
    damage: Schema.mutable(
      Schema.Array(
        Schema.Struct({
          tick: integer,
          victim: text,
          attacker: actor,
          // World damage such as falling records no weapon.
          weapon: Schema.String,
          health: integer,
          armour: integer,
          remaining: integer,
          hitgroup: integer,
        }),
      ),
    ),
    frames: integer,
  }),
)

const align = (offset: number) => Math.ceil(offset / 4) * 4
const magic = 0x344c5052

// Continuous tracks stored as fixed-point time deltas: 1/64 unit and 1/1000 degree.
const packings: Partial<Record<keyof PlayerTracks, Packing>> = {
  positions: { scale: 64 },
  yaw: { scale: 1000, period: 360 },
  pitch: { scale: 1000 },
}
const tickPacking: Packing = { scale: 1 }

export function encodeRound(round: ReplayRound): ArrayBuffer {
  const { ticks, projectiles, ...rest } = round
  const metadata: Partial<ReplayRound> = { ...rest }
  for (const name of playerTrackNames) delete metadata[name]
  const header = new TextEncoder().encode(
    JSON.stringify({
      ...metadata,
      frames: ticks.length,
      projectiles: projectiles.map(({ ticks, positions: _positions, ...projectile }) => ({
        ...projectile,
        frames: ticks.length,
      })),
    }),
  )
  const samples = ticks.length
  const players = round.players.length
  const tracks = [
    packTrack(ticks, { samples, players: 1, width: 1 }, tickPacking),
    ...playerTrackNames.map((name) => {
      const packing = packings[name]
      return packing
        ? packTrack(
            round[name],
            { samples, players, width: playerTrackLayout[name].width },
            packing,
          )
        : round[name]
    }),
    ...projectiles.flatMap(({ ticks, positions }) => [ticks, positions]),
  ]
  const buffer = new ArrayBuffer(
    tracks.reduce((offset, track) => align(offset) + track.byteLength, align(8 + header.length)),
  )
  const view = new DataView(buffer)
  view.setUint32(0, magic, true)
  view.setUint32(4, header.length, true)
  new Uint8Array(buffer, 8, header.length).set(header)
  let offset = align(8 + header.length)
  for (const track of tracks) {
    offset = align(offset)
    new Uint8Array(buffer, offset, track.byteLength).set(
      new Uint8Array(track.buffer, track.byteOffset, track.byteLength),
    )
    offset += track.byteLength
  }
  return buffer
}

export function decodeRound(buffer: ArrayBuffer): ReplayRound {
  if (buffer.byteLength < 8 || new DataView(buffer).getUint32(0, true) !== magic)
    throw new Error('Unsupported replay asset version.')
  const length = new DataView(buffer).getUint32(4, true)
  if (length > buffer.byteLength - 8) throw new Error('Truncated replay asset header.')
  const header = Schema.decodeUnknownSync(Header)(
    JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 8, length))),
  )
  let offset = align(8 + length)
  function track<
    T extends
      | Uint32Array<ArrayBuffer>
      | Float32Array<ArrayBuffer>
      | Int32Array<ArrayBuffer>
      | Uint8Array<ArrayBuffer>,
  >(
    type: {
      new (buffer: ArrayBuffer, offset: number, length: number): T
      BYTES_PER_ELEMENT: number
    },
    count: number,
  ): T {
    offset = align(offset)
    const bytes = count * type.BYTES_PER_ELEMENT
    if (!Number.isSafeInteger(bytes) || bytes > buffer.byteLength - offset)
      throw new Error('Truncated replay asset tracks.')
    const result = new type(buffer, offset, count)
    offset += bytes
    return result
  }
  const { frames, projectiles, droppedItems, ...metadata } = header
  const states = frames * header.players.length
  const players = header.players.length
  const ticks = unpackTrack(
    track(Uint8Array, frames * 4),
    { samples: frames, players: 1, width: 1 },
    tickPacking,
    new Uint32Array(frames),
  )
  const playerTracks = mapPlayerTracks((name) => {
    const { type, width } = playerTrackLayout[name]
    const packing = packings[name]
    if (!packing) return track(type, states * width)
    return unpackTrack(
      track(Uint8Array, states * width * 4),
      { samples: frames, players, width },
      packing,
      new Float32Array(states * width),
    )
  }) as PlayerTracks
  const decodedProjectiles = projectiles.map(({ frames, ...projectile }) => ({
    ...projectile,
    ticks: track(Uint32Array, frames),
    positions: track(Float32Array, frames * 3),
  }))
  if (
    offset !== buffer.byteLength ||
    frames === 0 ||
    header.inspection.length !== header.players.length ||
    !(
      header.startTick <= header.liveStartTick &&
      header.liveStartTick <= header.resultTick &&
      header.resultTick <= header.endTick
    )
  )
    throw new Error('Invalid replay asset dimensions or round boundaries.')
  function ordered(values: Uint32Array, start: number, end: number) {
    for (let i = 0; i < values.length; i++)
      if (values[i]! < start || values[i]! > end || (i > 0 && values[i]! <= values[i - 1]!))
        throw new Error('Invalid replay asset tick order.')
  }
  ordered(ticks, header.startTick, header.endTick)
  for (const projectile of decodedProjectiles)
    ordered(projectile.ticks, projectile.startTick, projectile.endTick)
  for (const records of [
    header.shots,
    header.fires,
    header.detonations,
    header.bombEvents,
    header.bomb,
    header.deaths,
    header.damage,
    ...header.inspection,
  ]) {
    if (
      records.some(
        (record, index) =>
          record.tick < header.startTick ||
          record.tick > header.endTick ||
          (index > 0 && record.tick < records[index - 1]!.tick),
      )
    )
      throw new Error('Invalid replay asset event order.')
  }
  if (
    droppedItems.some(
      (item, index) =>
        item.from < header.startTick ||
        item.to > header.endTick ||
        item.from >= item.to ||
        (index > 0 && item.from < droppedItems[index - 1]!.from) ||
        !(item.definition in firearms || (item.definition >= 43 && item.definition <= 48)),
    )
  )
    throw new Error('Invalid replay asset dropped item data.')
  if (
    header.bomb.length === 0 ||
    header.inspection.some((records) => records.length === 0) ||
    header.fires.some((record) => record.fires.some((fire) => fire.positions.length % 3 !== 0))
  )
    throw new Error('Invalid replay asset inspection or utility data.')
  if (
    [playerTracks.positions, playerTracks.yaw, ...decodedProjectiles.map((p) => p.positions)].some(
      (values) => values.some((value) => !Number.isFinite(value)),
    )
  )
    throw new Error('Invalid replay asset coordinates.')
  return {
    ...metadata,
    droppedItems,
    ticks,
    ...playerTracks,
    projectiles: decodedProjectiles,
  }
}
