import { uncompress } from 'snappyjs'
import { type CDemoClassInfo, type CDemoStringTables } from '../generated/demo_pb.ts'
import {
  type CSVCMsg_ServerInfo,
  type CSVCMsg_PacketEntities,
  type CSVCMsg_CreateStringTable,
  type CSVCMsg_UpdateStringTable,
} from '../generated/replay_pb.ts'
import { BitReader } from './bit-reader.ts'
import { readFieldPaths } from './field-path.ts'
import { readSerializers, resolveField, type Serializer } from './serializers.ts'
import { type EntityValue } from './field-decoder.ts'
interface Entity {
  serial: number
  className: string
  serializer: Serializer
  values: Map<string, EntityValue>
  active: boolean
  polymorphic: Map<string, Serializer>
}
interface StringTable {
  definition: CSVCMsg_CreateStringTable
  entries: Map<number, { key: string; value: Uint8Array }>
}
export interface PlayerSnapshot {
  steamId: string
  name: string
  team: 2 | 3
  x: number
  y: number
  z: number
  alive: boolean
}
const replayFields = new Set([
  'm_steamID',
  'm_hPlayerPawn',
  'm_iszPlayerName',
  'm_iTeamNum',
  'm_iHealth',
  'm_lifeState',
  ...['X', 'Y', 'Z'].flatMap((axis) => [
    `CBodyComponent.m_cell${axis}`,
    `CBodyComponent.m_vec${axis}`,
  ]),
  ...[
    'm_bWarmupPeriod',
    'm_totalRoundsPlayed',
    'm_bHasMatchStarted',
    'm_eRoundWinReason',
    'm_gamePhase',
    'm_nOvertimePlaying',
  ].map((name) => `m_pGameRules.${name}`),
])
export function createEntityDecoder() {
  let serializers = new Map<string, Serializer>()
  const classes = new Map<number, { name: string; serializer: Serializer }>()
  const entities = new Map<number, Entity>()
  const baselines = new Map<number, Uint8Array>()
  const baselineValues = new Map<
    number,
    { values: Map<string, EntityValue>; polymorphic: Map<string, Serializer> }
  >()
  const stringTables: StringTable[] = []
  let classBits = 0
  function fields(
    reader: BitReader,
    serializer: Serializer,
    values: Map<string, EntityValue>,
    polymorphic: Map<string, Serializer>,
  ) {
    for (const path of readFieldPaths(reader)) {
      const field = resolveField(serializer, path, polymorphic)
      const value = field.decode(reader)
      if (replayFields.has(field.name)) values.set(field.name, value)
    }
  }
  function baseline(key: string, value: Uint8Array) {
    const id = Number(key)
    if (!key || /^\d+:\d+$/.test(key)) return
    if (!Number.isInteger(id) || id < 0) throw new Error('Invalid entity baseline class.')
    baselines.set(id, value)
    baselineValues.delete(id)
  }
  function updates(table: StringTable, bytes: Uint8Array, count: number) {
    if (!bytes.length) return
    const reader = new BitReader(bytes)
    let index = -1
    const history: string[] = []
    const d = table.definition
    for (let i = 0; i < count; i++) {
      index = reader.boolean() ? index + 1 : reader.varUint() + 1
      let key = table.entries.get(index)?.key ?? ''
      if (reader.boolean()) {
        if (reader.boolean()) {
          const reference = reader.bits(5)
          const size = reader.bits(5)
          key = (history[reference] ?? '').slice(0, size) + reader.string()
        } else key = reader.string()
        history.push(key)
        if (history.length > 32) history.shift()
      }
      let value = table.entries.get(index)?.value ?? new Uint8Array()
      if (reader.boolean()) {
        let compressed = false
        let bits = d.userDataSize
        if (!d.userDataFixedSize) {
          if (d.flags & 1) compressed = reader.boolean()
          bits = (d.usingVarintBitcounts ? reader.uBitVar() : reader.bits(17)) * 8
        }
        value = reader.bytes(Math.floor(bits / 8))
        if (bits & 7) {
          const rest = reader.bits(bits & 7)
          const expanded = new Uint8Array(value.length + 1)
          expanded.set(value)
          expanded[value.length] = rest
          value = expanded
        }
        if (compressed) value = uncompress(value, 32 * 1024 * 1024)
      }
      table.entries.set(index, { key, value })
      if (d.name === 'instancebaseline' && value.length) baseline(key, value)
    }
  }
  function snapshots(): PlayerSnapshot[] {
    const players: PlayerSnapshot[] = []
    for (const controller of entities.values()) {
      if (controller.className !== 'CCSPlayerController' || !controller.active) continue
      const steam = controller.values.get('m_steamID')
      const handle = controller.values.get('m_hPlayerPawn')
      if (
        typeof steam !== 'bigint' ||
        steam <= 0n ||
        typeof handle !== 'number' ||
        handle === 0xffffff
      )
        continue
      const pawn = entities.get(handle & 0x3fff)
      if (!pawn || pawn.serial !== Math.floor(handle / 16384)) continue
      const team = pawn.values.get('m_iTeamNum')
      if (team !== 2 && team !== 3) continue
      const name = controller.values.get('m_iszPlayerName')
      if (typeof name !== 'string' || !name.trim())
        throw new Error('A replay player is missing their name.')
      const pawnValues = pawn.values
      function axis(axis: string) {
        const cell = pawnValues.get(`CBodyComponent.m_cell${axis}`)
        const offset = pawnValues.get(`CBodyComponent.m_vec${axis}`)
        if (
          typeof cell !== 'number' ||
          typeof offset !== 'number' ||
          !Number.isFinite(cell) ||
          !Number.isFinite(offset)
        )
          throw new Error('A replay player is missing their recorded position.')
        return cell * 512 - 16384 + offset
      }
      const health = pawn.values.get('m_iHealth')
      const life = pawn.values.get('m_lifeState')
      if (typeof health !== 'number' || typeof life !== 'number')
        throw new Error('A replay player is missing their recorded life state.')
      players.push({
        steamId: steam.toString(),
        name,
        team,
        x: axis('X'),
        y: axis('Y'),
        z: axis('Z'),
        alive: health > 0 && life === 0,
      })
    }
    if (new Set(players.map((player) => player.steamId)).size !== players.length)
      throw new Error('The replay contains duplicate player identities.')
    return players.sort((a, b) => a.steamId.localeCompare(b.steamId))
  }
  return {
    sendTables(bytes: Uint8Array) {
      serializers = readSerializers(bytes)
    },
    classes(message: CDemoClassInfo) {
      for (const entry of message.classes) {
        const serializer = serializers.get(entry.networkName)
        if (!serializer) throw new Error(`Missing serializer for ${entry.networkName}.`)
        classes.set(entry.classId, { name: entry.networkName, serializer })
      }
    },
    serverInfo(message: CSVCMsg_ServerInfo) {
      if (!Number.isFinite(message.tickInterval) || message.tickInterval <= 0)
        throw new Error('The demo is missing a valid recorded tick interval.')
      if (message.maxClasses <= 0) throw new Error('Missing entity class count.')
      classBits = Math.floor(Math.log2(message.maxClasses)) + 1
    },
    tables(message: CDemoStringTables) {
      for (const table of message.tables)
        if (table.tableName === 'instancebaseline')
          for (const item of table.items) if (item.data.length) baseline(item.str, item.data)
    },
    createTable(message: CSVCMsg_CreateStringTable) {
      const table = { definition: message, entries: new Map() }
      stringTables.push(table)
      if (message.name === 'instancebaseline')
        updates(
          table,
          message.dataCompressed
            ? uncompress(message.stringData, 32 * 1024 * 1024)
            : message.stringData,
          message.numEntries,
        )
    },
    clearTables() {
      stringTables.length = 0
      baselines.clear()
      baselineValues.clear()
    },
    updateTable(message: CSVCMsg_UpdateStringTable) {
      const table = stringTables[message.tableId]
      if (!table) throw new Error('Missing network string table.')
      if (table.definition.name === 'instancebaseline')
        updates(table, message.stringData, message.numChangedEntries)
    },
    packet(message: CSVCMsg_PacketEntities) {
      if (!message.legacyIsDelta) entities.clear()
      if (!classBits) throw new Error('Missing entity server information.')
      const reader = new BitReader(message.entityData)
      let index = -1
      for (let i = 0; i < message.updatedEntries; i++) {
        index += reader.uBitVar() + 1
        const command = reader.bits(2)
        if (command & 1) {
          const entity = entities.get(index)
          if (!entity) throw new Error('Cannot remove an unknown replay entity.')
          entity.active = false
          if (command & 2) entities.delete(index)
          continue
        }
        let entity = entities.get(index)
        if (command & 2) {
          const id = reader.bits(classBits)
          const serial = reader.bits(17)
          reader.varUint()
          const entry = classes.get(id)
          if (!entry) throw new Error(`Missing entity class ${id}.`)
          let baselineState = baselineValues.get(id)
          if (!baselineState) {
            baselineState = { values: new Map(), polymorphic: new Map() }
            const bytes = baselines.get(id)
            if (bytes)
              fields(
                new BitReader(bytes),
                entry.serializer,
                baselineState.values,
                baselineState.polymorphic,
              )
            baselineValues.set(id, baselineState)
          }
          entity = {
            serial,
            className: entry.name,
            serializer: entry.serializer,
            values: new Map(baselineState.values),
            polymorphic: new Map(baselineState.polymorphic),
            active: true,
          }
          entities.set(index, entity)
        } else {
          if (message.hasPvsVisBitsDeprecated && reader.bits(2) & 1) continue
          if (!entity) throw new Error('Cannot update an unknown replay entity.')
          entity.active = true
        }
        fields(reader, entity.serializer, entity.values, entity.polymorphic)
      }
    },
    snapshots,
    gameRules() {
      const entity = [...entities.values()].find(
        (entity) => entity.className === 'CCSGameRulesProxy',
      )
      if (!entity) return undefined
      const warmup = entity.values.get('m_pGameRules.m_bWarmupPeriod')
      const rounds = entity.values.get('m_pGameRules.m_totalRoundsPlayed')
      const started = entity.values.get('m_pGameRules.m_bHasMatchStarted')
      const reason = entity.values.get('m_pGameRules.m_eRoundWinReason')
      const phase = entity.values.get('m_pGameRules.m_gamePhase')
      const overtime = entity.values.get('m_pGameRules.m_nOvertimePlaying')
      if (
        typeof warmup !== 'boolean' ||
        typeof rounds !== 'number' ||
        typeof started !== 'boolean' ||
        typeof reason !== 'number' ||
        typeof phase !== 'number' ||
        typeof overtime !== 'number' ||
        overtime < 0
      )
        throw new Error('Missing recorded competitive round rules.')
      return {
        warmup,
        totalRoundsPlayed: rounds,
        started,
        reason,
        phase,
        overtime,
      }
    },
  }
}
