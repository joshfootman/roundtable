import { expect, test } from 'vitest'
import { BitReader } from './bit-reader.ts'
import { resolveField, type Serializer } from './serializers.ts'

const unsigned = (reader: BitReader) => reader.varUint()
const signed = (reader: BitReader) => reader.varInt()
const present = (reader: BitReader) => reader.boolean()

function polymorphicSerializer(): Serializer {
  const original: Serializer = {
    name: 'Original',
    fields: [{ name: 'value', model: 'scalar', value: unsigned }],
  }
  const selected: Serializer = {
    name: 'Selected',
    fields: [{ name: 'value', model: 'scalar', value: signed }],
  }
  return {
    name: 'Root',
    fields: [
      {
        name: 'component',
        model: 'table',
        value: present,
        child: original,
        choices: [original, selected],
      },
    ],
  }
}

test('distinguishes array, vector, and table-list indices on repeated reads', () => {
  const child: Serializer = {
    name: 'Child',
    fields: [{ name: 'value', model: 'scalar', value: signed }],
  }
  const serializer: Serializer = {
    name: 'Root',
    fields: [
      { name: 'array', model: 'array', value: unsigned },
      { name: 'vector', model: 'vector', value: unsigned, element: signed },
      { name: 'entries', model: 'tables', value: unsigned, child, choices: [] },
    ],
  }
  const selections = new Map<string, Serializer>()
  for (let repetition = 0; repetition < 2; repetition++) {
    const results = [
      resolveField(serializer, [0, 2], selections),
      resolveField(serializer, [0, 3], selections),
      resolveField(serializer, [1], selections),
      resolveField(serializer, [1, 2], selections),
      resolveField(serializer, [2, 3], selections),
      resolveField(serializer, [2, 3, 0], selections),
    ].map((field) => ({
      name: field.name,
      value: field.decode(new BitReader(Uint8Array.of(7))),
    }))
    expect(results).toEqual([
      { name: 'array.2', value: 7 },
      { name: 'array.3', value: 7 },
      { name: 'vector', value: 7 },
      { name: 'vector.2', value: -4 },
      { name: 'entries.3', value: 7 },
      { name: 'entries.3.value', value: -4 },
    ])
  }
})

test('keeps terminal polymorphic selectors isolated between entities', () => {
  const serializer = polymorphicSerializer()
  const first = new Map<string, Serializer>()
  const second = new Map<string, Serializer>()
  const firstSelector = resolveField(serializer, [0], first)
  const secondSelector = resolveField(serializer, [0], second)
  expect(firstSelector.decode(new BitReader(Uint8Array.of(3)))).toBe(true)
  expect(secondSelector.decode(new BitReader(Uint8Array.of(5)))).toBe(true)
  const firstValue = resolveField(serializer, [0, 0], first)
  const secondValue = resolveField(serializer, [0, 0], second)
  expect(firstValue.name).toBe('component.value')
  expect(firstValue.decode(new BitReader(Uint8Array.of(7)))).toBe(7)
  expect(secondValue.name).toBe('component.value')
  expect(secondValue.decode(new BitReader(Uint8Array.of(7)))).toBe(-4)
})

test('resolves the current polymorphic choice and retains it when the choice index is zero', () => {
  const serializer = polymorphicSerializer()
  const selections = new Map<string, Serializer>()
  const initial = resolveField(serializer, [0, 0], selections)
  expect(initial.decode(new BitReader(Uint8Array.of(7)))).toBe(7)
  const selector = resolveField(serializer, [0], selections)
  expect(selector.decode(new BitReader(Uint8Array.of(5)))).toBe(true)
  const selected = resolveField(serializer, [0, 0], selections)
  expect(selected.decode(new BitReader(Uint8Array.of(7)))).toBe(-4)
  expect(selector.decode(new BitReader(Uint8Array.of(1)))).toBe(true)
  const retained = resolveField(serializer, [0, 0], selections)
  expect(retained.decode(new BitReader(Uint8Array.of(9)))).toBe(-5)
  expect(selector.decode(new BitReader(Uint8Array.of(3)))).toBe(true)
  const restored = resolveField(serializer, [0, 0], selections)
  expect(restored.decode(new BitReader(Uint8Array.of(9)))).toBe(9)
})

test('keeps different serializer objects independent even when their names match', () => {
  const first: Serializer = {
    name: 'SameName',
    fields: [{ name: 'first', model: 'scalar', value: unsigned }],
  }
  const second: Serializer = {
    name: 'SameName',
    fields: [{ name: 'second', model: 'scalar', value: signed }],
  }
  const selections = new Map<string, Serializer>()
  const results = [first, second, first].map((serializer) => {
    const field = resolveField(serializer, [0], selections)
    return { name: field.name, value: field.decode(new BitReader(Uint8Array.of(7))) }
  })
  expect(results).toEqual([
    { name: 'first', value: 7 },
    { name: 'second', value: -4 },
    { name: 'first', value: 7 },
  ])
})

test('uses the current components when the caller reuses and mutates a path array', () => {
  const serializer: Serializer = {
    name: 'Root',
    fields: [{ name: 'values', model: 'array', value: unsigned }],
  }
  const selections = new Map<string, Serializer>()
  const path = [0, 2]
  const first = resolveField(serializer, path, selections)
  path[1] = 5
  const second = resolveField(serializer, path, selections)
  path[1] = 2
  const repeated = resolveField(serializer, path, selections)
  expect(
    [first, second, repeated].map((field) => ({
      name: field.name,
      value: field.decode(new BitReader(Uint8Array.of(11))),
    })),
  ).toEqual([
    { name: 'values.2', value: 11 },
    { name: 'values.5', value: 11 },
    { name: 'values.2', value: 11 },
  ])
})

test('preserves invalid-path and invalid polymorphic-choice errors', () => {
  const serializer = polymorphicSerializer()
  const selections = new Map<string, Serializer>()
  expect(() => resolveField(serializer, [], selections)).toThrow('Empty entity field path.')
  expect(() => resolveField(serializer, [0, 1], selections)).toThrow(
    'Invalid entity field path 0,1 at 1 in Original (1 fields).',
  )
  const selector = resolveField(serializer, [0], selections)
  expect(() => selector.decode(new BitReader(Uint8Array.of(7)))).toThrow(
    'Invalid polymorphic entity serializer.',
  )
  expect(selector.decode(new BitReader(Uint8Array.of(5)))).toBe(true)
  expect(() => resolveField(serializer, [0, 1], selections)).toThrow(
    'Invalid entity field path 0,1 at 1 in Selected (1 fields).',
  )
})
