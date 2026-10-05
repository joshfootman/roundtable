import { expect, test } from 'vitest'
import { roundTeams } from './team-identity'

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
