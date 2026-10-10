import type { PlayerCardData } from '#/replay/player-cards'
import type { ReplayWeapon } from '#/replay/types'

const gun = (definition: number, magazine: number, reserve: number): ReplayWeapon => ({
  type: 'gun',
  definition,
  magazine,
  reserve,
})
const knife: ReplayWeapon = { type: 'item', definition: 42 }
const none = { type: 'none' } as const

function player(
  fields: Pick<PlayerCardData, 'number' | 'name' | 'team' | 'kills' | 'deaths'> &
    Partial<Omit<PlayerCardData, 'inspection'>> & {
      inspection: Partial<PlayerCardData['inspection']>
    },
): PlayerCardData {
  return {
    steamId: `sample-${fields.number}`,
    alive: true,
    health: 100,
    otherWeapons: [],
    carriesBomb: false,
    flashSeconds: 0,
    ...fields,
    inspection: {
      tick: 0,
      money: 0,
      armour: 100,
      helmet: true,
      flash: { type: 'none' },
      grenades: [],
      weapon: none,
      weapons: [],
      ...fields.inspection,
    },
  }
}

/** Ten players covering the states a card has to show: buys, damage, flashes, the bomb, death. */
export const samplePlayers: PlayerCardData[] = [
  player({
    number: 1,
    name: 'apEX',
    team: 3,
    kills: 14,
    deaths: 11,
    otherWeapons: [gun(61, 12, 24), knife],
    inspection: {
      money: 2350,
      weapon: gun(60, 20, 80),
      grenades: [
        { definition: 45, count: 1 },
        { definition: 43, count: 2 },
      ],
    },
  }),
  player({
    number: 2,
    name: 'ZywOo',
    team: 3,
    kills: 22,
    deaths: 8,
    health: 72,
    flashSeconds: 1.8,
    otherWeapons: [gun(1, 7, 35), knife],
    inspection: {
      money: 450,
      weapon: gun(9, 4, 30),
      flash: { type: 'flashed', startTick: 0, durationSeconds: 2.6 },
      grenades: [{ definition: 44, count: 1 }],
    },
  }),
  player({
    number: 3,
    name: 'flameZ',
    team: 3,
    kills: 9,
    deaths: 14,
    alive: false,
    health: 0,
    inspection: { money: 3100, armour: 0, helmet: false },
  }),
  player({
    number: 4,
    name: 'mezii',
    team: 3,
    kills: 11,
    deaths: 12,
    health: 18,
    otherWeapons: [knife],
    inspection: { money: 1200, armour: 34, weapon: gun(1, 3, 21) },
  }),
  player({
    number: 5,
    name: 'ropz',
    team: 3,
    kills: 17,
    deaths: 10,
    otherWeapons: [gun(61, 12, 24), knife],
    inspection: {
      money: 5600,
      weapon: gun(8, 30, 90),
      grenades: [
        { definition: 45, count: 1 },
        { definition: 43, count: 2 },
        { definition: 48, count: 1 },
        { definition: 44, count: 1 },
      ],
    },
  }),
  player({
    number: 6,
    name: 'karrigan',
    team: 2,
    kills: 8,
    deaths: 15,
    carriesBomb: true,
    otherWeapons: [gun(4, 20, 120), knife],
    inspection: {
      money: 1650,
      weapon: gun(7, 30, 90),
      grenades: [
        { definition: 45, count: 1 },
        { definition: 46, count: 1 },
      ],
    },
  }),
  player({
    number: 7,
    name: 'frozen',
    team: 2,
    kills: 15,
    deaths: 12,
    health: 46,
    otherWeapons: [gun(4, 20, 120), knife],
    inspection: { money: 800, armour: 61, weapon: gun(13, 21, 70) },
  }),
  player({
    number: 8,
    name: 'rain',
    team: 2,
    kills: 12,
    deaths: 13,
    alive: false,
    health: 0,
    inspection: { money: 4200, armour: 0, helmet: false },
  }),
  player({
    number: 9,
    name: 'broky',
    team: 2,
    kills: 19,
    deaths: 11,
    flashSeconds: 0.6,
    otherWeapons: [knife],
    inspection: {
      money: 150,
      helmet: false,
      weapon: gun(30, 18, 90),
      flash: { type: 'flashed', startTick: 0, durationSeconds: 1.4 },
      grenades: [{ definition: 43, count: 1 }],
    },
  }),
  player({
    number: 10,
    name: 'Twistzz',
    team: 2,
    kills: 16,
    deaths: 14,
    health: 91,
    otherWeapons: [gun(4, 20, 120), knife],
    inspection: {
      money: 3250,
      weapon: gun(7, 12, 60),
      grenades: [
        { definition: 45, count: 1 },
        { definition: 43, count: 2 },
        { definition: 46, count: 1 },
      ],
    },
  }),
]
