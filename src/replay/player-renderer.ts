import { Container, Graphics, Sprite, Text, TextStyle, type Texture } from 'pixi.js'
import { sampleAtTick } from './frames'
import { mapFacing, visibleOnFloor, worldToMap, type MapDefinition, type MapFloor } from './maps'
import { playerNumbers } from './player-numbers'
import { scenePlayers, type BombRole, type ScenePlayer } from './scene'
import type { ReplayRound } from './types'

export interface PlayerAppearance {
  ct: number
  t: number
  foreground: number
  background: number
  armed: number
  fontSize: number
}

export interface PlayerVisibility {
  floor: MapFloor
  flashes: boolean
  hiddenPlayers?: ReadonlySet<string>
  hiddenTeams?: ReadonlySet<number>
}

export interface MarkerTextures {
  bomb: Texture
  defuse: Texture
  flashed: Texture
}

/** Where a player stands relative to the floor being viewed. */
export type MarkerFloor = 'same' | 'above' | 'below'

export interface MarkerState {
  team: 2 | 3
  life: 'alive' | 'dead'
  floor: MarkerFloor
  /** Flash strength, 1 while fresh and fading to 0 as it wears off. */
  flash: number
  bomb: BombRole
  ladder: boolean
  /** Radians in map space. */
  facing: number
  number: number
  name: string
}

const FLASHED_ICON_SIZE = 12
const OUTLINE_STEPS = 8
/** The dead stay on the map as a faint cross where they fell. */
const DEATH_ALPHA = 0.4
const DEATH_CROSS = 5
/** A flash fades over its last seconds, so a short or ending flash reads weaker than a fresh full one. */
const FLASH_FADE_SECONDS = 1.5
const MARKER_OUTLINE_WIDTH = 1.5
const FACING_TIP_RADIUS = 16
export const MARKER_RADIUS = 8.5
export const NAME_TOP = MARKER_RADIUS + 4
export const NAME_SIZE = 9

export function markerFloor(map: MapDefinition, floor: MapFloor, z: number): MarkerFloor {
  if (visibleOnFloor(map, floor, z)) return 'same'
  return floor === 'lower' ? 'above' : 'below'
}

export function markerState(
  player: ScenePlayer,
  map: MapDefinition,
  floor: MapFloor,
  identity: { number: number; name: string },
): MarkerState {
  const alive = player.alive
  return {
    team: player.team === 3 ? 3 : 2,
    life: alive ? 'alive' : 'dead',
    floor: markerFloor(map, floor, player.z),
    flash: alive ? Math.min(1, Math.max(0, player.flashSeconds) / FLASH_FADE_SECONDS) : 0,
    bomb: alive ? player.bomb : 'none',
    ladder: alive && player.inspection.onLadder === true,
    facing: mapFacing(map, player.yaw),
    number: identity.number,
    name: identity.name,
  }
}

