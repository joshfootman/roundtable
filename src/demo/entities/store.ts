import { fromBinary } from '@bufbuild/protobuf'
import { uncompress } from 'snappyjs'
import { type CDemoClassInfo, type CDemoStringTables } from '../generated/demo_pb.ts'
import {
  type CSVCMsg_ServerInfo,
  type CSVCMsg_PacketEntities,
  type CSVCMsg_CreateStringTable,
  type CSVCMsg_UpdateStringTable,
} from '../generated/replay_pb.ts'
import { CMsgPlayerInfoSchema } from '../generated/roster_pb.ts'
import { BitReader } from './bit-reader.ts'
import { type EntityValue } from './field-decoder.ts'
import { readFieldPaths } from './field-path.ts'
import { readSerializers, resolveField, type Serializer } from './serializers.ts'

export interface Entity {
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
export interface FieldPolicy {
  /** Whether to keep a decoded field; everything else is read and discarded. */
  retained(name: string): boolean
  /** Fields whose first arrival can change how a consumer groups the entity. */
  classifying: ReadonlySet<string>
  /** Fields whose identity is a handle; a new value regroups the entity. */
  regroupOnChange: ReadonlySet<string>
  /** Fields that also record the tick they last changed, under the mapped name. */
  stamped: ReadonlyMap<string, string>
}

/** Source 2 network state: classes, baselines, string tables and live entities. */
export function createEntityStore(policy: FieldPolicy) {
  let serializers = new Map<string, Serializer>()
  const classes = new Map<number, { name: string; serializer: Serializer }>()
  const entities = new Map<number, Entity>()
  const baselines = new Map<number, Uint8Array>()
  const baselineValues = new Map<
    number,
    { values: Map<string, EntityValue>; polymorphic: Map<string, Serializer> }
  >()
  const users = new Map<number, string>()
  const stringTables: StringTable[] = []
  let classBits = 0
  let receivedFullEntities = false
  // Bumped whenever an entity is created, removed, reactivated or reclassified.
  let membership = 0
  function fields(
    reader: BitReader,
    serializer: Serializer,
    values: Map<string, EntityValue>,
    polymorphic: Map<string, Serializer>,
    tick?: number,
  ) {
    for (const path of readFieldPaths(reader)) {
      const field = resolveField(serializer, path, polymorphic)
      const value = field.decode(reader)
      if (!policy.retained(field.name)) continue
      const stamp = tick === undefined ? undefined : policy.stamped.get(field.name)
      if (stamp) values.set(stamp, tick!)
      if (
        (policy.classifying.has(field.name) && !values.has(field.name)) ||
        (policy.regroupOnChange.has(field.name) && values.get(field.name) !== value)
      )
        membership++
      values.set(field.name, value)
    }
  }
  function baseline(key: string, value: Uint8Array) {
    const id = Number(key)
    if (!key || /^\d+:\d+$/.test(key)) return
    if (!Number.isInteger(id) || id < 0) throw new Error('Invalid entity baseline class.')
    baselines.set(id, value)
    baselineValues.delete(id)
  }
  function userInfo(value: Uint8Array) {
    if (!value.length) return
    const info = fromBinary(CMsgPlayerInfoSchema, value)
    const id = info.userid & 0xff
    if (info.fakeplayer || info.ishltv || info.xuid <= 0n) users.delete(id)
    else users.set(id, info.xuid.toString())
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
      if (d.name === 'userinfo') userInfo(value)
    }
  }
  return {
    entities: entities as ReadonlyMap<number, Entity>,
    get membership() {
      return membership
    },
    entityForHandle(handle: number): Entity {
      const entity = entities.get(handle & 0x3fff)
      if (!entity || entity.serial !== Math.floor(handle / 16384))
        throw new Error('A recorded entity handle cannot be resolved.')
      return entity
    },
    /** The Steam ID for a userinfo slot, if a real player holds it. */
    user(id: number): string | undefined {
      return users.get(id & 0xff)
    },
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
      for (const table of message.tables) {
        if (table.tableName === 'instancebaseline') {
          for (const item of table.items) if (item.data.length) baseline(item.str, item.data)
        } else if (table.tableName === 'userinfo') {
          for (const item of table.items) userInfo(item.data)
        }
      }
    },
    createTable(message: CSVCMsg_CreateStringTable) {
      const table = { definition: message, entries: new Map() }
      stringTables.push(table)
      if (message.name === 'instancebaseline' || message.name === 'userinfo')
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
      users.clear()
      baselines.clear()
      baselineValues.clear()
    },
    updateTable(message: CSVCMsg_UpdateStringTable) {
      const table = stringTables[message.tableId]
      if (!table) throw new Error('Missing network string table.')
      if (table.definition.name === 'instancebaseline' || table.definition.name === 'userinfo')
        updates(table, message.stringData, message.numChangedEntries)
    },
    packet(message: CSVCMsg_PacketEntities, tick: number) {
      if (!message.legacyIsDelta) {
        if (receivedFullEntities) return
        receivedFullEntities = true
      }
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
          membership++
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
          membership++
        } else {
          if (message.hasPvsVisBitsDeprecated && reader.bits(2) & 1) continue
          if (!entity) throw new Error('Cannot update an unknown replay entity.')
          if (!entity.active) membership++
          entity.active = true
        }
        fields(reader, entity.serializer, entity.values, entity.polymorphic, tick)
      }
    },
  }
}
