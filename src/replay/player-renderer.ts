import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import { flashRemaining, recordAtTick, sampleAtTick } from './frames'
import { mapFacing, visibleOnFloor, worldToMap, type MapDefinition, type MapFloor } from './maps'
import { playerNumbers } from './player-numbers'
import type { ReplayRound } from './types'

export interface PlayerAppearance {
  ct: number
  t: number
  foreground: number
  background: number
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
) {
  const container = new Container()
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
      .circle(-13, -13, 5)
      .fill(appearance.foreground)
      .stroke({ color: appearance.background, width: 2 })
    const label = new Text({ text: String(numbers.get(player.steamId) ?? ''), style: labelStyle })
    label.anchor.set(0.5)
    marker.addChild(body, direction, flash, label)
    container.addChild(marker)
    return { container: marker, body, direction, flash }
  })

  function draw(tick: number, symbolScale: number, visibility: PlayerVisibility) {
    const sample = sampleAtTick(round.ticks, tick)
    for (let player = 0; player < markers.length; player++) {
      const state = sample * markers.length + player
      const position = state * 3
      const point = worldToMap(map, round.positions[position]!, round.positions[position + 1]!)
      const { container: marker, body, direction, flash } = markers[player]!
      const steamId = round.players[player]!.steamId
      const team = round.teams[state]!
      const color = team === 3 ? appearance.ct : appearance.t
      flash.visible =
        visibility.flashes &&
        flashRemaining(
          recordAtTick(round.inspection[player]!, tick).flash,
          tick,
          round.tickInterval,
        ) > 0
      marker.visible =
        numbers.has(steamId) &&
        visibleOnFloor(map, visibility.floor, round.positions[position + 2]!) &&
        !visibility.hiddenPlayers?.has(steamId) &&
        !visibility.hiddenTeams?.has(team)
      body.tint = color
      direction.tint = color
      direction.rotation = mapFacing(map, round.yaw[state]!)
      marker.position.set(point.x, point.y)
      marker.scale.set(symbolScale)
      marker.alpha = round.alive[state] ? 1 : 0.35
    }
  }

  return { container, draw }
}
