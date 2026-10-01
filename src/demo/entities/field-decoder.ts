import { BitReader } from './bit-reader.ts'
export type EntityValue = number | bigint | boolean | string | number[] | Uint8Array
export type ValueDecoder = (reader: BitReader) => EntityValue
export interface Encoding {
  name: string
  type: string
  encoder: string
  bitCount: number
  flags: number
  low: number
  high: number
}
const f32 = Math.fround
function quantized(field: Encoding): ValueDecoder {
  let { bitCount, flags, low, high } = field
  if (bitCount <= 0 || bitCount >= 32) return (reader) => reader.float()
  if ((low === 0 && flags & 1) || (high === 0 && flags & 2)) flags &= ~4
  if (low === 0 && flags & 4) flags = (flags | 1) & ~4
  if (high === 0 && flags & 4) flags = (flags | 2) & ~4
  if (low > 0 || high < 0) flags &= ~4
  if (flags & 8) flags &= ~7
  if ((flags & 3) === 3) throw new Error('The demo has conflicting quantized-float flags.')
  let steps = 2 ** bitCount
  if (flags & 1) high = f32(high - f32(f32(high - low) / steps))
  else if (flags & 2) low = f32(low + f32(f32(high - low) / steps))
  if (flags & 8) {
    const range = 2 ** Math.ceil(Math.log2(Math.max(f32(high - low), 1)))
    while (2 ** bitCount <= range) bitCount++
    steps = 2 ** bitCount
    high = f32(f32(low + range) - f32(range / steps))
  }
  const range = f32(high - low)
  const maximum = 2 ** bitCount - 1
  let multiplier = range === 0 ? f32(maximum) : f32(maximum / range)
  if (f32(multiplier * range) > f32(maximum) || f32(multiplier * range) > maximum) {
    for (const scale of [0.9999, 0.99, 0.9, 0.8, 0.7]) {
      multiplier = f32(f32(maximum / range) * f32(scale))
      if (f32(multiplier * range) <= f32(maximum) && f32(multiplier * range) <= maximum) break
    }
  }
  const decodeMultiplier = f32(1 / (steps - 1))
  const quantize = (value: number) =>
    f32(
      low +
        f32(range * f32(f32(Math.trunc(f32(f32(value - low) * multiplier))) * decodeMultiplier)),
    )
  if (flags & 1 && quantize(low) === low) flags &= ~1
  if (flags & 2 && quantize(high) === high) flags &= ~2
  if (flags & 4 && quantize(0) === 0) flags &= ~4
  return (reader) => {
    if (flags & 1 && reader.boolean()) return low
    if (flags & 2 && reader.boolean()) return high
    if (flags & 4 && reader.boolean()) return 0
    return f32(low + f32(f32(range * f32(reader.bits(bitCount))) * decodeMultiplier))
  }
}
function floatDecoder(field: Encoding): ValueDecoder {
  if (field.encoder === 'coord') return (reader) => reader.coord()
  if (
    field.encoder === 'simtime' ||
    field.name === 'm_flSimulationTime' ||
    field.name === 'm_flAnimTime'
  )
    return (reader) => reader.varUint() / 64
  if (field.encoder === 'runetime')
    return (reader) => {
      const bytes = new Uint8Array(4)
      new DataView(bytes.buffer).setUint32(0, reader.bits(4), true)
      return new DataView(bytes.buffer).getFloat32(0, true)
    }
  return quantized(field)
}
const unsignedTypes = new Set([
  'AnimationAlgorithm_t',
  'DecalMode_t',
  'WeaponGameplayAnimState',
  'EntityPlatformTypes_t',
  'BloodType',
  'PlayerConnectedState',
  'GameTick_t',
  'EKillTypes_t',
  'AnimLoopMode_t',
  'loadout_slot_t',
  'PlayerAnimEvent_t',
  'WeaponAttackType_t',
  'CSWeaponState_t',
  'WorldGroupId_t',
  'FixAngleSet_t',
  'CPlayerSlot',
  'uint8',
  'uint16',
  'uint32',
  'Color',
  'CUtlStringToken',
  'EHandle',
  'CEntityHandle',
  'CGameSceneNodeHandle',
  'AttachmentHandle_t',
  'MoveCollide_t',
  'MoveType_t',
  'RenderMode_t',
  'RenderFx_t',
  'SolidType_t',
  'SurroundingBoundsType_t',
  'ModelConfigHandle_t',
  'NPC_STATE',
  'StanceType_t',
  'WeaponState_t',
  'DoorState_t',
  'RagdollBlendDirection',
  'BeamType_t',
  'BeamClipStyle_t',
  'EntityDisolveType_t',
  'PointWorldTextJustifyHorizontal_t',
  'PointWorldTextJustifyVertical_t',
  'PointWorldTextReorientMode_t',
  'PoseController_FModType_t',
  'PrecipitationType_t',
  'ShardSolid_t',
  'ShatterPanelMode',
  'gender_t',
  'item_definition_index_t',
  'itemid_t',
  'style_index_t',
  'attributeprovidertypes_t',
  'DamageOptions_t',
  'ScreenEffectType_t',
  'TakeDamageFlags_t',
  'CSWeaponMode',
  'ESurvivalSpawnTileState',
  'SpawnStage_t',
  'ESurvivalGameRuleDecision_t',
  'RelativeDamagedDirection_t',
  'CSPlayerState',
  'MedalRank_t',
  'CSPlayerBlockingUseAction_t',
  'MoveMountingAmount_t',
  'QuestProgress::Reason',
  'tablet_skin_state_t',
  'CHandle',
])
export function decoder(field: Encoding): ValueDecoder {
  const type = field.type
  if (type === 'float32' || type === 'CNetworkedQuantizedFloat') return floatDecoder(field)
  if (type === 'uint64' || type === 'CStrongHandle' || type === 'ResourceId_t')
    return field.encoder === 'fixed64'
      ? (reader) => reader.fixed64()
      : (reader) => reader.varUint64()
  const count: Record<string, number> = {
    Vector: 3,
    VectorWS: 3,
    Vector2D: 2,
    Vector4D: 4,
    Quaternion: 4,
    CTransform: 6,
  }
  if (count[type]) {
    if (count[type] === 3 && field.encoder === 'normal') return (reader) => reader.normalVector()
    const scalar = floatDecoder(field)
    return (reader) => Array.from({ length: count[type]! }, () => scalar(reader) as number)
  }
  if (type === 'QAngle') {
    if (field.encoder === 'qangle_precise')
      return (reader) => {
        const present = [reader.boolean(), reader.boolean(), reader.boolean()]
        return present.map((has) => (has ? reader.angle(20) - 180 : 0))
      }
    if (field.bitCount)
      return (reader) => [
        reader.angle(field.bitCount),
        reader.angle(field.bitCount),
        reader.angle(field.bitCount),
      ]
    return (reader) => {
      const present = [reader.boolean(), reader.boolean(), reader.boolean()]
      return present.map((has) => (has ? reader.coord() : 0))
    }
  }
  if (field.name === 'm_iClip1') return (reader) => reader.varUint() - 1
  if (
    type === 'bool' ||
    ['CBodyComponent', 'CPhysicsComponent', 'CLightComponent', 'CRenderComponent'].includes(type)
  )
    return (reader) => reader.boolean()
  if (['int8', 'int16', 'int32', 'HSequence', 'CEntityIndex', 'AmmoIndex_t'].includes(type))
    return (reader) => reader.varInt()
  if (['char', 'CUtlString', 'CUtlSymbolLarge', 'CGlobalSymbol'].includes(type))
    return (reader) => reader.string()
  if (type === 'CUtlBinaryBlock') return (reader) => reader.bytes(reader.varUint())
  if (type === 'GameTime_t') return (reader) => reader.float()
  if (unsignedTypes.has(type)) return (reader) => reader.varUint()
  return () => {
    throw new Error(`Unsupported entity field type ${type} (${field.name}).`)
  }
}
