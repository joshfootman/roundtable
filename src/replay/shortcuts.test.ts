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

it('maps playback, round and map shortcuts', () => {
  expect(key('k')).toEqual({ action: 'toggle' })
  expect(key(' ')).toEqual({ action: 'toggle' })
  expect(key('j')).toEqual({ action: 'seek', seconds: -10 })
  expect(key('l')).toEqual({ action: 'seek', seconds: 10 })
  expect(key('ArrowLeft')).toEqual({ action: 'round', direction: -1 })
  expect(key('ArrowRight')).toEqual({ action: 'round', direction: 1 })
  expect(key('f')).toEqual({ action: 'floor' })
  expect(key('r')).toEqual({ action: 'focus' })
  expect(key('+', { shiftKey: true })).toEqual({ action: 'zoom', direction: 1 })
  expect(key('=')).toEqual({ action: 'zoom', direction: 1 })
  expect(key('-')).toEqual({ action: 'zoom', direction: -1 })
  expect(key('?', { shiftKey: true })).toEqual({ action: 'help' })
})

it('jumps to ten evenly spaced round positions', () => {
  for (let digit = 0; digit < 10; digit++)
    expect(key(String(digit))).toEqual({ action: 'section', fraction: digit / 10 })
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
    for (const value of ['k', ' ', 'j', 'l', 'ArrowRight', 'f', 'r', '+', '-', '9', '?'])
      expect(key(value, { [modifier]: true })).toBeUndefined()
  }
  expect(key('ArrowRight', { shiftKey: true })).toEqual({ action: 'pan', delta: { x: -48, y: 0 } })
  for (const value of ['k', ' ', 'f', 'r', 'ArrowRight', '?'])
    expect(key(value, { repeat: true })).toBeUndefined()
  expect(key('j', { repeat: true })).toEqual({ action: 'seek', seconds: -10 })
})
