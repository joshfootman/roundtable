import { fromBinary } from '@bufbuild/protobuf'
import { Chunk, Effect, Option, Stream } from 'effect'
import { DemoParseError, type DemoReadError } from './errors.ts'
import {
  bufferedSource,
  readRecordFraming,
  readRecordPayload,
  parse,
  type DemoSource,
} from './source.ts'
import {
  CDemoClassInfoSchema,
  CDemoSendTablesSchema,
  CDemoStringTablesSchema,
  CDemoPacketSchema,
  CDemoFullPacketSchema,
  EDemoCommands,
} from './generated/demo_pb.ts'
import {
  SVC_Messages,
  CSVCMsg_ServerInfoSchema,
  CSVCMsg_PacketEntitiesSchema,
  CSVCMsg_CreateStringTableSchema,
  CSVCMsg_UpdateStringTableSchema,
} from './generated/replay_pb.ts'
import {
  ERosterNetworkMessages,
  CMsgSource1LegacyGameEventListSchema,
  CMsgSource1LegacyGameEventSchema,
  type CMsgSource1LegacyGameEventList_descriptor_t,
} from './generated/roster_pb.ts'
import { BitReader } from './entities/bit-reader.ts'
import { createEntityDecoder } from './entities/index.ts'
import { createRoundTracker, type ReplayEvent } from './round-lifecycle.ts'
export type { ReplayEvent } from './round-lifecycle.ts'

const LIMIT = 32 * 1024 * 1024
export function readReplay(
  input: DemoSource,
): Stream.Stream<ReplayEvent, DemoReadError | DemoParseError> {
  return Stream.suspend(() => {
    const source = bufferedSource(input)
    const entities = createEntityDecoder()
    const descriptors = new Map<number, CMsgSource1LegacyGameEventList_descriptor_t>()
    let tickInterval = 0
    const tracker = createRoundTracker()
    function packet(bytes: Uint8Array, tick: number): ReplayEvent[] {
      lastTick = tick
      const reader = new BitReader(bytes)
      const messages: { id: number; bytes: Uint8Array }[] = []
      while (reader.remaining >= 8) {
        const id = reader.uBitVar()
        const length = reader.varUint()
        if (
          [
            SVC_Messages.svc_ServerInfo,
            SVC_Messages.svc_CreateStringTable,
            SVC_Messages.svc_UpdateStringTable,
            SVC_Messages.svc_ClearAllStringTables,
            SVC_Messages.svc_PacketEntities,
            ERosterNetworkMessages.GE_Source1LegacyGameEventList,
            ERosterNetworkMessages.GE_Source1LegacyGameEvent,
          ].includes(id)
        )
          messages.push({ id, bytes: reader.bytes(length) })
        else reader.skipBytes(length)
      }
      const entityMessages = messages.filter(
        (message) => message.id === SVC_Messages.svc_PacketEntities,
      )
      const names: string[] = []
      for (const message of messages) {
        if (message.id === SVC_Messages.svc_ServerInfo) {
          const info = fromBinary(CSVCMsg_ServerInfoSchema, message.bytes)
          entities.serverInfo(info)
          if (!Number.isFinite(info.tickInterval) || info.tickInterval <= 0)
            throw new Error('The demo has an invalid recorded tick interval.')
          tickInterval = info.tickInterval
        } else if (message.id === SVC_Messages.svc_CreateStringTable)
          entities.createTable(fromBinary(CSVCMsg_CreateStringTableSchema, message.bytes))
        else if (message.id === SVC_Messages.svc_ClearAllStringTables) entities.clearTables()
        else if (message.id === SVC_Messages.svc_UpdateStringTable)
          entities.updateTable(fromBinary(CSVCMsg_UpdateStringTableSchema, message.bytes))
        else if (message.id === ERosterNetworkMessages.GE_Source1LegacyGameEventList)
          for (const descriptor of fromBinary(CMsgSource1LegacyGameEventListSchema, message.bytes)
            .descriptors)
            descriptors.set(descriptor.eventid, descriptor)
      }
      for (const message of entityMessages)
        entities.packet(fromBinary(CSVCMsg_PacketEntitiesSchema, message.bytes))
      for (const message of messages)
        if (message.id === ERosterNetworkMessages.GE_Source1LegacyGameEvent) {
          const event = fromBinary(CMsgSource1LegacyGameEventSchema, message.bytes)
          const descriptor = descriptors.get(event.eventid)
          if (!descriptor) throw new Error('Missing replay event descriptors.')
          names.push(descriptor.name)
        }
      const events = tracker.update(tick, entities.gameRules(), names, tickInterval)
      if (tracker.recording) tracker.sample(tick, entities.snapshots())
      return events
    }
    let lastTick = 0
    let ended = false
    return Stream.unfoldChunkEffect(16, (initialOffset) =>
      Effect.gen(function* () {
        if (ended) return Option.none()
        let offset = initialOffset
        let terminalRecord = false
        while (offset < source.size) {
          const framing = yield* readRecordFraming(source, offset)
          const command = framing.command
          if (command === EDemoCommands.DEM_Stop || command === EDemoCommands.DEM_FileInfo) {
            terminalRecord = true
            break
          }
          if (
            [
              EDemoCommands.DEM_SendTables,
              EDemoCommands.DEM_ClassInfo,
              EDemoCommands.DEM_StringTables,
              EDemoCommands.DEM_Packet,
              EDemoCommands.DEM_SignonPacket,
              EDemoCommands.DEM_FullPacket,
            ].includes(command)
          ) {
            const bytes = yield* readRecordPayload(source, framing, LIMIT)
            const events = yield* parse(() => {
              if (command === EDemoCommands.DEM_SendTables) {
                entities.sendTables(fromBinary(CDemoSendTablesSchema, bytes).data)
                return []
              }
              if (command === EDemoCommands.DEM_ClassInfo) {
                entities.classes(fromBinary(CDemoClassInfoSchema, bytes))
                return []
              }
              if (command === EDemoCommands.DEM_StringTables) {
                entities.tables(fromBinary(CDemoStringTablesSchema, bytes))
                return []
              }
              if (command === EDemoCommands.DEM_FullPacket) {
                const full = fromBinary(CDemoFullPacketSchema, bytes)
                if (full.stringTable) entities.tables(full.stringTable)
                if (!full.packet) throw new Error('Missing full replay packet.')
                return packet(full.packet.data, framing.tick)
              }
              return packet(fromBinary(CDemoPacketSchema, bytes).data, framing.tick)
            })
            if (events.length)
              return Option.some([Chunk.fromIterable(events), framing.end] as const)
          }
          offset = framing.end
        }
        ended = true
        if (!terminalRecord)
          return yield* Effect.fail(
            new DemoParseError({
              message: 'The demo ends before its terminal record is recorded.',
            }),
          )
        const finalEvents = yield* parse(() => tracker.end(lastTick))
        return finalEvents.length
          ? Option.some([Chunk.fromIterable(finalEvents), offset] as const)
          : Option.none()
      }),
    )
  })
}

export function readRounds(input: DemoSource) {
  return readReplay(input).pipe(
    Stream.filterMap((event) =>
      event.type === 'round' ? Option.some(event.round) : Option.none(),
    ),
  )
}

export function readFirstRound(input: DemoSource) {
  return Stream.runHead(readRounds(input)).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () =>
          Effect.fail(
            new DemoParseError({
              message: 'The demo ends before a complete competitive round is recorded.',
            }),
          ),
        onSome: Effect.succeed,
      }),
    ),
  )
}
