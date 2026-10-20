import { Container, Graphics, Sprite, type Texture } from 'pixi.js'
import { visibleOnFloor, worldToMap, type MapDefinition, type MapFloor } from './maps.ts'
import { sampleAtTick, recordAtTick } from './frames.ts'
import type { GrenadeKind, ReplayProjectile, ReplayRound } from './types.ts'
import {
  utilityAppearance,
  APPROXIMATE_SMOKE_RADIUS,
  APPROXIMATE_FIRE_CELL_RADIUS,
  SHOT_DISPLAY_SECONDS,
  SHOT_TRACE_LENGTH,
  type UtilityVisibility,
} from './utility.ts'

const PROJECTILE_ICON_SIZE = 10
const AREA_ICON_SIZE = { cloud: 18, fire: 22, decoy: 12 }
/** CS2 decoys fire for about 15 seconds; the recording marks only when they start. */
const DECOY_LIVE_SECONDS = 15
const DECOY_WAVES = [
  { radius: 9, spread: 0.5 },
  { radius: 12, spread: 0.45 },
]
const OUTLINE_STEPS = 8
const SMOKE_OUTLINE_POINTS = 96
const SMOKE_SETTLE_TURN = 0.5
const SMOKE_BLOOM_SECONDS = 0.6
/** An HE punches a hole through smoke that refills within about three seconds. */
const SMOKE_HOLE_RADIUS = 120
const SMOKE_HOLE_OPEN_SECONDS = 0.2
const SMOKE_HOLE_HOLD_SECONDS = 1.5
const SMOKE_HOLE_SECONDS = 3
const SMOKE_HOLE_REACH_Z = 128

/** The scene's `--ease-out-expo`: most of the burst lands in the first third, then it settles. */
function easeInOutQuart(progress: number) {
  return progress < 0.5 ? 8 * progress ** 4 : 1 - (-2 * progress + 2) ** 4 / 2
}

/** How open an HE's hole in the smoke is, from 0 (filled) to 1, `seconds` after it blew. */
function smokeHoleOpening(seconds: number, reducedMotion: boolean) {
  if (seconds < 0 || seconds >= SMOKE_HOLE_SECONDS) return 0
  if (reducedMotion) return 1
  if (seconds < SMOKE_HOLE_OPEN_SECONDS) return easeOutExpo(seconds / SMOKE_HOLE_OPEN_SECONDS)
  if (seconds < SMOKE_HOLE_HOLD_SECONDS) return 1
  return (
    1 -
    easeInOutQuart(
      (seconds - SMOKE_HOLE_HOLD_SECONDS) / (SMOKE_HOLE_SECONDS - SMOKE_HOLE_HOLD_SECONDS),
    )
  )
}

function easeOutExpo(progress: number) {
  return progress >= 1 ? 1 : 1 - 2 ** (-10 * progress)
}

function seededRandom(seed: number) {
  let state = Math.imul(seed, 2654435761) >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), state | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A near-round cloud: faint uneven puffs over a slightly wobbling edge, so it never reads as a gear. */
function smokeShape(seed: number) {
  const random = seededRandom(seed)
  const count = 7 + Math.floor(random() * 3)
  let angle = random() * Math.PI * 2
  const puffs = Array.from({ length: count }, () => {
    angle += ((Math.PI * 2) / count) * (0.6 + random() * 0.8)
    return { angle, spread: (0.35 + random() * 0.35) / 2.4, height: 0.4 + random() * 0.6 }
  })
  const wobble = [random() * Math.PI * 2, random() * Math.PI * 2]
  return Array.from({ length: SMOKE_OUTLINE_POINTS }, (_, step) => {
    const theta = (step / SMOKE_OUTLINE_POINTS) * Math.PI * 2
    let bump = 0
    for (const puff of puffs) {
      const distance = Math.atan2(Math.sin(theta - puff.angle), Math.cos(theta - puff.angle))
      bump = Math.max(bump, puff.height * Math.exp(-(distance ** 2) / (2 * puff.spread ** 2)))
    }
    return (
      0.975 +
      0.012 * Math.sin(2 * theta + wobble[0]!) +
      0.008 * Math.sin(3 * theta + wobble[1]!) +
      0.02 * bump
    )
  })
}

const SMOKE_SHAPE = smokeShape(3)

function smokeOutline(x: number, y: number, radius: number, shape: number[], turn: number) {
  return shape.flatMap((reach, step) => {
    const theta = (step / shape.length) * Math.PI * 2 + turn
    return [x + Math.cos(theta) * radius * reach, y + Math.sin(theta) * radius * reach]
  })
}
const PROJECTILE_APEX_GROWTH = 0.8

