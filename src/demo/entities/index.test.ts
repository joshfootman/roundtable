import { create, toBinary } from '@bufbuild/protobuf'
import { expect, test } from 'vitest'
import { CDemoClassInfoSchema } from '../generated/demo_pb'
import {
  CSVCMsg_FlattenedSerializerSchema,
  CSVCMsg_PacketEntitiesSchema,
  CSVCMsg_ServerInfoSchema,
} from '../generated/replay_pb'
import { createEntityDecoder } from './index'

type WireType = 'uint32' | 'uint64' | 'bool' | 'float32' | 'Vector' | 'char'
type WireValue = number | bigint | boolean | string | number[]
const coordinates: [string, WireType][] = ['X', 'Y', 'Z'].flatMap((axis) => [
  [`CBodyComponent.m_cell${axis}`, 'uint32'],
  [`CBodyComponent.m_vec${axis}`, 'float32'],
])
const definitions: Record<string, [string, WireType][]> = {
  CCSTeam: [
    ['m_iTeamNum', 'uint32'],
    ['m_iScore', 'uint32'],
  ],
  CCSPlayerController: [
    ['m_steamID', 'uint64'],
    ['m_hPlayerPawn', 'uint32'],
    ['m_iszPlayerName', 'char'],
    ['m_pInGameMoneyServices.m_iAccount', 'uint32'],
  ],
  CCSPlayerPawn: [
    ['m_iTeamNum', 'uint32'],
    ['m_iHealth', 'uint32'],
    ['m_lifeState', 'uint32'],
    ['m_angEyeAngles', 'Vector'],
    ['m_ArmorValue', 'uint32'],
    ['m_pItemServices.m_bHasHelmet', 'bool'],
    ['m_flFlashDuration', 'float32'],
    ['m_pWeaponServices.m_hMyWeapons', 'uint32'],
    ['m_pWeaponServices.m_hActiveWeapon', 'uint32'],
    ...coordinates,
    ...Array.from({ length: 5 }, (_, index): [string, WireType] => [
      `m_pWeaponServices.m_hMyWeapons.${index}`,
      'uint32',
    ]),
    ['m_pWeaponServices.m_iAmmo.14', 'uint32'],
  ],
  CWeapon: [
    ['m_iItemDefinitionIndex', 'uint32'],
    ['m_iClip1', 'uint32'],
    ['m_pReserveAmmo.0', 'uint32'],
  ],
  CC4: [['m_hOwnerEntity', 'uint32'], ['m_bStartedArming', 'bool'], ...coordinates],
  CPlantedC4: [
    ['m_bBombTicking', 'bool'],
    ['m_bBombDefused', 'bool'],
    ['m_hBombDefuser', 'uint32'],
    ...coordinates,
  ],
  CSmokeGrenadeProjectile: [
    ['m_hThrower', 'uint32'],
    ['m_nExplodeEffectTickBegin', 'uint32'],
    ['m_bDidSmokeEffect', 'bool'],
    ...coordinates,
  ],
  CUnknownProjectile: [['m_hThrower', 'uint32']],
  CInferno: [
    ['m_fireCount', 'uint32'],
    ['m_bFireIsBurning.0', 'bool'],
    ['m_firePositions.0', 'Vector'],
  ],
  CCSGameRulesProxy: [
    ['m_pGameRules.m_bWarmupPeriod', 'bool'],
    ['m_pGameRules.m_bFreezePeriod', 'bool'],
    ['m_pGameRules.m_totalRoundsPlayed', 'uint32'],
    ['m_pGameRules.m_bHasMatchStarted', 'bool'],
    ['m_pGameRules.m_eRoundWinReason', 'uint32'],
    ['m_pGameRules.m_gamePhase', 'uint32'],
    ['m_pGameRules.m_nOvertimePlaying', 'uint32'],
  ],
}

