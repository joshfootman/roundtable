import { fromBinary, isFieldSet } from '@bufbuild/protobuf'
import {
  CSVCMsg_FlattenedSerializerSchema,
  ProtoFlattenedSerializerField_tSchema as rawSchema,
} from '../generated/replay_pb.ts'
import { BitReader } from './bit-reader.ts'
import { decoder, type ValueDecoder } from './field-decoder.ts'
type Field = { name: string; value: ValueDecoder } & (
  | { model: 'scalar' | 'array' }
  | { model: 'table' | 'tables'; child: Serializer; choices: Serializer[] }
  | { model: 'vector'; element: ValueDecoder }
)
export interface Serializer {
  name: string
  fields: Field[]
}
const pointers = new Set([
  'CBodyComponentDCGBaseAnimating',
  'CBodyComponentBaseAnimating',
  'CBodyComponentBaseAnimatingOverlay',
  'CBodyComponentBaseModelEntity',
  'CBodyComponent',
  'CBodyComponentSkeletonInstance',
  'CBodyComponentPoint',
  'CLightComponent',
  'CRenderComponent',
  'CPhysicsComponent',
])
export function readSerializers(bytes: Uint8Array): Map<string, Serializer> {
  const reader = new BitReader(bytes)
  const message = fromBinary(CSVCMsg_FlattenedSerializerSchema, reader.bytes(reader.varUint()))
  const result = new Map<string, Serializer>()
  for (const entry of message.serializers) {
    const name = message.symbols[entry.serializerNameSym]!
    const serializer = { name, fields: [] }
    result.set(`${name}:${entry.serializerVersion}`, serializer)
    result.set(name, serializer)
  }
  const fields = new Map<number, Field>()
  function build(index: number): Field {
    const cached = fields.get(index)
    if (cached) return cached
    const raw = message.fields[index]
    if (!raw) throw new Error('Missing entity serializer field.')
    const symbol = (
      key: 'varNameSym' | 'varTypeSym' | 'fieldSerializerNameSym' | 'varEncoderSym',
    ) => (isFieldSet(raw, rawSchema.field[key]) ? message.symbols[raw[key]]! : '')
    const name = symbol('varNameSym')
    const type = symbol('varTypeSym')
    const match = /^([^<[*]+)(?:<\s*(.*?)\s*>)?(\*)?(?:\[(.*?)\])?$/.exec(type)
    if (!match) throw new Error(`Invalid entity field type ${type}.`)
    const base = match[1]!.trim()
    const child = result.get(`${symbol('fieldSerializerNameSym')}:${raw.fieldSerializerVersion}`)
    const encoding = {
      name,
      type: base,
      encoder: symbol('varEncoderSym'),
      bitCount: raw.bitCount,
      flags: raw.encodeFlags,
      low: raw.lowValue,
      high: isFieldSet(raw, rawSchema.field.highValue) ? raw.highValue : 1,
    }
    let field: Field
    if (child) {
      field = {
        name,
        model: match[3] || pointers.has(base) ? 'table' : 'tables',
        child,
        choices: raw.polymorphicTypes.map((type) => {
          const selected = result.get(
            `${message.symbols[type.polymorphicFieldSerializerNameSym]!}:${type.polymorphicFieldSerializerVersion}`,
          )
          if (!selected) throw new Error('Missing polymorphic entity serializer.')
          return selected
        }),
        value: match[3] || pointers.has(base) ? (r) => r.boolean() : (r) => r.varUint(),
      }
    } else if (match[4] && base !== 'char')
      field = { name, model: 'array', value: decoder(encoding) }
    else if (base === 'CUtlVector' || base === 'CNetworkUtlVectorBase') {
      if (!match[2]) throw new Error(`Missing entity vector type ${type}.`)
      field = {
        name,
        model: 'vector',
        value: (r) => r.varUint(),
        element: decoder({ ...encoding, type: match[2].replace(/\s*[<*].*$/, '') }),
      }
    } else field = { name, model: 'scalar', value: decoder(encoding) }
    fields.set(index, field)
    return field
  }
  for (const entry of message.serializers)
    result.get(`${message.symbols[entry.serializerNameSym]!}:${entry.serializerVersion}`)!.fields =
      entry.fieldsIndex.map(build)
  return result
}
export function resolveField(
  serializer: Serializer,
  path: number[],
  polymorphic: Map<string, Serializer>,
): { name: string; decode: ValueDecoder } {
  let current = serializer
  let position = 0
  const names: string[] = []
  while (position < path.length) {
    const field = current.fields[path[position++]!]
    if (!field)
      throw new Error(
        `Invalid entity field path ${path} at ${position - 1} in ${current.name} (${current.fields.length} fields).`,
      )
    names.push(field.name)
    if (position === path.length) {
      const name = names.join('.')
      if ((field.model === 'table' || field.model === 'tables') && field.choices.length) {
        const choices = field.choices
        return {
          name,
          decode: (reader) => {
            const present = reader.boolean()
            const index = reader.uBitVar()
            if (index) {
              const selected = choices[index - 1]
              if (!selected) throw new Error('Invalid polymorphic entity serializer.')
              polymorphic.set(name, selected)
            }
            return present
          },
        }
      }
      return { name, decode: field.value }
    }
    if (field.model === 'table') {
      current = polymorphic.get(names.join('.')) ?? field.child
      continue
    }
    if (field.model === 'tables') {
      names.push(String(path[position++]!))
      if (position === path.length) return { name: names.join('.'), decode: field.value }
      current = field.child
      continue
    }
    if (field.model === 'vector' || field.model === 'array') {
      names.push(String(path[position++]!))
      if (position !== path.length) throw new Error('Invalid nested entity array.')
      return {
        name: names.join('.'),
        decode: field.model === 'vector' ? field.element : field.value,
      }
    }
    throw new Error(`Invalid nested scalar entity field ${field.name}.`)
  }
  throw new Error('Empty entity field path.')
}
