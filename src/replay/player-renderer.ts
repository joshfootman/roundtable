import { Container, Graphics, Sprite, Text, TextStyle, type Texture } from 'pixi.js'
import { flashRemaining, recordAtTick, sampleAtTick } from './frames'
import { mapFacing, visibleOnFloor, worldToMap, type MapDefinition, type MapFloor } from './maps'
import { playerNumbers } from './player-numbers'
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

export function createPlayerRenderer(
  round: ReplayRound,
  map: MapDefinition,
  appearance: PlayerAppearance,
  textures: { bomb: Texture; defuse: Texture },
) {
  const container = new Container()
  container.sortableChildren = true
  const numbers = playerNumbers(round)
  const radius = 8.5
  const directionRadius = radius + 2
  const directionHalfAngle = Math.atan(0.5)
  const directionX = directionRadius * Math.cos(directionHalfAngle)
  const directionY = directionRadius * Math.sin(directionHalfAngle)
  const labelStyle = new TextStyle({
    fontFamily: ['Geist Variable', 'sans-serif'],
    fontSize: appearance.fontSize,
    fontWeight: 'bold',
    fill: appearance.background,
  })
  const markers = round.players.map((player) => {
    const marker = new Container()
    const body = new Graphics().circle(0, 0, radius).fill(0xffffff)
    const direction = new Graphics()
      .moveTo(directionX, -directionY)
      .lineTo(16, 0)
      .lineTo(directionX, directionY)
      .arc(0, 0, directionRadius, directionHalfAngle, -directionHalfAngle, true)
      .closePath()
      .fill(0xffffff)
    const flash = new Graphics()
      .circle(-12, 12, 4)
      .fill(appearance.foreground)
      .stroke({ color: appearance.background, width: 2 })
    const label = new Text({
      text: String(numbers.get(player.steamId) ?? ''),
      style: labelStyle.clone(),
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
    objective.tint = appearance.foreground
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
    ladder.position.set(12, 12)
    marker.addChild(body, direction, flash, label, elevation, objective, ladder)
    container.addChild(marker)
    return {
      container: marker,
      body,
      direction,
      flash,
      label,
      elevation,
      objective,
      ladder,
      otherFloor: false,
    }
  })

  function draw(tick: number, symbolScale: number, visibility: PlayerVisibility) {
    const sample = sampleAtTick(round.ticks, tick)
    const bomb = recordAtTick(round.bomb, tick)?.state
    for (let player = 0; player < markers.length; player++) {
      const state = sample * markers.length + player
      const position = state * 3
      const point = worldToMap(map, round.positions[position]!, round.positions[position + 1]!)
      const rendered = markers[player]!
      const {
        container: marker,
        body,
        direction,
        flash,
        label,
        elevation,
        objective,
        ladder,
      } = rendered
      const steamId = round.players[player]!.steamId
      const team = round.teams[state]!
      const color = team === 3 ? appearance.ct : appearance.t
      const alive = Boolean(round.alive[state])
      const inspection = recordAtTick(round.inspection[player]!, tick)
      ladder.visible = alive && inspection.onLadder === true
      const otherFloor = !visibleOnFloor(map, visibility.floor, round.positions[position + 2]!)
      if (otherFloor !== rendered.otherFloor) {
        body.clear().circle(0, 0, radius)
        if (otherFloor) body.fill(appearance.background).stroke({ color: 0xffffff, width: 1.5 })
        else body.fill(0xffffff)
        rendered.otherFloor = otherFloor
      }
      flash.visible =
        alive &&
        visibility.flashes &&
        flashRemaining(inspection.flash, tick, round.tickInterval) > 0
      marker.visible =
        numbers.has(steamId) &&
        !visibility.hiddenPlayers?.has(steamId) &&
        !visibility.hiddenTeams?.has(team)
      body.tint = color
      direction.tint = color
      direction.alpha = otherFloor ? 0.5 : 1
      label.style.fill = otherFloor ? appearance.foreground : appearance.background
      elevation.visible = otherFloor
      elevation.tint = color
      elevation.scale.y = visibility.floor === 'lower' ? 1 : -1
      const carrying = bomb?.type === 'carried' && bomb.carrier === steamId
      const planting = carrying && bomb.planting
      const defusing =
        bomb?.type === 'planted' &&
        bomb.defuser.type === 'player' &&
        bomb.defuser.steamId === steamId
      objective.visible = alive && (carrying || defusing)
      objective.texture = defusing ? textures.defuse : textures.bomb
      objective.tint = defusing
        ? appearance.ct
        : planting
          ? appearance.armed
          : appearance.foreground
      objective.width = objective.height = planting || defusing ? 12 : 10
      direction.rotation = mapFacing(map, round.yaw[state]!)
      marker.position.set(point.x, point.y)
      marker.scale.set(symbolScale)
      marker.alpha = alive ? (otherFloor ? 0.6 : 1) : 0.35
      // Preserve recorded player order within each layer, including after a backward seek.
      marker.zIndex = (otherFloor ? 0 : alive ? 2 : 1) * round.players.length + player
    }
  }

  return { container, draw }
}