class WireWriter {
  private data: number[] = []
  private offset = 0
  bits(value: number, count: number) {
    for (let index = 0; index < count; index++, this.offset++) {
      const byte = this.offset >> 3
      this.data[byte] = (this.data[byte] ?? 0) | (((value >>> index) & 1) << (this.offset & 7))
    }
  }
  varUint(value: number | bigint) {
    let remaining = BigInt(value)
    do {
      const byte = Number(remaining & 127n)
      remaining >>= 7n
      this.bits(byte | (remaining ? 128 : 0), 8)
    } while (remaining)
  }
  value(type: WireType, value: WireValue) {
    if (type === 'bool') this.bits(value ? 1 : 0, 1)
    else if (type === 'uint32' || type === 'uint64') this.varUint(value as number | bigint)
    else if (type === 'char') {
      for (const byte of new TextEncoder().encode(value as string)) this.bits(byte, 8)
      this.bits(0, 8)
    } else {
      for (const scalar of type === 'Vector' ? (value as number[]) : [value as number]) {
        const bytes = new Uint8Array(4)
        new DataView(bytes.buffer).setFloat32(0, scalar, true)
        for (const byte of bytes) this.bits(byte, 8)
      }
    }
  }
  bytes() {
    return Uint8Array.from(this.data)
  }
}

interface Entry {
  id: number
  className?: string
  serial?: number
  values?: WireValue[]
  remove?: 'inactive' | 'delete'
}
function recording() {
  const decoder = createEntityDecoder()
  const classNames = Object.keys(definitions)
  const symbols: string[] = []
  function symbol(value: string) {
    let index = symbols.indexOf(value)
    if (index === -1) index = symbols.push(value) - 1
    return index
  }
  const fields: { varNameSym: number; varTypeSym: number }[] = []
  const serializers = classNames.map((name) => ({
    serializerNameSym: symbol(name),
    fieldsIndex: definitions[name]!.map(([name, type]) => {
      fields.push({ varNameSym: symbol(name), varTypeSym: symbol(type) })
      return fields.length - 1
    }),
  }))
  const bytes = toBinary(
    CSVCMsg_FlattenedSerializerSchema,
    create(CSVCMsg_FlattenedSerializerSchema, { serializers, symbols, fields }),
  )
  const prefix = new WireWriter()
  prefix.varUint(bytes.length)
  decoder.sendTables(new Uint8Array([...prefix.bytes(), ...bytes]))
  decoder.classes(
    create(CDemoClassInfoSchema, {
      classes: classNames.map((networkName, classId) => ({ networkName, classId })),
    }),
  )
  decoder.serverInfo(create(CSVCMsg_ServerInfoSchema, { maxClasses: 15, tickInterval: 1 / 64 }))
  const entityClasses = new Map<number, string>()
  function packet(entries: Entry[], full = false) {
    const writer = new WireWriter()
    let previous = -1
    for (const entry of entries) {
      writer.bits(entry.id - previous - 1, 6)
      previous = entry.id
      writer.bits(
        entry.remove === 'delete' ? 3 : entry.remove === 'inactive' ? 1 : entry.className ? 2 : 0,
        2,
      )
      if (entry.remove) continue
      if (entry.className) {
        entityClasses.set(entry.id, entry.className)
        writer.bits(classNames.indexOf(entry.className), 4)
        writer.bits(entry.serial ?? 0, 17)
        writer.varUint(0)
      }
      const values = entry.values ?? []
      for (const _value of values) writer.bits(0, 1)
      writer.bits(1, 1)
      writer.bits(0, 1)
      const fields = definitions[entityClasses.get(entry.id)!]!
      values.forEach((value, index) => writer.value(fields[index]![1], value))
    }
    decoder.packet(
      create(CSVCMsg_PacketEntitiesSchema, {
        legacyIsDelta: !full,
        updatedEntries: entries.length,
        entityData: writer.bytes(),
      }),
      100,
    )
  }
  return { decoder, packet }
}