/** How far each sample sits above the straight line from throw to landing, as a share of the apex. */
function arcLift(projectile: ReplayProjectile) {
  const { positions } = projectile
  const count = positions.length / 3
  const startZ = positions[2]!
  const endZ = positions[(count - 1) * 3 + 2]!
  const heights = Array.from({ length: count }, (_, index) =>
    Math.max(
      0,
      positions[index * 3 + 2]! - (startZ + ((endZ - startZ) * index) / Math.max(1, count - 1)),
    ),
  )
  const apex = Math.max(...heights)
  return heights.map((height) => (apex > 0 ? height / apex : 0))
}

export function createUtilityRenderer(
  round: ReplayRound,
  map: MapDefinition,
  icons: Readonly<Record<GrenadeKind | 'cloud' | 'fire', Texture>>,
  background: number,
) {
  const layers = {
    fires: new Graphics(),
    smokes: new Graphics(),
    shots: new Graphics(),
    trajectories: new Graphics(),
  }
  const container = new Container()
  const projectileIcons = new Container({ label: 'projectile-icons' })
  const areaIcons = new Container({ label: 'area-icons' })
  const smokeHoles = new Graphics({ label: 'smoke-holes' })
  const decoyWaves = new Graphics({ label: 'decoy-waves' })
  container.addChild(...Object.values(layers), projectileIcons, decoyWaves, areaIcons, smokeHoles)
  const decoys = round.detonations.filter((event) => event.kind === 'decoy')
  layers.smokes.setMask({ mask: smokeHoles, inverse: true })
  const smokeBlasts = round.detonations.filter(
    (event) =>
      event.kind === 'he' &&
      round.smokes.some(
        (smoke) =>
          event.tick >= smoke.startTick &&
          event.tick < smoke.endTick &&
          Math.abs(event.z - smoke.z) <= SMOKE_HOLE_REACH_Z &&
          Math.hypot(event.x - smoke.x, event.y - smoke.y) <=
            APPROXIMATE_SMOKE_RADIUS + SMOKE_HOLE_RADIUS,
      ),
  )
  const fireCentres = new Map<string, { x: number; y: number }>()
  {
    const sums = new Map<string, { x: number; y: number; cells: number }>()
    for (const { fires } of round.fires)
      for (const fire of fires) {
        const key = `${fire.entity}:${fire.serial}`
        const sum = sums.get(key) ?? { x: 0, y: 0, cells: 0 }
        for (let cell = 0; cell < fire.positions.length; cell += 3) {
          sum.x += fire.positions[cell]!
          sum.y += fire.positions[cell + 1]!
          sum.cells++
        }
        sums.set(key, sum)
      }
    for (const [key, { x, y, cells }] of sums)
      if (cells) fireCentres.set(key, worldToMap(map, x / cells, y / cells))
  }
  let areaIconCount = 0
  function placeAreaIcon(
    kind: keyof typeof AREA_ICON_SIZE,
    color: number,
    x: number,
    y: number,
    scale: number,
  ) {
    let badge = areaIcons.children[areaIconCount++] as Container | undefined
    if (!badge) {
      badge = areaIcons.addChild(new Container())
      for (let step = 0; step <= OUTLINE_STEPS; step++) {
        const sprite = badge.addChild(new Sprite())
        sprite.anchor.set(0.5)
        if (step === OUTLINE_STEPS) continue
        const angle = (step / OUTLINE_STEPS) * Math.PI * 2
        sprite.position.set(Math.cos(angle), Math.sin(angle))
      }
    }
    const sprites = badge.children as Sprite[]
    const texture = icons[kind]
    const fit = AREA_ICON_SIZE[kind] / Math.max(texture.width, texture.height)
    for (const [step, sprite] of sprites.entries()) {
      sprite.texture = texture
      sprite.tint = step === OUTLINE_STEPS ? color : background
      sprite.scale.set(fit)
    }
    badge.visible = true
    badge.position.set(x, y)
    badge.scale.set(scale)
  }
  const projectiles = round.projectiles.map((projectile) => {
    const sprite = new Sprite(icons[projectile.kind])
    sprite.anchor.set(0.5)
    sprite.visible = false
    projectileIcons.addChild(sprite)
    return { sprite, lift: arcLift(projectile) }
  })
  return {
    container,
    draw(
      tick: number,
      symbolScale: number,
      visibility: UtilityVisibility,
      floor: MapFloor,
      reducedMotion = false,
    ) {
      for (const key of Object.keys(layers) as (keyof typeof layers)[])
        layers[key].visible = visibility[key]
      for (const layer of Object.values(layers)) layer.clear()
      smokeHoles.clear()
      decoyWaves.clear()
      for (const blast of smokeBlasts) {
        const opening = smokeHoleOpening((tick - blast.tick) * round.tickInterval, reducedMotion)
        if (opening <= 0) continue
        const point = worldToMap(map, blast.x, blast.y)
        smokeHoles
          .circle(point.x, point.y, (SMOKE_HOLE_RADIUS / map.scale) * opening)
          .fill(0xffffff)
      }
      for (const sprite of areaIcons.children) sprite.visible = false
      areaIconCount = 0
      decoyWaves.visible = visibility.decoys
      if (visibility.decoys)
        for (const decoy of decoys) {
          const seconds = (tick - decoy.tick) * round.tickInterval
          if (seconds < 0 || seconds >= DECOY_LIVE_SECONDS || !visibleOnFloor(map, floor, decoy.z))
            continue
          const point = worldToMap(map, decoy.x, decoy.y)
          for (const side of [0, Math.PI])
            for (const { radius, spread } of DECOY_WAVES) {
              const r = radius * symbolScale
              decoyWaves
                .moveTo(
                  point.x + Math.cos(side - spread) * r,
                  point.y + Math.sin(side - spread) * r,
                )
                .arc(point.x, point.y, r, side - spread, side + spread)
            }
          decoyWaves.stroke({
            color: utilityAppearance.decoy.color,
            width: 1.25 * symbolScale,
            cap: 'round',
          })
          placeAreaIcon('decoy', utilityAppearance.decoy.color, point.x, point.y, symbolScale)
        }
      if (visibility.shots)
        for (const shot of round.shots) {
          if (
            !visibleOnFloor(map, floor, shot.z) ||
            tick < shot.tick ||
            (tick - shot.tick) * round.tickInterval >= SHOT_DISPLAY_SECONDS
          )
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
      if (visibility.fires && round.fires.length)
        for (const fire of recordAtTick(round.fires, tick).fires) {
          let visible = false
          for (let cell = 0; cell < fire.positions.length; cell += 3) {
            if (!visibleOnFloor(map, floor, fire.positions[cell + 2]!)) continue
            const point = worldToMap(map, fire.positions[cell]!, fire.positions[cell + 1]!)
            layers.fires
              .circle(point.x, point.y, APPROXIMATE_FIRE_CELL_RADIUS / map.scale)
              .fill({ color: utilityAppearance.fire.color, alpha: 0.25 })
            visible = true
          }
          const centre = fireCentres.get(`${fire.entity}:${fire.serial}`)
          if (visible && centre)
            placeAreaIcon('fire', utilityAppearance.fire.color, centre.x, centre.y, symbolScale)
        }
      if (visibility.smokes)
        for (const smoke of round.smokes) {
          if (
            !visibleOnFloor(map, floor, smoke.z) ||
            tick < smoke.startTick ||
            tick >= smoke.endTick
          )
            continue
          const point = worldToMap(map, smoke.x, smoke.y)
          const bloom = reducedMotion
            ? 1
            : easeOutExpo(((tick - smoke.startTick) * round.tickInterval) / SMOKE_BLOOM_SECONDS)
          layers.smokes
            .poly(
              smokeOutline(
                point.x,
                point.y,
                (APPROXIMATE_SMOKE_RADIUS / map.scale) * (0.3 + 0.7 * bloom),
                SMOKE_SHAPE,
                SMOKE_SETTLE_TURN * (1 - bloom),
              ),
            )
            .fill({ color: utilityAppearance.smoke.color, alpha: 0.35 * bloom })
            .stroke({
              color: utilityAppearance.smoke.color,
              alpha: 0.8 * bloom,
              width: symbolScale,
            })
          placeAreaIcon('cloud', utilityAppearance.smoke.color, point.x, point.y, symbolScale)
        }
      for (const { sprite } of projectiles) sprite.visible = false
      if (visibility.trajectories)
        for (const [index, projectile] of round.projectiles.entries()) {
          if (tick < projectile.startTick || tick >= projectile.endTick) continue
          const last = sampleAtTick(projectile.ticks, tick)
          let connected = false
          for (let index = 0; index <= last; index++) {
            const offset = index * 3
            if (!visibleOnFloor(map, floor, projectile.positions[offset + 2]!)) {
              connected = false
              continue
            }
            const point = worldToMap(
              map,
              projectile.positions[offset]!,
              projectile.positions[offset + 1]!,
            )
            if (!connected) layers.trajectories.moveTo(point.x, point.y)
            else layers.trajectories.lineTo(point.x, point.y)
            connected = true
          }
          layers.trajectories.stroke({
            color: 0x9a9a9a,
            width: symbolScale,
            alpha: 0.35,
          })
          const offset = last * 3
          const point = worldToMap(
            map,
            projectile.positions[offset]!,
            projectile.positions[offset + 1]!,
          )
          if (!visibleOnFloor(map, floor, projectile.positions[offset + 2]!)) continue
          const { sprite, lift } = projectiles[index]!
          const texture = sprite.texture
          sprite.visible = true
          sprite.position.set(point.x, point.y)
          sprite.scale.set(
            (PROJECTILE_ICON_SIZE / Math.max(texture.width, texture.height)) *
              (1 + PROJECTILE_APEX_GROWTH * lift[last]!) *
              symbolScale,
          )
        }
    },
  }
}
