export const firearms = {
  1: 'Desert Eagle',
  2: 'Dual Berettas',
  3: 'Five-SeveN',
  4: 'Glock-18',
  7: 'AK-47',
  8: 'AUG',
  9: 'AWP',
  10: 'FAMAS',
  11: 'G3SG1',
  13: 'Galil AR',
  14: 'M249',
  16: 'M4A4',
  17: 'MAC-10',
  19: 'P90',
  23: 'MP5-SD',
  24: 'UMP-45',
  25: 'XM1014',
  26: 'PP-Bizon',
  27: 'MAG-7',
  28: 'Negev',
  29: 'Sawed-Off',
  30: 'Tec-9',
  31: 'Zeus x27',
  32: 'P2000',
  33: 'MP7',
  34: 'MP9',
  35: 'Nova',
  36: 'P250',
  38: 'SCAR-20',
  39: 'SG 553',
  40: 'SSG 08',
  60: 'M4A1-S',
  61: 'USP-S',
  63: 'CZ75-Auto',
  64: 'R8 Revolver',
} as const
const items: Record<number, string> = {
  43: 'Flashbang',
  44: 'HE Grenade',
  45: 'Smoke Grenade',
  46: 'Molotov',
  47: 'Decoy Grenade',
  48: 'Incendiary Grenade',
  49: 'C4',
}

const knives = new Set([
  41, 42, 59, 500, 503, 505, 506, 507, 508, 509, 512, 514, 515, 516, 517, 518, 519, 520, 521, 522,
  523, 525, 526,
])

export function equipmentName(id: number): string {
  if (id in firearms) return firearms[id as keyof typeof firearms]
  if (knives.has(id)) return 'Knife'
  const name = items[id]
  if (!name) throw new Error(`Unsupported recorded equipment ${id}.`)
  return name
}
