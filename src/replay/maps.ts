import dust2 from '../assets/de_dust2_radar_psd.png'
import mirage from '../assets/de_mirage_radar_psd.png'
import ancient from '../assets/de_ancient_radar_psd.png'
import anubis from '../assets/de_anubis_radar_psd.png'
import inferno from '../assets/de_inferno_radar_psd.png'
import overpass from '../assets/de_overpass_radar_psd.png'

export interface MapDefinition {
  name: string
  image: string
  imageSize: number
  origin: { x: number; y: number }
  scale: number
}

const maps: Readonly<Record<string, MapDefinition>> = {
  de_dust2: {
    name: 'Dust II',
    image: dust2,
    imageSize: 1024,
    origin: { x: -2476, y: 3239 },
    scale: 4.4,
  },
  de_mirage: {
    name: 'Mirage',
    image: mirage,
    imageSize: 1024,
    origin: { x: -3230, y: 1713 },
    scale: 5,
  },
  de_ancient: {
    name: 'Ancient',
    image: ancient,
    imageSize: 1024,
    origin: { x: -2953, y: 2164 },
    scale: 5,
  },
  de_anubis: {
    name: 'Anubis',
    image: anubis,
    imageSize: 1024,
    origin: { x: -2796, y: 3328 },
    scale: 5.22,
  },
  de_inferno: {
    name: 'Inferno',
    image: inferno,
    imageSize: 1024,
    origin: { x: -2087, y: 3870 },
    scale: 4.9,
  },
  de_overpass: {
    name: 'Overpass',
    image: overpass,
    imageSize: 1024,
    origin: { x: -4831, y: 1781 },
    scale: 5.2,
  },
}

export function mapDefinition(identifier: string): MapDefinition | undefined {
  return maps[identifier]
}

export function worldToMap(map: MapDefinition, x: number, y: number) {
  return { x: (x - map.origin.x) / map.scale, y: (map.origin.y - y) / map.scale }
}
