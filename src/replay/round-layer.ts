import { Assets, Container, Sprite, loadEnvironmentExtensions, type Texture } from 'pixi.js'
import c4Icon from '../assets/cs2/equipment/c4.svg?url&no-inline'
import defuseIcon from '../assets/cs2/equipment/defuser.svg?url&no-inline'
import { createBombRenderer } from './bomb-renderer'
import { createDroppedItemRenderer } from './dropped-item-renderer'
import { equipmentIconForDefinition } from './icons'
import type { MapDefinition, MapFloor } from './maps'
import { createPlayerRenderer, type PlayerAppearance } from './player-renderer'
import type { ReplayRound } from './types'
import { createUtilityRenderer } from './utility-renderer'
import { initialUtilityVisibility } from './utility'

/** Start downloading what the first draw of `map` needs, so it is cached when the round arrives. */
export function preloadMapAssets(map: MapDefinition) {
  // The renderer's environment modules otherwise load only once the map mounts.
  void loadEnvironmentExtensions(false).catch(() => {})
  const images = map.floors === 'split' ? [map.images.upper, map.images.lower] : [map.image]
  for (const src of [...images, c4Icon, defuseIcon]) void Assets.load<Texture>(src).catch(() => {})
}

/** Everything one round draws over the map, layered items, utility, players, then the bomb. */
export async function createRoundLayer(
  round: ReplayRound,
  map: MapDefinition,
  appearance: PlayerAppearance,
) {
  const definitions = new Set(round.droppedItems.map((item) => item.definition))
  const [bombTexture, defuseTexture, droppedTextures] = await Promise.all([
    Assets.load<Texture>(c4Icon),
    Assets.load<Texture>(defuseIcon),
    Promise.all(
      [...definitions].flatMap((definition) => {
        const src = equipmentIconForDefinition(definition)
        return src
          ? [Assets.load<Texture>(src).then((texture) => [definition, texture] as const)]
          : []
      }),
    ),
  ])
  const container = new Container({ label: 'round' })
  const dropped = createDroppedItemRenderer(round, map, new Map(droppedTextures))
  dropped.container.tint = appearance.foreground
  const utilities = createUtilityRenderer(round, map)
  const players = createPlayerRenderer(round, map, appearance, {
    bomb: bombTexture,
    defuse: defuseTexture,
  })
  const bombMarker = new Sprite(bombTexture)
  bombMarker.anchor.set(0.5)
  bombMarker.width = bombMarker.height = 18
  bombMarker.tint = appearance.foreground
  const bomb = createBombRenderer(round, map, bombMarker, {
    neutral: appearance.foreground,
    armed: appearance.armed,
    defusing: appearance.ct,
  })
  container.addChild(dropped.container, utilities.container, players.container, bomb.container)
  const visibility = initialUtilityVisibility()

  return {
    container,
    draw(tick: number, symbolScale: number, floor: MapFloor, reducedMotion: boolean) {
      dropped.draw(tick, symbolScale, floor)
      utilities.draw(tick, symbolScale, visibility, floor)
      players.draw(tick, symbolScale, { floor, flashes: visibility.flashes })
      bomb.draw(tick, symbolScale, floor, reducedMotion)
    },
    destroy() {
      container.destroy({ children: true })
    },
  }
}