export function createMarker(appearance: PlayerAppearance, textures: MarkerTextures) {
  const directionRadius = MARKER_RADIUS + 2
  const directionHalfAngle = Math.atan(0.5)
  const directionX = directionRadius * Math.cos(directionHalfAngle)
  const directionY = directionRadius * Math.sin(directionHalfAngle)
  const container = new Container()
  const body = new Graphics().circle(0, 0, MARKER_RADIUS).fill(0xffffff)
  const direction = new Graphics()
    .moveTo(directionX, -directionY)
    .lineTo(FACING_TIP_RADIUS, 0)
    .lineTo(directionX, directionY)
    .arc(0, 0, directionRadius, directionHalfAngle, -directionHalfAngle, true)
    .closePath()
    .fill(0xffffff)
  const flash = new Container()
  flash.position.set(-25, 0)
  const flashFit = FLASHED_ICON_SIZE / Math.max(textures.flashed.width, textures.flashed.height)
  for (let step = 0; step <= OUTLINE_STEPS; step++) {
    const sprite = flash.addChild(new Sprite(textures.flashed))
    sprite.anchor.set(0.5)
    sprite.scale.set(flashFit)
    sprite.tint = step === OUTLINE_STEPS ? appearance.foreground : appearance.background
    if (step === OUTLINE_STEPS) continue
    const angle = (step / OUTLINE_STEPS) * Math.PI * 2
    sprite.position.set(Math.cos(angle), Math.sin(angle))
  }
  const label = new Text({
    text: '',
    style: new TextStyle({
      fontFamily: ['Geist Variable', 'sans-serif'],
      fontSize: appearance.fontSize,
      fontWeight: 'bold',
      fill: appearance.background,
    }),
  })
  label.anchor.set(0.5)
  const elevation = new Graphics()
    .moveTo(-4, -1)
    .lineTo(0, -4)
    .lineTo(4, -1)
    .moveTo(-4, 4)
    .lineTo(0, 1)
    .lineTo(4, 4)
    .stroke({ color: 0xffffff, width: 1.5 })
  elevation.position.set(0, -20)
  const objective = new Sprite(textures.bomb)
  objective.anchor.set(0.5)
  objective.position.set(12, -12)
  const ladder = new Graphics()
    .moveTo(-3, -5)
    .lineTo(-3, 5)
    .moveTo(3, -5)
    .lineTo(3, 5)
    .moveTo(-3, -3)
    .lineTo(3, -3)
    .moveTo(-3, 0)
    .lineTo(3, 0)
    .moveTo(-3, 3)
    .lineTo(3, 3)
    .stroke({ color: appearance.foreground, width: 1.5 })
  ladder.position.set(22, 0)
  const cross = new Graphics()
    .moveTo(-DEATH_CROSS, -DEATH_CROSS)
    .lineTo(DEATH_CROSS, DEATH_CROSS)
    .moveTo(DEATH_CROSS, -DEATH_CROSS)
    .lineTo(-DEATH_CROSS, DEATH_CROSS)
    .stroke({ color: 0xffffff, width: 2.5, cap: 'round' })
  const name = new Text({
    text: '',
    style: new TextStyle({
      fontFamily: ['Geist Variable', 'sans-serif'],
      fontSize: NAME_SIZE,
      fontWeight: '500',
      fill: appearance.foreground,
      stroke: { color: appearance.background, width: 1.5, join: 'round' },
    }),
  })
  name.anchor.set(0.5, 0)
  name.y = NAME_TOP
  container.addChild(body, direction, flash, label, elevation, objective, ladder, cross, name)
  for (const [layerName, layer] of Object.entries({
    body,
    direction,
    flash,
    label,
    elevation,
    objective,
    ladder,
    cross,
    name,
  }))
    layer.label = layerName
  let hollow = false

  function update(state: MarkerState, symbolScale: number) {
    const alive = state.life === 'alive'
    const otherFloor = state.floor !== 'same'
    const color = state.team === 3 ? appearance.ct : appearance.t
    if (otherFloor !== hollow) {
      body.clear().circle(0, 0, MARKER_RADIUS)
      if (otherFloor)
        body.fill(appearance.background).stroke({ color: 0xffffff, width: MARKER_OUTLINE_WIDTH })
      else body.fill(0xffffff)
      label.style.fill = otherFloor ? appearance.foreground : appearance.background
      hollow = otherFloor
    }
    body.visible = direction.visible = label.visible = name.visible = alive
    name.text = state.name
    body.tint = direction.tint = cross.tint = elevation.tint = color
    cross.visible = !alive
    direction.alpha = otherFloor ? 0.5 : 1
    direction.rotation = state.facing
    label.text = String(state.number)
    flash.visible = alive && state.flash > 0
    flash.alpha = state.flash
    ladder.visible = alive && state.ladder
    elevation.visible = alive && otherFloor
    elevation.scale.y = state.floor === 'above' ? 1 : -1
    const { bomb } = state
    objective.visible = alive && bomb !== 'none'
    objective.texture = bomb === 'defusing' ? textures.defuse : textures.bomb
    objective.tint =
      bomb === 'defusing'
        ? appearance.ct
        : bomb === 'planting'
          ? appearance.armed
          : appearance.foreground
    objective.width = objective.height = bomb === 'planting' || bomb === 'defusing' ? 12 : 10
    container.scale.set(symbolScale)
    container.alpha = alive ? (otherFloor ? 0.6 : 1) : otherFloor ? DEATH_ALPHA / 2 : DEATH_ALPHA
  }

  return { container, update }
}

export function createPlayerRenderer(
  round: ReplayRound,
  map: MapDefinition,
  appearance: PlayerAppearance,
  textures: MarkerTextures,
) {
  const container = new Container()
  container.sortableChildren = true
  const numbers = playerNumbers(round)
  // For each sample, the last sample at which each player was alive, so a body stays where it fell.
  const count = round.players.length
  const lastAlive = new Int32Array(round.ticks.length * count).fill(-1)
  for (let sample = 0; sample < round.ticks.length; sample++) {
    for (let index = 0; index < count; index++) {
      const at = sample * count + index
      lastAlive[at] = round.alive[at] === 1 ? sample : sample > 0 ? lastAlive[at - count]! : -1
    }
  }
  const markers = round.players.map(() => {
    const marker = createMarker(appearance, textures)
    container.addChild(marker.container)
    return marker
  })

  function draw(tick: number, symbolScale: number, visibility: PlayerVisibility) {
    const sample = sampleAtTick(round.ticks, tick)
    for (const player of scenePlayers(round, tick)) {
      const marker = markers[player.index]!
      const fell = player.alive ? -1 : lastAlive[sample * count + player.index]!
      const number = numbers.get(player.steamId)
      marker.container.visible =
        (player.alive || fell >= 0) &&
        player.present &&
        number !== undefined &&
        !visibility.hiddenPlayers?.has(player.steamId) &&
        !visibility.hiddenTeams?.has(player.team)
      if (!marker.container.visible) continue
      if (fell >= 0) {
        const at = (fell * count + player.index) * 3
        player.x = round.positions[at]!
        player.y = round.positions[at + 1]!
        player.z = round.positions[at + 2]!
      }
      const state = markerState(player, map, visibility.floor, {
        number: number!,
        name: round.players[player.index]!.name,
      })
      if (!visibility.flashes) state.flash = 0
      marker.update(state, symbolScale)
      const point = worldToMap(map, player.x, player.y)
      marker.container.position.set(point.x, point.y)
      // Preserve recorded player order within each layer, including after a backward seek.
      const layer = state.floor !== 'same' ? 0 : state.life === 'alive' ? 2 : 1
      marker.container.zIndex = layer * count + player.index
    }
  }

  return { container, draw }
}
