import { fromBinary } from '@bufbuild/protobuf'
import { Effect } from 'effect'
import { DemoParseError } from './errors.ts'
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
import { createEntityDecoder, type PlayerSnapshot } from './entities/index.ts'
import { type ReplayRound } from '../replay/types.ts'
const LIMIT = 32 * 1024 * 1024
export function readFirstRound(input: DemoSource) {
  return Effect.gen(function* () {
    const source = bufferedSource(input)
    const entities = createEntityDecoder()
    const descriptors = new Map<number, CMsgSource1LegacyGameEventList_descriptor_t>()
    let tickInterval = 0
    let startTick = -1
    let liveStartTick = -1
    let roundNumber = 0
    let phase: 'searching' | 'freeze' | 'live' | 'postround' = 'searching'
    let previousRules: ReturnType<typeof entities.gameRules>
    let players: ReplayRound['players'] = []
    const ticks: number[] = []
    const positions: number[] = []
    const alive: number[] = []
    const lastPositions = new Map<string, PlayerSnapshot>()
    function reset(tick: number, totalRoundsPlayed: number) {
      startTick = tick
      liveStartTick = -1
      roundNumber = totalRoundsPlayed + 1
      phase = 'freeze'
      players = []
      ticks.length = 0
      positions.length = 0
      alive.length = 0
      lastPositions.clear()
    }
    function sample(tick: number) {
      if (ticks.length && tick < ticks[ticks.length - 1]!)
        throw new Error('The demo contains out-of-order replay ticks.')
      const snapshots = entities.snapshots()
      if (!players.length) {
        if (!snapshots.length)
          throw new Error('The competitive round has no recorded player positions.')
        players = snapshots.map(({ steamId, name, team }) => ({ steamId, name, team }))
      }
      const byId = new Map(snapshots.map((player) => [player.steamId, player]))
      const replacement = ticks.at(-1) === tick
      if (replacement) {
        positions.length -= players.length * 3
        alive.length -= players.length
      } else ticks.push(tick)
      for (const player of players) {
        const current = byId.get(player.steamId)
        if (current) lastPositions.set(player.steamId, current)
        const recorded = current ?? lastPositions.get(player.steamId)
        if (!recorded) throw new Error('A competitive player has no recorded position.')
        positions.push(recorded.x, recorded.y, recorded.z)
        alive.push(Number(recorded.alive))
      }
    }
    function packet(bytes: Uint8Array, tick: number): boolean {
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
      let completed = false
      for (const message of messages) {
        if (message.id === SVC_Messages.svc_ServerInfo) {
          const info = fromBinary(CSVCMsg_ServerInfoSchema, message.bytes)
          entities.serverInfo(info)
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
      const rules = entities.gameRules()
      if (rules && previousRules) {
        const start =
          rules.reason === 0 &&
          ((rules.started === true && previousRules.started !== true) || previousRules.reason !== 0)
        if (start && !rules.warmup) {
          if (startTick >= 0 && phase === 'postround') completed = true
          else reset(tick, rules.totalRoundsPlayed)
        }
        if (startTick >= 0 && phase === 'live' && rules.reason !== 0) phase = 'postround'
      }
      previousRules = rules
      for (const message of messages)
        if (message.id === ERosterNetworkMessages.GE_Source1LegacyGameEvent) {
          const event = fromBinary(CMsgSource1LegacyGameEventSchema, message.bytes)
          const descriptor = descriptors.get(event.eventid)
          if (!descriptor) throw new Error('Missing replay event descriptors.')
          if (descriptor.name === 'round_start') {
            if (startTick >= 0 && phase === 'postround') completed = true
            else if (rules && !rules.warmup) reset(tick, rules.totalRoundsPlayed)
          } else if (
            descriptor.name === 'round_freeze_end' &&
            startTick >= 0 &&
            phase === 'freeze'
          ) {
            liveStartTick = tick
            phase = 'live'
          } else if (descriptor.name === 'round_end' && startTick >= 0 && phase === 'live')
            phase = 'postround'
          else if (descriptor.name === 'round_officially_ended' && phase === 'postround')
            completed = true
        }
      if (startTick >= 0 && !completed) sample(tick)
      return completed
    }
    let offset = 16
    while (offset < source.size) {
      const framing = yield* readRecordFraming(source, offset)
      const command = framing.command
      if (command === EDemoCommands.DEM_Stop || command === EDemoCommands.DEM_FileInfo) break
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
        const complete = yield* parse(() => {
          if (command === EDemoCommands.DEM_SendTables) {
            entities.sendTables(fromBinary(CDemoSendTablesSchema, bytes).data)
            return false
          }
          if (command === EDemoCommands.DEM_ClassInfo) {
            entities.classes(fromBinary(CDemoClassInfoSchema, bytes))
            return false
          }
          if (command === EDemoCommands.DEM_StringTables) {
            entities.tables(fromBinary(CDemoStringTablesSchema, bytes))
            return false
          }
          if (command === EDemoCommands.DEM_FullPacket) {
            const full = fromBinary(CDemoFullPacketSchema, bytes)
            if (full.stringTable) entities.tables(full.stringTable)
            if (!full.packet) throw new Error('Missing full replay packet.')
            return packet(full.packet.data, framing.tick)
          }
          return packet(fromBinary(CDemoPacketSchema, bytes).data, framing.tick)
        })
        if (complete) {
          if (!tickInterval || !ticks.length || liveStartTick < startTick)
            return yield* Effect.fail(
              new DemoParseError({
                message:
                  'The competitive round is missing its recorded tick interval, freeze end or positions.',
              }),
            )
          return {
            number: roundNumber,
            startTick,
            liveStartTick,
            endTick: framing.tick,
            tickInterval,
            players,
            ticks: Uint32Array.from(ticks),
            positions: Float32Array.from(positions),
            alive: Uint8Array.from(alive),
          } satisfies ReplayRound
        }
      }
      offset = framing.end
    }
    return yield* Effect.fail(
      new DemoParseError({
        message: 'The demo ends before a complete competitive round is recorded.',
      }),
    )
  })
}