const pawn = [3, 100, 0, [0, 90, 0], 50, true, 0, 0, 0xffffff, 32, 10, 32, 20, 32, 30]
const planted = [true, false, 0xffffff, 32, 10, 32, 20, 32, 30]

test('reads scores by recorded team side and follows halftime updates', () => {
  const { decoder, packet } = recording()
  packet([
    { id: 1, className: 'CCSGameRulesProxy', values: [false, true, 12, true, 0, 2, 0] },
    { id: 2, className: 'CCSTeam', values: [2, 7] },
    { id: 3, className: 'CCSTeam', values: [3, 5] },
  ])
  expect(decoder.gameRules()?.score).toEqual({ ct: 5, t: 7 })
  packet([
    { id: 2, values: [3, 7] },
    { id: 3, values: [2, 5] },
  ])
  expect(decoder.gameRules()?.score).toEqual({ ct: 7, t: 5 })
  packet([{ id: 3, remove: 'inactive' }])
  expect(decoder.gameRules()?.score).toBeUndefined()
})

test('rebuilds projections after inactivation, reactivation, deletion and serial replacement', () => {
  const { decoder, packet } = recording()
  packet([
    { id: 1, className: 'CSmokeGrenadeProjectile' },
    { id: 2, className: 'CInferno', values: [1, true, [10, 20, 30]] },
  ])
  const smoke = decoder.smokeEntities()
  expect([...smoke]).toEqual([1])
  expect(decoder.fires()).toEqual([{ entity: 2, serial: 0, positions: [10, 20, 30] }])
  packet([
    { id: 1, remove: 'inactive' },
    { id: 2, remove: 'delete' },
  ])
  expect([...decoder.smokeEntities()]).toEqual([])
  expect(decoder.fires()).toEqual([])
  expect([...smoke]).toEqual([1])
  packet([{ id: 1 }, { id: 2, className: 'CInferno', serial: 7, values: [1, true, [40, 50, 60]] }])
  expect([...decoder.smokeEntities()]).toEqual([1])
  expect(decoder.fires()).toEqual([{ entity: 2, serial: 7, positions: [40, 50, 60] }])
  packet([{ id: 1, className: 'CInferno', serial: 8, values: [1, true, [70, 80, 90]] }])
  expect([...decoder.smokeEntities()]).toEqual([])
  expect(decoder.fires()).toEqual([
    { entity: 1, serial: 8, positions: [70, 80, 90] },
    { entity: 2, serial: 7, positions: [40, 50, 60] },
  ])
})

test('observes the final staged packet and ignores repeated full packets', () => {
  const { decoder, packet } = recording()
  packet([{ id: 1, className: 'CSmokeGrenadeProjectile' }], true)
  expect([...decoder.smokeEntities()]).toEqual([1])
  packet([{ id: 1, remove: 'delete' }], true)
  expect([...decoder.smokeEntities()]).toEqual([1])
  packet([{ id: 1, remove: 'inactive' }])
  packet([{ id: 2, className: 'CSmokeGrenadeProjectile' }])
  expect([...decoder.smokeEntities()]).toEqual([2])
  packet([{ id: 1 }])
  packet([{ id: 2, remove: 'delete' }])
  expect([...decoder.smokeEntities()]).toEqual([1])
})

test('preserves first controller identity and full pawn-handle serial checks', () => {
  const { decoder, packet } = recording()
  packet([
    { id: 1, className: 'CCSPlayerPawn', serial: 2 },
    { id: 2, className: 'CCSPlayerController', values: [0n, 32769] },
    { id: 3, className: 'CCSPlayerController', values: [77n, 32769] },
  ])
  expect(() => decoder.playerByPawnHandle(32769)).toThrow('Missing recorded pawn identity.')
  expect(() => decoder.playerByPawnHandle(16385)).toThrow(
    'A recorded entity handle cannot be resolved.',
  )
  packet([{ id: 2, remove: 'inactive' }])
  expect(decoder.playerByPawnHandle(32769)).toBe('77')
  packet([{ id: 2 }])
  expect(() => decoder.playerByPawnHandle(32769)).toThrow('Missing recorded pawn identity.')
  packet([{ id: 2, remove: 'delete' }])
  packet([{ id: 2, className: 'CCSPlayerController', values: [88n, 32769] }])
  expect(decoder.playerByPawnHandle(32769)).toBe('77')
})

