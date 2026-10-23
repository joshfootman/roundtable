import { Container, Graphics, type Texture } from 'pixi.js'
import { createIconBadge, paintIconBadge } from './icon-badge'
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
/** The badge holds still and solid, fading only over the last quarter so the icon stays legible. */
function badgeAlpha(progress: number, reducedMotion: boolean) {
  return reducedMotion ? 1 : Math.min(1, (1 - progress) * 4)
}

/** A flashbang is harmless light: a soft white bloom with no hard edges, like a camera flash. */
function flashBurst(badge: Container): Burst {
  const bloom = new Container()
  for (const { radius, alpha } of BLOOM_LAYERS)
    bloom.addChild(new Graphics().circle(0, 0, radius).fill({ color: 0xfff6d8, alpha }))
  const core = new Graphics().circle(0, 0, 6).fill(0xffffff)
  const container = new Container({ label: 'flash-burst' })
  container.addChild(bloom, core, badge)
  return {
    container,
    draw(progress, reducedMotion) {
      const outward = reducedMotion ? 1 : easeOutExpo(progress)
      bloom.scale.set(0.6 + outward * 1.8)
      bloom.alpha = fade(progress)
      core.scale.set(0.6 + outward * 0.6)
      core.alpha = fade(progress, 1.8)
      badge.alpha = badgeAlpha(progress, reducedMotion)
    },
  }
}

/** An HE grenade is lethal: a heavy shockwave over a scorch cloud. */
function heBurst(badge: Container): Burst {
  const color = utilityAppearance.he.color
  const scorch = new Graphics().circle(0, 0, 13).fill({ color, alpha: 0.35 })
  const shockwave = new Graphics().circle(0, 0, 10).stroke({ color, width: 2.5 })
  const container = new Container({ label: 'he-burst' })
  container.addChild(scorch, shockwave, badge)
  return {
    container,
    draw(progress, reducedMotion) {
      const outward = reducedMotion ? 1 : easeOutExpo(progress)
      scorch.scale.set(0.6 + outward * 0.5)
      scorch.alpha = Math.min(1, progress * 4) * fade(progress)
      shockwave.scale.set(0.8 + outward * 2.2)
      shockwave.alpha = fade(progress, 1.2)
      badge.alpha = badgeAlpha(progress, reducedMotion)
    },
  }
}

const bursts = {
  flash: { seconds: 0.45, create: flashBurst },
  he: { seconds: 0.9, create: heBurst },
} satisfies Partial<
  Record<GrenadeDetonation['kind'], { seconds: number; create: (badge: Container) => Burst }>
>

export function createDetonationRenderer(
  round: ReplayRound,
  map: MapDefinition,
  icons: Readonly<Record<keyof typeof bursts, Texture>>,
  background: number,
) {
  const container = new Container({ label: 'detonations' })
  const events = round.detonations.flatMap((event) => {
    if (!(event.kind in bursts)) return []
    const kind = event.kind as keyof typeof bursts
    const { seconds, create } = bursts[kind]
    const badge = createIconBadge()
    paintIconBadge(badge, icons[kind], utilityAppearance[kind].color, background)
    const burst = create(badge)
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
