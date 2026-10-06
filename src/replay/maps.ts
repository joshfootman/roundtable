import dust2 from '../assets/de_dust2_radar_psd.png'
import mirage from '../assets/de_mirage_radar_psd.png'
import ancient from '../assets/de_ancient_radar_psd.png'
import anubis from '../assets/de_anubis_radar_psd.png'
import inferno from '../assets/de_inferno_radar_psd.png'
import overpass from '../assets/de_overpass_radar_psd.png'
import nuke from '../assets/de_nuke_radar_psd.png'
import nukeLower from '../assets/de_nuke_lower_radar_psd.png'
import vertigo from '../assets/de_vertigo_radar_psd.png'
import vertigoLower from '../assets/de_vertigo_lower_radar_psd.png'
import cache from '../assets/de_cache_radar_psd.png'
import train from '../assets/de_train_radar_psd.png'
import trainLower from '../assets/de_train_lower_radar_psd.png'

export type MapFloor = 'upper' | 'lower'

export type MapDefinition = {
  name: string
  imageSize: number
  defaultZoom: number
  focusCenter: { x: number; y: number }
  origin: { x: number; y: number }
  scale: number
  rotation: 0 | 90 | 180 | 270
} & (
  | { floors: 'single'; image: string }
  | { floors: 'split'; images: Record<MapFloor, string>; boundaryZ: number; initialFloor: MapFloor }
)

const maps: Readonly<Record<string, MapDefinition>> = {
  de_dust2: {
    name: 'Dust II',
    focusCenter: { x: 0.49, y: 0.5 },
    floors: 'single',
    rotation: 0,
    image: dust2,
    imageSize: 1024,
    defaultZoom: 1,
    origin: { x: -2476, y: 3239 },
    scale: 4.4,
  },
  de_mirage: {
    name: 'Mirage',
    focusCenter: { x: 0.53, y: 0.51 },
    floors: 'single',
    rotation: 0,
    image: mirage,
    imageSize: 1024,
    defaultZoom: 1.25,
    origin: { x: -3230, y: 1713 },
    scale: 5,
  },
  de_ancient: {
    name: 'Ancient',
    focusCenter: { x: 0.49, y: 0.48 },
    floors: 'single',
    rotation: 0,
    image: ancient,
    imageSize: 1024,
    defaultZoom: 1.15,
    origin: { x: -2953, y: 2164 },
    scale: 5,
  },
  de_anubis: {
    name: 'Anubis',
    focusCenter: { x: 0.51, y: 0.49 },
    floors: 'single',
    rotation: 0,
    image: anubis,
    imageSize: 1024,
    defaultZoom: 1,
    origin: { x: -2796, y: 3328 },
    scale: 5.22,
  },
  de_inferno: {
    name: 'Inferno',
    focusCenter: { x: 0.52, y: 0.48 },
    floors: 'single',
    rotation: 270,
    image: inferno,
    imageSize: 1024,
    defaultZoom: 1.15,
    origin: { x: -2087, y: 3870 },
    scale: 4.9,
  },
  de_overpass: {
    name: 'Overpass',
    focusCenter: { x: 0.53, y: 0.51 },
    floors: 'single',
    rotation: 0,
    image: overpass,
    imageSize: 1024,
    defaultZoom: 1,
    origin: { x: -4831, y: 1781 },
    scale: 5.2,
  },
  de_nuke: {
    name: 'Nuke',
    focusCenter: { x: 0.54, y: 0.52 },
    floors: 'split',
    images: { upper: nuke, lower: nukeLower },
    imageSize: 1024,
    defaultZoom: 1.25,
    origin: { x: -3453, y: 2887 },
    scale: 7,
    rotation: 0,
    boundaryZ: -495,
    initialFloor: 'upper',
  },
  de_vertigo: {
    name: 'Vertigo',
    focusCenter: { x: 0.445, y: 0.505 },
    floors: 'split',
    images: { upper: vertigo, lower: vertigoLower },
    imageSize: 1024,
    defaultZoom: 1.25,
    origin: { x: -3168, y: 1762 },
    scale: 4,
    rotation: 0,
    boundaryZ: 11700,
    initialFloor: 'upper',
  },
  de_cache: {
    name: 'Cache',
    focusCenter: { x: 0.47, y: 0.52 },
    floors: 'single',
    image: cache,
    imageSize: 1024,
    defaultZoom: 1.25,
    origin: { x: -2000, y: 3250 },
    scale: 5.5,
    rotation: 0,
  },
  de_train: {
    name: 'Train',
    focusCenter: { x: 0.54, y: 0.51 },
    floors: 'split',
    images: { upper: train, lower: trainLower },
    imageSize: 1024,
    defaultZoom: 1,
    origin: { x: -2308, y: 2078 },
    scale: 4.082077,
    rotation: 0,
    boundaryZ: -50,
    initialFloor: 'lower',
  },
}

export function mapDefinition(identifier: string): MapDefinition | undefined {
  return Object.hasOwn(maps, identifier) ? maps[identifier] : undefined
}

export function worldToMap(map: MapDefinition, worldX: number, worldY: number) {
  const x = (worldX - map.origin.x) / map.scale
  const y = (map.origin.y - worldY) / map.scale
  switch (map.rotation) {
    case 90:
      return { x: map.imageSize - y, y: x }
    case 180:
      return { x: map.imageSize - x, y: map.imageSize - y }
    case 270:
      return { x: y, y: map.imageSize - x }
    default:
      return { x, y }
  }
}

export function mapFacing(map: MapDefinition, yaw: number): number {
  return ((map.rotation - yaw) * Math.PI) / 180
}

export function visibleOnFloor(map: MapDefinition, floor: MapFloor, z: number): boolean {
  return map.floors === 'single' || (floor === 'upper' ? z >= map.boundaryZ : z < map.boundaryZ)
}