test('selects bombs in insertion order and prefers a ticking planted bomb', () => {
  const { decoder, packet } = recording()
  packet([
    { id: 1, className: 'CC4', values: [0xffffff, false, 32, 1, 32, 2, 32, 3] },
    { id: 2, className: 'CC4', values: [0xffffff, false, 32, 4, 32, 5, 32, 6] },
    { id: 3, className: 'CPlantedC4', values: planted },
  ])
  expect(decoder.bomb()).toEqual({
    type: 'planted',
    x: 10,
    y: 20,
    z: 30,
    defuser: { type: 'none' },
  })
  packet([{ id: 3, values: [false, false] }])
  expect(decoder.bomb()).toEqual({ type: 'dropped', x: 1, y: 2, z: 3 })
  packet([{ id: 1, className: 'CC4', serial: 1, values: [0xffffff, false, 32, 7, 32, 8, 32, 9] }])
  expect(decoder.bomb()).toEqual({ type: 'dropped', x: 7, y: 8, z: 9 })
  packet([{ id: 1, remove: 'delete' }])
  packet([{ id: 1, className: 'CC4', values: [0xffffff, false, 32, 10, 32, 11, 32, 12] }])
  expect(decoder.bomb()).toEqual({ type: 'dropped', x: 4, y: 5, z: 6 })
})

test('keeps inactive first game rules and delays malformed-field validation until requested', () => {
  const { decoder, packet } = recording()
  packet([
    { id: 1, className: 'CCSGameRulesProxy', values: [false, true, 2, true, 0, 1, 0] },
    { id: 2, className: 'CCSGameRulesProxy', values: [false, false, 9, true, 0, 1, 0] },
    { id: 3, className: 'CPlantedC4' },
    { id: 4, className: 'CInferno' },
    { id: 5, className: 'CUnknownProjectile', values: [1] },
    { id: 6, className: 'CSmokeGrenadeProjectile' },
  ])
  packet([{ id: 1, remove: 'inactive' }])
  expect(decoder.gameRules()).toEqual({
    warmup: false,
    freezePeriod: true,
    totalRoundsPlayed: 2,
    started: true,
    reason: 0,
    phase: 1,
    overtime: 0,
  })
  expect([...decoder.smokeEntities()]).toEqual([6])
  expect(() => decoder.bomb()).toThrow('Missing recorded planted bomb state.')
  expect(() => decoder.fires()).toThrow('Missing recorded fire cell count.')
  expect(() => decoder.projectiles()).toThrow(
    'Unsupported recorded grenade class CUnknownProjectile.',
  )
})

