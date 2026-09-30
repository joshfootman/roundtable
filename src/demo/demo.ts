import { fromBinary, isFieldSet } from '@bufbuild/protobuf'
import { Effect } from 'effect'
import { readDemoMetadata, type DemoMetadata } from './metadata.ts'
import { DemoParseError } from './errors.ts'
import {
  parse,
  readRecordFraming,
  readRecordPayload,
  readVarUint32,
  type DemoSource,
} from './source.ts'
import {
  CDemoFullPacketSchema,
  CDemoPacketSchema,
  CDemoStringTablesSchema,
  EDemoCommands,
  type CDemoStringTables,
} from './generated/demo_pb.ts'
import {
  CMsgPlayerInfoSchema,
  CMsgSource1LegacyGameEventListSchema,
  CMsgSource1LegacyGameEventList_descriptor_tSchema,
  CMsgSource1LegacyGameEventSchema,
  CMsgSource1LegacyGameEvent_key_tSchema,
  ERosterNetworkMessages,
  type CMsgSource1LegacyGameEventList_descriptor_t,
  type CMsgSource1LegacyGameEvent,
} from './generated/roster_pb.ts'

export interface DemoPlayer {
  steamId: string
  name: string
}
export interface ImportedDemo {
  metadata: DemoMetadata
  players: DemoPlayer[]
}
const MAX_RECORD_BYTES = 32 * 1024 * 1024

class PacketReader {
  private offset = 0
  constructor(private bytes: Uint8Array) {}
  get remaining() {
    return this.bytes.length * 8 - this.offset
  }
  bits(count: number) {
    if (count > this.remaining)
      throw new Error('The demo contains a truncated network packet. Download it again.')
    let value = 0
    for (let i = 0; i < count; i++, this.offset++)
      value += ((this.bytes[this.offset >> 3]! >> (this.offset & 7)) & 1) * 2 ** i
    return value
  }
  messageId() {
    const value = this.bits(6)
    const extra = [0, 4, 8, 28][value >> 4]!
    return extra ? (value & 15) + this.bits(extra) * 16 : value
  }
  skipPayload(length: number) {
    if (length * 8 > this.remaining)
      throw new Error('The demo contains a truncated network message. Download it again.')
    this.offset += length * 8
  }
  payload(length: number) {
    if (length * 8 > this.remaining)
      throw new Error('The demo contains a truncated network message. Download it again.')
    const bytes = new Uint8Array(length)
    for (let i = 0; i < length; i++) bytes[i] = this.bits(8)
    return bytes
  }
}

function readSpawnUserId(
  event: CMsgSource1LegacyGameEvent,
  descriptor: CMsgSource1LegacyGameEventList_descriptor_t,
): number {
  const key = event.keys[descriptor.keys.findIndex((key) => key.name === 'userid')]
  if (!key) throw new Error('The demo player-spawn event is missing its user ID.')
  const fields = CMsgSource1LegacyGameEvent_key_tSchema.field
  const encodings = ['valShort', 'valLong', 'valByte'] as const
  const values = encodings
    .filter((encoding) => isFieldSet(key, fields[encoding]))
    .map((encoding) => key[encoding])
  if (values.length !== 1)
    throw new Error('The demo player-spawn user ID has an unsupported encoding.')
  return values[0]!
}

