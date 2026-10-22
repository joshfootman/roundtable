import { expect, test } from 'vitest'
import { winCallout } from './round-callout'

test('names the winning team, falling back to its side', () => {
  expect(winCallout({ winner: 't', reason: 9, teamName: ' FaZe ' })).toEqual({
    kind: 'win',
    side: 't',
    team: 'FaZe',
  })
  expect(winCallout({ winner: 'ct', reason: 8 })).toEqual({ kind: 'win', side: 'ct', team: 'CT' })
})