test('keeps smoke visibility independent of throwers and effects and projectile order', () => {
  const { decoder, packet } = recording()
  packet([
    { id: 1, className: 'CCSPlayerPawn' },
    { id: 2, className: 'CCSPlayerController', values: [77n, 1] },
    { id: 3, className: 'CSmokeGrenadeProjectile' },
    { id: 4, className: 'CSmokeGrenadeProjectile', values: [1, 42, true] },
    {
      id: 5,
      className: 'CSmokeGrenadeProjectile',
      serial: 3,
      values: [1, 0, false, 32, 10, 32, 20, 32, 30],
    },
    {
      id: 6,
      className: 'CSmokeGrenadeProjectile',
      serial: 4,
      values: [1, 0, false, 32, 40, 32, 50, 32, 60],
    },
  ])
  expect([...decoder.smokeEntities()]).toEqual([3, 4, 5, 6])
  expect(decoder.projectiles()).toEqual([
    { entity: 5, serial: 3, kind: 'smoke', thrower: '77', x: 10, y: 20, z: 30 },
    { entity: 6, serial: 4, kind: 'smoke', thrower: '77', x: 40, y: 50, z: 60 },
  ])
  packet([
    {
      id: 5,
      className: 'CSmokeGrenadeProjectile',
      serial: 5,
      values: [1, 0, false, 32, 70, 32, 80, 32, 90],
    },
  ])
  expect(decoder.projectiles().map(({ entity, serial }) => ({ entity, serial }))).toEqual([
    { entity: 5, serial: 5 },
    { entity: 6, serial: 4 },
  ])
  packet([{ id: 5, remove: 'delete' }])
  packet([
    {
      id: 5,
      className: 'CSmokeGrenadeProjectile',
      serial: 6,
      values: [1, 0, false, 32, 100, 32, 110, 32, 120],
    },
  ])
  expect(decoder.projectiles().map(({ entity, serial }) => ({ entity, serial }))).toEqual([
    { entity: 6, serial: 4 },
    { entity: 5, serial: 6 },
  ])
})

test('sorts player snapshots and preserves inactive pawn lookup', () => {
  const { decoder, packet } = recording()
  packet([
    { id: 1, className: 'CCSPlayerPawn', values: pawn },
    { id: 2, className: 'CCSPlayerPawn', values: pawn },
    { id: 3, className: 'CCSPlayerController', values: [99n, 1, 'Later', 500] },
    { id: 4, className: 'CCSPlayerController', values: [11n, 2, 'Earlier', 800] },
  ])
  packet([{ id: 1, remove: 'inactive' }])
  expect(decoder.snapshots()).toEqual([
    {
      steamId: '11',
      name: 'Earlier',
      team: 3,
      x: 10,
      y: 20,
      z: 30,
      alive: true,
      health: 100,
      yaw: 90,
      money: 800,
      armour: 50,
      helmet: true,
      flash: { type: 'none' },
      grenades: [],
      weapons: [],
      weapon: { type: 'none' },
    },
    {
      steamId: '99',
      name: 'Later',
      team: 3,
      x: 10,
      y: 20,
      z: 30,
      alive: true,
      health: 100,
      yaw: 90,
      money: 500,
      armour: 50,
      helmet: true,
      flash: { type: 'none' },
      grenades: [],
      weapons: [],
      weapon: { type: 'none' },
    },
  ])
})

test('reads the full owned inventory while a knife is active and preserves grenade counts', () => {
  const { decoder, packet } = recording()
  const equipped = [...pawn, 6, 5, 3, 4, 0xffffff, 2]
  equipped[7] = 5
  equipped[8] = 5
  packet([
    { id: 1, className: 'CCSPlayerPawn', values: equipped },
    { id: 2, className: 'CCSPlayerController', values: [77n, 1, 'Player', 800] },
    { id: 3, className: 'CWeapon', values: [7, 31, 90] },
    { id: 4, className: 'CWeapon', values: [4, 21, 120] },
    { id: 5, className: 'CWeapon', values: [42] },
    { id: 6, className: 'CWeapon', values: [43] },
  ])
  expect(decoder.snapshots()[0]).toMatchObject({
    weapon: { type: 'item', definition: 42 },
    weapons: [
      { type: 'gun', definition: 4, magazine: 20, reserve: 120 },
      { type: 'gun', definition: 7, magazine: 30, reserve: 90 },
      { type: 'item', definition: 42 },
      { type: 'item', definition: 43 },
    ],
    grenades: [{ definition: 43, count: 2 }],
  })
  const dropped = [...equipped]
  dropped[17] = 0xffffffff
  packet([{ id: 1, values: dropped }])
  expect(decoder.snapshots()[0]?.weapons).toEqual([
    { type: 'gun', definition: 4, magazine: 20, reserve: 120 },
    { type: 'item', definition: 42 },
    { type: 'item', definition: 43 },
  ])
})
