import { expect, it } from 'vitest'
import { replayShortcut } from './shortcuts'

const key = (value: string, overrides = {}) =>
  replayShortcut({
    key: value,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    repeat: false,
    ...overrides,
  })

it('pans with held Shift and arrow keys', () => {
  for (const [direction, delta] of [
    ['ArrowLeft', { x: 48, y: 0 }],
    ['ArrowRight', { x: -48, y: 0 }],
    ['ArrowUp', { x: 0, y: 48 }],
    ['ArrowDown', { x: 0, y: -48 }],
  ] as const)
    expect(key(direction, { shiftKey: true, repeat: true })).toEqual({ action: 'pan', delta })
})

it('leaves browser modifiers and held toggles alone', () => {
  for (const modifier of ['altKey', 'ctrlKey', 'metaKey']) {
    for (const value of ['k', 'j', 'ArrowRight', '?'])
      expect(key(value, { [modifier]: true })).toBeUndefined()
  }
  for (const value of ['k', ' ', 'f', 'r', 'ArrowRight', '?'])
    expect(key(value, { repeat: true })).toBeUndefined()
  expect(key('j', { repeat: true })).toEqual({ action: 'seek', seconds: -10 })
  expect(key('d')).toEqual({ action: 'drawing-toggle' })
  expect(key('D', { shiftKey: true })).toEqual({ action: 'drawing-clear' })
  expect(key('d', { repeat: true })).toBeUndefined()
  expect(key('D', { shiftKey: true, repeat: true })).toBeUndefined()
  for (const modifier of ['altKey', 'ctrlKey', 'metaKey'])
    for (const value of ['d', 'D'])
      expect(key(value, { [modifier]: true, shiftKey: value === 'D' })).toBeUndefined()
})
