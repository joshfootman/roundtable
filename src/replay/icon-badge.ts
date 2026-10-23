import { Container, Sprite, type Texture } from 'pixi.js'

const OUTLINE_STEPS = 8
/** Every utility badge on the map is the same size, whatever its icon. */
const BADGE_SIZE = 18

/** An icon over eight copies of itself nudged 1px around a circle, which read as an outline. */
export function createIconBadge() {
  const badge = new Container()
  for (let step = 0; step <= OUTLINE_STEPS; step++) {
    const sprite = badge.addChild(new Sprite())
    sprite.anchor.set(0.5)
    if (step === OUTLINE_STEPS) continue
    const angle = (step / OUTLINE_STEPS) * Math.PI * 2
    sprite.position.set(Math.cos(angle), Math.sin(angle))
  }
  return badge
}

export function paintIconBadge(badge: Container, texture: Texture, color: number, outline: number) {
  const fit = BADGE_SIZE / Math.max(texture.width, texture.height)
  for (const [step, sprite] of (badge.children as Sprite[]).entries()) {
    sprite.texture = texture
    sprite.tint = step === OUTLINE_STEPS ? color : outline
    sprite.scale.set(fit)
  }
}
