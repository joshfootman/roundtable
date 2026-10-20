import { Container, Graphics } from 'pixi.js'
import { visibleOnFloor, worldToMap, type MapDefinition, type MapFloor } from './maps'
import type { GrenadeDetonation, ReplayRound } from './types'
import { utilityAppearance } from './utility'

/** The scene's `--ease-out-expo`: the burst lands almost at once, then settles. */
function easeOutExpo(progress: number) {
  return progress >= 1 ? 1 : 1 - 2 ** (-10 * progress)
}

function fade(progress: number, speed = 1) {
  return Math.max(0, 1 - progress * speed) ** 2
}

interface Burst {
  container: Container
  draw(progress: number, reducedMotion: boolean): void
}

const BLOOM_LAYERS = [
  { radius: 22, alpha: 0.25 },
  { radius: 15, alpha: 0.35 },
  { radius: 10, alpha: 0.6 },
]
const SHARD_COUNT = 9

/** A flashbang is harmless light: a soft white bloom with no hard edges, like a camera flash. */
function flashBurst(): Burst {
  const bloom = new Container()
  for (const { radius, alpha } of BLOOM_LAYERS)
    bloom.addChild(new Graphics().circle(0, 0, radius).fill({ color: 0xfff6d8, alpha }))
  const core = new Graphics().circle(0, 0, 6).fill(0xffffff)
  const container = new Container({ label: 'flash-burst' })
  container.addChild(bloom, core)
  return {
    container,
    draw(progress, reducedMotion) {
      const outward = reducedMotion ? 1 : easeOutExpo(progress)
      bloom.scale.set(0.6 + outward * 1.8)
      bloom.alpha = fade(progress)
      core.scale.set(0.6 + outward * 0.6)
      core.alpha = fade(progress, 1.8)
    },
  }
}

function starburst(points: number, outer: number, inner: number, rotation: number) {
  return Array.from({ length: points * 2 }, (_, index) => {
    const radius = index % 2 ? inner : outer * (index % 4 ? 0.8 : 1)
    const angle = (index / (points * 2)) * Math.PI * 2 + rotation
    return [Math.cos(angle) * radius, Math.sin(angle) * radius]
  }).flat()
}

/** An HE grenade is lethal: a jagged fireball, a heavy shockwave, flying shards and a scorch cloud. */
function heBurst(): Burst {
  const color = utilityAppearance.he.color
  const scorch = new Graphics().circle(0, 0, 13).fill({ color: 0x3a3434, alpha: 0.55 })
  const shockwave = new Graphics().circle(0, 0, 10).stroke({ color, width: 2.5 })
  const fireball = new Graphics().poly(starburst(8, 13, 6, 0.2)).fill(0xef5a3c)
  const heat = new Graphics().poly(starburst(8, 7, 3.5, 0.6)).fill(0xffd27a)
  const shards = Array.from({ length: SHARD_COUNT }, (_, index) => {
    const shard = new Graphics().poly([4, 0, 0, -1.5, 0, 1.5]).fill(color)
    shard.rotation = (index / SHARD_COUNT) * Math.PI * 2 + 0.4
    return shard
  })
  const container = new Container({ label: 'he-burst' })
  container.addChild(scorch, shockwave, fireball, heat, ...shards)
  return {
    container,
    draw(progress, reducedMotion) {
      const outward = reducedMotion ? 1 : easeOutExpo(progress)
      scorch.scale.set(0.6 + outward * 0.8)
      scorch.alpha = Math.min(1, progress * 4) * fade(progress)
      shockwave.scale.set(0.8 + outward * 3.2)
      shockwave.alpha = fade(progress, 1.2)
      fireball.scale.set(0.7 + outward * 0.7)
      fireball.alpha = fade(progress, 1.8)
      heat.scale.set(0.7 + outward * 0.6)
      heat.alpha = fade(progress, 2.6)
      for (const [index, shard] of shards.entries()) {
        const distance = 8 + outward * (18 + (index % 3) * 7)
        shard.visible = !reducedMotion
        shard.position.set(Math.cos(shard.rotation) * distance, Math.sin(shard.rotation) * distance)
        shard.alpha = fade(progress, 1.5)
      }
    },
  }
}

const bursts = {
  flash: { seconds: 0.45, create: flashBurst },
  he: { seconds: 0.9, create: heBurst },
} satisfies Partial<Record<GrenadeDetonation['kind'], { seconds: number; create: () => Burst }>>

export function createDetonationRenderer(round: ReplayRound, map: MapDefinition) {
  const container = new Container({ label: 'detonations' })
  const events = round.detonations.flatMap((event) => {
    if (!(event.kind in bursts)) return []
    const { seconds, create } = bursts[event.kind as keyof typeof bursts]
    const burst = create()
    burst.container.visible = false
    container.addChild(burst.container)
    return [{ event, seconds, burst, point: worldToMap(map, event.x, event.y) }]
  })

  function draw(
    tick: number,
    symbolScale: number,
    visible: boolean,
    floor: MapFloor,
    reducedMotion = false,
  ) {
    for (const { event, seconds, burst, point } of events) {
      const progress = ((tick - event.tick) * round.tickInterval) / seconds
      burst.container.visible =
        visible && progress >= 0 && progress < 1 && visibleOnFloor(map, floor, event.z)
      if (!burst.container.visible) continue
      burst.container.position.set(point.x, point.y)
      burst.container.scale.set(symbolScale)
      burst.draw(progress, reducedMotion)
    }
  }

  return { container, draw }
}