function rosterState() {
  const identities = new Map<number, DemoPlayer | null>()
  const participants = new Map<string, DemoPlayer>()
  const descriptors = new Map<number, CMsgSource1LegacyGameEventList_descriptor_t>()
  function tables(tables: CDemoStringTables) {
    for (const table of tables.tables) {
      if (table.tableName !== 'userinfo') continue
      identities.clear()
      for (const item of table.items) {
        if (item.data.length === 0) continue
        const player = fromBinary(CMsgPlayerInfoSchema, item.data)
        const fields = CMsgPlayerInfoSchema.field
        if (!isFieldSet(player, fields.userid))
          throw new Error(
            'The demo player information is missing a user ID. Choose a complete demo.',
          )
        if (player.ishltv || player.fakeplayer) {
          identities.set(player.userid, null)
          continue
        }
        if (
          !isFieldSet(player, fields.name) ||
          !player.name.trim() ||
          !isFieldSet(player, fields.steamid) ||
          player.steamid <= 0n
        )
          throw new Error(
            'The demo player information is missing a name or Steam ID. Choose a complete demo.',
          )
        identities.set(player.userid, { name: player.name, steamId: player.steamid.toString() })
      }
    }
  }
  function consumeEvent(event: CMsgSource1LegacyGameEvent): boolean {
    if (!isFieldSet(event, CMsgSource1LegacyGameEventSchema.field.eventid))
      throw new Error('The demo game event is missing its ID.')
    const descriptor = descriptors.get(event.eventid)
    if (!descriptor)
      throw new Error('The demo is missing game-event descriptors. Choose a complete demo.')
    if (descriptor.name === 'round_freeze_end') return true
    if (descriptor.name !== 'player_spawn') return false
    const userId = readSpawnUserId(event, descriptor)
    if (!identities.has(userId))
      throw new Error(
        'The demo is missing identity information for a spawned player. Choose a complete demo.',
      )
    const player = identities.get(userId)
    if (player) participants.set(player.steamId, { ...player })
    return false
  }
  function consumePacket(bytes: Uint8Array): boolean {
    const reader = new PacketReader(bytes)
    while (reader.remaining >= 8) {
      const id = reader.messageId()
      const length = readVarUint32(() => reader.bits(8))
      if (
        id !== ERosterNetworkMessages.GE_Source1LegacyGameEventList &&
        id !== ERosterNetworkMessages.GE_Source1LegacyGameEvent
      ) {
        reader.skipPayload(length)
        continue
      }
      const payload = reader.payload(length)
      if (id === ERosterNetworkMessages.GE_Source1LegacyGameEventList) {
        for (const descriptor of fromBinary(CMsgSource1LegacyGameEventListSchema, payload)
          .descriptors) {
          if (
            !isFieldSet(
              descriptor,
              CMsgSource1LegacyGameEventList_descriptor_tSchema.field.eventid,
            ) ||
            !descriptor.name
          )
            throw new Error('The demo game-event descriptors are damaged. Choose another demo.')
          descriptors.set(descriptor.eventid, descriptor)
        }
      } else {
        if (consumeEvent(fromBinary(CMsgSource1LegacyGameEventSchema, payload))) return true
      }
    }
    // Packets end at the last complete message; sub-byte padding is unspecified.
    return false
  }
  return { tables, consumePacket, participants }
}

export function readDemo(source: DemoSource) {
  return Effect.gen(function* () {
    const metadata = yield* readDemoMetadata(source)
    const state = rosterState()
    let offset = 16
    while (offset < source.size) {
      const framing = yield* readRecordFraming(source, offset)
      const command = framing.command
      if (command === EDemoCommands.DEM_Stop || command === EDemoCommands.DEM_FileInfo) break
      const relevant =
        command === EDemoCommands.DEM_StringTables ||
        command === EDemoCommands.DEM_Packet ||
        command === EDemoCommands.DEM_SignonPacket ||
        command === EDemoCommands.DEM_FullPacket
      if (relevant) {
        const bytes = yield* readRecordPayload(source, framing, MAX_RECORD_BYTES)
        const initialRosterComplete = yield* parse(() => {
          if (command === EDemoCommands.DEM_StringTables) {
            state.tables(fromBinary(CDemoStringTablesSchema, bytes))
            return false
          }
          if (command === EDemoCommands.DEM_FullPacket) {
            const full = fromBinary(CDemoFullPacketSchema, bytes)
            if (full.stringTable) state.tables(full.stringTable)
            if (!full.packet || !isFieldSet(full.packet, CDemoPacketSchema.field.data))
              throw new Error('The demo full packet is missing network data.')
            return state.consumePacket(full.packet.data)
          }
          const packet = fromBinary(CDemoPacketSchema, bytes)
          if (!isFieldSet(packet, CDemoPacketSchema.field.data))
            throw new Error('The demo packet is missing network data.')
          return state.consumePacket(packet.data)
        })
        if (initialRosterComplete) {
          if (!state.participants.size)
            return yield* Effect.fail(
              new DemoParseError({
                message:
                  'No recorded human players spawned before the first freeze-time end. Choose a demo with player information.',
              }),
            )
          return { metadata, players: [...state.participants.values()] } satisfies ImportedDemo
        }
      }
      offset = framing.end
    }
    return yield* Effect.fail(
      new DemoParseError({
        message:
          'The demo ends before the initial player roster is complete (first freeze-time end). Choose a complete demo.',
      }),
    )
  })
}
