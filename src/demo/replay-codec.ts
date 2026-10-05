import { Schema } from 'effect'
import type { ReplayRound } from '../replay/types'

const number = Schema.Finite
const integer = Schema.Int.pipe(Schema.nonNegative())
const text = Schema.NonEmptyString
const point = { x: number, y: number, z: number }
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
    score: Schema.optional(Schema.Struct({ ct: integer, t: integer })),
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
          killer: Schema.Union(
            Schema.Struct({ type: Schema.Literal('player'), steamId: text }),
            Schema.Struct({ type: Schema.Literal('world') }),
          ),
          weapon: text,
          headshot: Schema.Boolean,
        }),
      ),
    ),
    frames: integer,
  }),
)

const align = (offset: number) => Math.ceil(offset / 4) * 4
const magic = 0x314c5052

export function encodeRound(round: ReplayRound): ArrayBuffer {
  const { ticks, positions, alive, health, yaw, teams, projectiles, ...metadata } = round
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
  const tracks = [
    ticks,
    positions,
    alive,
    health,
    yaw,
    teams,
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
  const { frames, projectiles, ...metadata } = header
  const states = frames * header.players.length
  const ticks = track(Uint32Array, frames)
  const positions = track(Float32Array, states * 3)
  const alive = track(Uint8Array, states)
  const health = track(Int32Array, states)
  const yaw = track(Float32Array, states)
  const teams = track(Uint8Array, states)
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
    header.bomb.length === 0 ||
    header.inspection.some((records) => records.length === 0) ||
    header.fires.some((record) => record.fires.some((fire) => fire.positions.length % 3 !== 0))
  )
    throw new Error('Invalid replay asset inspection or utility data.')
  if (
    [positions, yaw, ...decodedProjectiles.map((p) => p.positions)].some((values) =>
      values.some((value) => !Number.isFinite(value)),
    )
  )
    throw new Error('Invalid replay asset coordinates.')
  return {
    ...metadata,
    ticks,
    positions,
    alive,
    health,
    yaw,
    teams,
    projectiles: decodedProjectiles,
  }
}
