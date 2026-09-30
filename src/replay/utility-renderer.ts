import { Container, Graphics } from 'pixi.js'
import { worldToMap, type MapDefinition } from './maps.ts'
import { sampleAtTick, recordAtTick } from './frames.ts'
import type { ReplayRound } from './types.ts'
import {
  utilityAppearance,
  utilityOverlays,
  DETONATION_DISPLAY_SECONDS,
  APPROXIMATE_SMOKE_RADIUS,
  APPROXIMATE_FIRE_CELL_RADIUS,
  SHOT_DISPLAY_SECONDS,
  SHOT_TRACE_LENGTH,
  type UtilityVisibility,
} from './utility.ts'

export function createUtilityRenderer(round: ReplayRound, map: MapDefinition) {
  const layers = {
    fires: new Graphics(),
    smokes: new Graphics(),
    shots: new Graphics(),
    trajectories: new Graphics(),
    detonations: new Graphics(),
  }
  const container = new Container()
  container.addChild(...Object.values(layers))
  return {
    container,
    draw(tick: number, symbolScale: number, visibility: UtilityVisibility) {
      for (const { key } of utilityOverlays)
        if (key !== 'flashes') layers[key].visible = visibility[key]
      for (const layer of Object.values(layers)) layer.clear()
      if (visibility.shots)
        for (const shot of round.shots) {
          if (tick < shot.tick || (tick - shot.tick) * round.tickInterval >= SHOT_DISPLAY_SECONDS)
            continue
          const point = worldToMap(map, shot.x, shot.y)
          const angle = (shot.yaw * Math.PI) / 180
          const length =
            SHOT_TRACE_LENGTH * symbolScale * map.scale * Math.cos((shot.pitch * Math.PI) / 180)
          const end = worldToMap(
            map,
            shot.x + Math.cos(angle) * length,
            shot.y + Math.sin(angle) * length,
          )
          layers.shots
            .moveTo(point.x, point.y)
            .lineTo(end.x, end.y)
            .stroke({ color: '#f5eccb', width: symbolScale, alpha: 0.8 })
        }
      if (visibility.fires)
        for (const fire of recordAtTick(round.fires, tick).fires) {
          for (let cell = 0; cell < fire.positions.length; cell += 3) {
            const point = worldToMap(map, fire.positions[cell]!, fire.positions[cell + 1]!)
            layers.fires
              .circle(point.x, point.y, APPROXIMATE_FIRE_CELL_RADIUS / map.scale)
              .fill({ color: utilityAppearance.fire.color, alpha: 0.25 })
          }
        }
      if (visibility.smokes)
        for (const smoke of round.smokes) {
          if (tick < smoke.startTick || tick >= smoke.endTick) continue
          const point = worldToMap(map, smoke.x, smoke.y)
          layers.smokes
            .circle(point.x, point.y, APPROXIMATE_SMOKE_RADIUS / map.scale)
            .fill({ color: utilityAppearance.smoke.color, alpha: 0.25 })
            .stroke({ color: utilityAppearance.smoke.color, alpha: 0.7, width: symbolScale })
        }
      if (visibility.trajectories)
        for (const projectile of round.projectiles) {
          if (tick < projectile.startTick || tick >= projectile.endTick) continue
          const last = sampleAtTick(projectile.ticks, tick)
          const appearance = utilityAppearance[projectile.kind]
          for (let index = 0; index <= last; index++) {
            const offset = index * 3
            const point = worldToMap(
              map,
              projectile.positions[offset]!,
              projectile.positions[offset + 1]!,
            )
            if (index === 0) layers.trajectories.moveTo(point.x, point.y)
            else layers.trajectories.lineTo(point.x, point.y)
          }
          layers.trajectories.stroke({
            color: appearance.color,
            width: 2 * symbolScale,
            alpha: 0.7,
          })
          const offset = last * 3
          const point = worldToMap(
            map,
            projectile.positions[offset]!,
            projectile.positions[offset + 1]!,
          )
          layers.trajectories.circle(point.x, point.y, 4 * symbolScale).fill(appearance.color)
        }
      if (visibility.detonations)
        for (const event of round.detonations) {
          if (
            tick < event.tick ||
            (tick - event.tick) * round.tickInterval >= DETONATION_DISPLAY_SECONDS
          )
            continue
          const point = worldToMap(map, event.x, event.y)
          layers.detonations
            .circle(point.x, point.y, 16 * symbolScale)
            .stroke({ color: utilityAppearance[event.kind].color, width: 2 * symbolScale })
        }
    },
  }
}
