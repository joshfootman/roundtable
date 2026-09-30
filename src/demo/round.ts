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
type RoundCapture = {
  startTick: number
  number: number
  players: ReplayRound['players']
  ticks: number[]
  positions: number[]
  alive: number[]
  lastPositions: Map<string, PlayerSnapshot>
} & ({ phase: 'freeze' } | { phase: 'live' | 'postround'; liveStartTick: number })

const LIMIT = 32 * 1024 * 1024
export function readFirstRound(input: DemoSource) {
  return Effect.gen(function* () {
    const source = bufferedSource(input)
    const entities = createEntityDecoder()
    const descriptors = new Map<number, CMsgSource1LegacyGameEventList_descriptor_t>()
    let tickInterval = 0
    let capture: RoundCapture | undefined
    let previousRules: ReturnType<typeof entities.gameRules>
    function start(tick: number, rules: ReturnType<typeof entities.gameRules>): boolean {
      if (capture?.phase === 'postround') return true
      if (!rules || rules.warmup) return false
      capture = {
        phase: 'freeze',
        startTick: tick,
        number: rules.totalRoundsPlayed + 1,
        players: [],
        ticks: [],
        positions: [],
        alive: [],
        lastPositions: new Map(),
      }
      return false
    }
    function sample(round: RoundCapture, tick: number) {
      const { ticks, positions, alive, lastPositions } = round
      if (ticks.length && tick < ticks[ticks.length - 1]!)
        throw new Error('The demo contains out-of-order replay ticks.')
      const snapshots = entities.snapshots()
      if (!round.players.length) {
        if (!snapshots.length)
          throw new Error('The competitive round has no recorded player positions.')
        round.players = snapshots.map(({ steamId, name, team }) => ({ steamId, name, team }))
      }
      const { players } = round
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
        const startsRound =
          rules.reason === 0 &&
          ((rules.started === true && previousRules.started !== true) || previousRules.reason !== 0)
        if (startsRound && !rules.warmup) completed = start(tick, rules)
        if (capture?.phase === 'live' && rules.reason !== 0) capture.phase = 'postround'
      }
      previousRules = rules
      for (const message of messages)
        if (message.id === ERosterNetworkMessages.GE_Source1LegacyGameEvent) {
          const event = fromBinary(CMsgSource1LegacyGameEventSchema, message.bytes)
          const descriptor = descriptors.get(event.eventid)
          if (!descriptor) throw new Error('Missing replay event descriptors.')
          if (descriptor.name === 'round_start') completed = start(tick, rules)
          else if (descriptor.name === 'round_freeze_end' && capture?.phase === 'freeze') {
            capture = { ...capture, phase: 'live', liveStartTick: tick }
          } else if (descriptor.name === 'round_end' && capture?.phase === 'live')
            capture.phase = 'postround'
          else if (descriptor.name === 'round_officially_ended' && capture?.phase === 'postround')
            completed = true
        }
      if (capture && !completed) sample(capture, tick)
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
          if (!capture || capture.phase !== 'postround' || !capture.ticks.length || !tickInterval)
            return yield* Effect.fail(
              new DemoParseError({
                message:
                  'The competitive round is missing its recorded tick interval, freeze end or positions.',
              }),
            )
          return {
            number: capture.number,
            startTick: capture.startTick,
            liveStartTick: capture.liveStartTick,
            endTick: framing.tick,
            tickInterval,
            players: capture.players,
            ticks: Uint32Array.from(capture.ticks),
            positions: Float32Array.from(capture.positions),
            alive: Uint8Array.from(capture.alive),
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
