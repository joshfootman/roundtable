import { useEffect, useRef, useState } from 'react'
import { Assets, Sprite, type Texture } from 'pixi.js'
import c4Icon from '../assets/cs2/equipment/c4.svg?url&no-inline'
import { createBombRenderer } from '../replay/bomb-renderer'
import type { MapDefinition, MapFloor } from '../replay/maps'
import { createMapScene } from '../replay/map-scene'
import {
  createPlaybackClock,
  type PlaybackClock,
  type PlaybackSnapshot,
} from '../replay/playback-clock'
import type { ReplayRound } from '../replay/types'
import { createPlayerRenderer, type PlayerAppearance } from '../replay/player-renderer'
import { createUtilityRenderer } from '../replay/utility-renderer'
import { initialUtilityVisibility } from '../replay/utility'

export type DemoPlaybackController = PlaybackClock & { setFloor(floor: MapFloor): void }

export type DemoPlaybackState =
  | { status: 'loading' }
  | {
      status: 'ready'
      controller: DemoPlaybackController
      snapshot: PlaybackSnapshot
      floor: MapFloor
    }
  | { status: 'error' }

export function DemoMap({
  map,
  round,
  onPlayback,
}: {
  map: MapDefinition
  round?: ReplayRound
  onPlayback?: (state: DemoPlaybackState) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const [failedMap, setFailedMap] = useState<MapDefinition>()

  if (failedMap && failedMap !== map) setFailedMap(undefined)

  useEffect(() => {
    const element = host.current!
    const mapScene = createMapScene(map)
    let cancelled = false
    let clock: PlaybackClock | undefined
    onPlayback?.({ status: 'loading' })

    async function mount() {
      if (!(await mapScene.mount(element))) return
      if (round) {
        const bombTexture = await Assets.load<Texture>(c4Icon)
        if (cancelled) return
        const styles = getComputedStyle(element)
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 1
        const context = canvas.getContext('2d')!
        function color(token: string) {
          context.clearRect(0, 0, 1, 1)
          context.fillStyle = styles.getPropertyValue(token).trim()
          context.fillRect(0, 0, 1, 1)
          const [red, green, blue] = context.getImageData(0, 0, 1, 1).data
          return (red! << 16) | (green! << 8) | blue!
        }
        const appearance: PlayerAppearance = {
          ct: color('--color-ct'),
          t: color('--color-t'),
          foreground: color('--color-mauve-200'),
          background: color('--color-neutral-800'),
          fontSize: 14,
        }
        const utilities = createUtilityRenderer(round, map)
        mapScene.container.addChild(utilities.container)
        const players = createPlayerRenderer(round, map, appearance)
        mapScene.container.addChild(players.container)
        const bombMarker = new Sprite(bombTexture)
        bombMarker.anchor.set(0.5)
        bombMarker.width = bombMarker.height = 18
        bombMarker.tint = appearance.foreground
        const bomb = createBombRenderer(round, map, bombMarker)
        mapScene.container.addChild(bomb.container)
        const visibility = initialUtilityVisibility()
        let floor: MapFloor = map.floors === 'split' ? map.initialFloor : 'upper'
        let tick = round.liveStartTick
        let symbolScale = 1
        let controller: DemoPlaybackController
        function draw() {
          utilities.draw(tick, symbolScale, visibility, floor)
          players.draw(tick, symbolScale, { floor, flashes: visibility.flashes })
          bomb.draw(tick, symbolScale, floor)
        }
        mapScene.observeResize((scale) => {
          symbolScale = 1 / scale
          draw()
        })
        clock = createPlaybackClock({
          initialTick: round.liveStartTick,
          minimum: round.liveStartTick,
          maximum: round.endTick,
          tickInterval: round.tickInterval,
          draw(nextTick) {
            tick = nextTick
            draw()
            if (!mapScene.app.ticker.started) mapScene.app.render()
          },
          publish(snapshot) {
            if (!cancelled) onPlayback?.({ status: 'ready', controller, snapshot, floor })
          },
          setRunning(running) {
            if (running) mapScene.app.ticker.start()
            else mapScene.app.ticker.stop()
          },
        })
        controller = {
          ...clock,
          setFloor(nextFloor) {
            floor = nextFloor
            mapScene.setFloor(floor)
            draw()
            mapScene.app.render()
            if (!cancelled)
              onPlayback?.({ status: 'ready', controller, snapshot: clock!.getSnapshot(), floor })
          },
        }
        mapScene.app.ticker.add((ticker) => clock!.advance(ticker.elapsedMS))
        clock.pause()
      } else {
        mapScene.observeResize()
      }
    }

    void mount().catch(() => {
      if (cancelled) return
      mapScene.destroy()
      setFailedMap(map)
      onPlayback?.({ status: 'error' })
    })

    return () => {
      cancelled = true
      mapScene.destroy()
    }
  }, [map, round, onPlayback])

  return (
    <div ref={host} className="relative size-full min-h-0">
      {failedMap === map && (
        <p
          role="alert"
          className="absolute inset-0 flex items-center justify-center p-4 text-mauve-200"
        >
          Unable to display the {map.name} map.
        </p>
      )}
    </div>
  )
}
