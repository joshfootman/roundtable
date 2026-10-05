import { Container, Graphics } from 'pixi.js'
import { recordAtTick } from './frames'
import { visibleOnFloor, worldToMap, type MapDefinition, type MapFloor } from './maps'
import type { ReplayRound } from './types'

export interface BombAppearance {
  neutral: number
  armed: number
  defusing: number
}

const EXPLOSION_SECONDS = 0.85
const PULSE_SECONDS = 1.2

export function createBombRenderer(
  round: ReplayRound,
  map: MapDefinition,
  marker: Container,
  appearance: BombAppearance,
) {
  const container = new Container()
  const icon = new Container({ label: 'bomb-icon' })
  icon.addChild(marker)
  const halo = new Graphics().circle(0, 0, 13).stroke({ color: 0xffffff, width: 1.5 })
  halo.label = 'bomb-pulse'
  const explosion = new Container({ label: 'bomb-explosion' })
  const shockwave = new Graphics({ label: 'bomb-shockwave' })
    .circle(0, 0, 12)
    .stroke({ color: appearance.armed, pixelLine: true })
  const echo = new Graphics().circle(0, 0, 9).stroke({ color: appearance.armed, width: 1 })
  const core = new Graphics()
    .circle(0, 0, 12)
    .fill({ color: appearance.armed, alpha: 0.45 })
    .circle(0, 0, 4)
    .fill(0xffedcf)
  const sparks = Array.from({ length: 10 }, (_, index) => {
    const spark = new Graphics()
      .moveTo(0, 0)
      .lineTo(5 + (index % 3) * 2, 0)
      .stroke({ color: appearance.armed, width: 1.5 })
    spark.rotation = (index / 10) * Math.PI * 2 + 0.2
    return spark
  })
  explosion.addChild(shockwave, echo, core, ...sparks)
  container.addChild(halo, icon, explosion)
  const plantedTick = round.bomb.find(({ state }) => state.type === 'planted')?.tick ?? 0
  const plantedRecords = round.bomb.filter(({ state }) => state.type === 'planted').reverse()
  const detonations = round.bombEvents
    .filter((event) => event.type === 'exploded')
    .flatMap((event) => {
      const planted = plantedRecords.find((record) => record.tick <= event.tick)
      return planted?.state.type === 'planted'
        ? [{ tick: event.tick, position: planted.state }]
        : []
    })

  function draw(tick: number, symbolScale: number, floor: MapFloor, reducedMotion = false) {
    const bomb = recordAtTick(round.bomb, tick).state
    const detonation = detonations.find(
      ({ tick: start }) => tick >= start && (tick - start) * round.tickInterval < EXPLOSION_SECONDS,
    )
    const position =
      detonation?.position ??
      (!detonations.some(({ tick: start }) => tick >= start) &&
      (bomb.type === 'dropped' || bomb.type === 'planted')
        ? bomb
        : undefined)
    container.scale.set(symbolScale)
    container.visible = position !== undefined && visibleOnFloor(map, floor, position.z)
    icon.visible = !detonation && position !== undefined
    halo.visible = !detonation && bomb.type === 'planted'
    explosion.visible = detonation !== undefined
    if (!position) return
    const point = worldToMap(map, position.x, position.y)
    container.position.set(point.x, point.y)
    icon.scale.set(1)
    icon.alpha = 1
    marker.tint =
      bomb.type === 'planted'
        ? bomb.defuser.type === 'player'
          ? appearance.defusing
          : appearance.armed
        : appearance.neutral
    halo.tint = marker.tint
    if (bomb.type === 'planted') {
      const phase = (((tick - plantedTick) * round.tickInterval) / PULSE_SECONDS) % 1
      const pulse = Math.sin(phase * Math.PI) ** 2
      icon.scale.set(reducedMotion ? 1 : 1 + pulse * 0.08)
      icon.alpha = reducedMotion ? 1 : 1 - pulse * 0.2
      halo.scale.set(reducedMotion ? 1 : 1 + phase * 0.8)
      halo.alpha = reducedMotion ? 0.2 : 0.28 * (1 - phase) ** 2
    }
    if (detonation) {
      const progress = ((tick - detonation.tick) * round.tickInterval) / EXPLOSION_SECONDS
      const outward = 1 - (1 - progress) ** 3
      const delayed = Math.max(0, (progress - 0.12) / 0.88)
      shockwave.scale.set(reducedMotion ? 3.5 : 0.9 + outward * 5)
      shockwave.alpha = (1 - progress) ** 2
      echo.visible = !reducedMotion
      echo.scale.set(0.9 + (1 - (1 - delayed) ** 3) * 4.5)
      echo.alpha = progress < 0.12 ? 0 : 0.5 * (1 - delayed) ** 2
      core.visible = !reducedMotion
      core.scale.set(0.9 + outward * 2)
      core.alpha = Math.max(0, 1 - progress * 4) ** 2
      for (let index = 0; index < sparks.length; index++) {
        const spark = sparks[index]!
        const distance = 10 + outward * (25 + (index % 3) * 8)
        spark.visible = !reducedMotion
        spark.position.set(Math.cos(spark.rotation) * distance, Math.sin(spark.rotation) * distance)
        spark.alpha = Math.max(0, 1 - progress * 1.6) ** 2
      }
    }
  }

  return { container, draw }
}
