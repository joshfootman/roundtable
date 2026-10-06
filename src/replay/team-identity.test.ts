import { expect, test } from 'vitest'
import { halftimeBefore, roundTeams } from './team-identity'

function halftimeRound(
  number: number,
  teams: number[],
  teamNames?: { ct: string; t: string },
): Parameters<typeof halftimeBefore>[1] {
  return {
    number,
    overtime: 0,
    teamNames,
    liveStartTick: 110,
    ticks: new Uint32Array([100, 110]),
    players: teams.map((_, index) => ({ steamId: `${index}`, name: `Player ${index}` })),
    teams: new Uint8Array([...teams.map(() => 1), ...teams]),
  }
}

test('marks a recorded regulation team swap without assuming a fixed halftime round', () => {
  const first = halftimeRound(15, [], { ct: ' Local A ', t: 'Local B' })
  const second = halftimeRound(16, [], { ct: 'Local B', t: 'local a' })
  expect(halftimeBefore(first, second)).toBe(true)
  expect(halftimeBefore(undefined, second)).toBe(false)
  expect(halftimeBefore(first, { ...second, number: 17 })).toBe(false)
  expect(halftimeBefore({ ...first, overtime: 1 }, second)).toBe(false)
  expect(halftimeBefore(first, { ...second, overtime: 1 })).toBe(false)
})

test('does not mark unchanged sides or a clan rename as halftime', () => {
  const first = halftimeRound(12, [3, 2], { ct: 'Local A', t: 'Local B' })
  expect(halftimeBefore(first, { ...first, number: 13 })).toBe(false)
  expect(halftimeBefore(first, halftimeRound(13, [2, 3], { ct: 'New A', t: 'New B' }))).toBe(false)
  expect(
    halftimeBefore(
      halftimeRound(12, [], { ct: 'Same', t: 'Same' }),
      halftimeRound(13, [], { ct: 'Same', t: 'Same' }),
    ),
  ).toBe(false)
})

test('uses matching players at live start when local demos have no clan names', () => {
  const first = halftimeRound(12, [3, 3, 2, 2])
  const second = halftimeRound(13, [2, 2, 3, 3])
  second.players.reverse()
  second.teams = new Uint8Array([1, 1, 1, 1, 3, 3, 2, 2])
  expect(halftimeBefore(first, second)).toBe(true)
  expect(halftimeBefore(first, halftimeRound(13, [3, 3, 2, 2]))).toBe(false)
  expect(halftimeBefore(first, halftimeRound(13, [2, 3, 3, 3]))).toBe(false)
  expect(halftimeBefore(first, halftimeRound(13, [2, 2]))).toBe(false)
  expect(halftimeBefore(first, halftimeRound(13, [1, 1, 1, 1]))).toBe(false)
})

test('keeps recorded names and assigns curated logos to the current sides after halftime', () => {
  const first = roundTeams(
    { teamNames: { ct: 'Vitality', t: 'FaZe Clan' } },
    'faze-vs-vitality-m2-dust2',
  )
  expect(first).toEqual({
    ct: { name: 'Vitality', logo: '/images/teams/vitality.svg' },
    t: { name: 'FaZe Clan', logo: '/images/teams/faze.svg' },
  })
  const swapped = roundTeams(
    { teamNames: { ct: 'FaZe Clan', t: 'Vitality' } },
    'faze-vs-vitality-m2-dust2',
  )
  expect(swapped.ct).toEqual(first.t)
  expect(swapped.t).toEqual(first.ct)
})

test('uses CT/T without logos for missing names and keeps local or unfamiliar clans unbranded', () => {
  expect(roundTeams({})).toEqual({ ct: { name: 'CT' }, t: { name: 'T' } })
  expect(
    roundTeams({ teamNames: { ct: ' ', t: 'Local clan' } }, 'faze-vs-vitality-m2-dust2'),
  ).toEqual({ ct: { name: 'CT' }, t: { name: 'Local clan' } })
  expect(roundTeams({ teamNames: { ct: 'Vitality', t: 'FaZe Clan' } }).ct).toEqual({
    name: 'Vitality',
  })
})
