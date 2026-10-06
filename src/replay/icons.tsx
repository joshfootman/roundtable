import { equipmentName, firearms } from './equipment.ts'

const equipmentKeys: Record<number, string> = {
  1: 'deagle',
  2: 'elite',
  3: 'fiveseven',
  4: 'glock',
  7: 'ak47',
  8: 'aug',
  9: 'awp',
  10: 'famas',
  11: 'g3sg1',
  13: 'galilar',
  14: 'm249',
  16: 'm4a1',
  17: 'mac10',
  19: 'p90',
  23: 'mp5sd',
  24: 'ump45',
  25: 'xm1014',
  26: 'bizon',
  27: 'mag7',
  28: 'negev',
  29: 'sawedoff',
  30: 'tec9',
  31: 'taser',
  32: 'hkp2000',
  33: 'mp7',
  34: 'mp9',
  35: 'nova',
  36: 'p250',
  38: 'scar20',
  39: 'sg556',
  40: 'ssg08',
  60: 'm4a1_silencer',
  61: 'usp_silencer',
  63: 'cz75a',
  64: 'revolver',
  43: 'flashbang',
  44: 'hegrenade',
  45: 'smokegrenade',
  46: 'molotov',
  47: 'decoy',
  48: 'incgrenade',
  49: 'c4',
  42: 'knife',
  41: 'knife',
  59: 'knife',
  500: 'knife',
  503: 'knife',
  505: 'knife',
  506: 'knife',
  507: 'knife',
  508: 'knife',
  509: 'knife',
  512: 'knife',
  514: 'knife',
  515: 'knife',
  516: 'knife',
  517: 'knife',
  518: 'knife',
  519: 'knife',
  520: 'knife',
  521: 'knife',
  522: 'knife',
  523: 'knife',
  525: 'knife',
  526: 'knife',
}

const assets = import.meta.glob<string>('../assets/cs2/equipment/*.svg', {
  eager: true,
  query: '?url&no-inline',
  import: 'default',
})

export function equipmentIcon(key: string): string | undefined {
  if (key === 'world' || key === 'worldent' || key === 'trigger_hurt') return undefined
  return assets[`../assets/cs2/equipment/${key}.svg`]
}

export function equipmentIconForDefinition(definition: number): string | undefined {
  const key = equipmentKeys[definition]
  return key ? equipmentIcon(key) : undefined
}

export function recordedWeaponName(key: string): string {
  if (key === 'planted_c4') return 'C4'
  const entry = Object.entries(equipmentKeys).find(([, value]) => value === key)
  return entry ? equipmentName(Number(entry[0])) : key
}

export function EquipmentIcon({ definition }: { definition: number }) {
  return <GameIcon src={equipmentIconForDefinition(definition)} wide={definition in firearms} />
}

export function GameIcon({ src, wide = false }: { src: string | undefined; wide?: boolean }) {
  return src ? (
    <img
      src={src}
      alt=""
      className={`mr-1 inline-block h-4 object-contain align-middle ${wide ? 'w-10' : 'w-4'}`}
    />
  ) : null
}
