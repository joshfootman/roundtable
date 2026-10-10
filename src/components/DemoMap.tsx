import { useEffect, useRef, useState } from 'react'
import { Assets, Sprite, type Texture } from 'pixi.js'
import c4Icon from '../assets/cs2/equipment/c4.svg?url&no-inline'
import defuseIcon from '../assets/cs2/equipment/defuser.svg?url&no-inline'
import { createBombRenderer } from '../replay/bomb-renderer'
import { createDroppedItemRenderer } from '../replay/dropped-item-renderer'
import { equipmentIconForDefinition } from '../replay/icons'
import type { MapDefinition, MapFloor } from '../replay/maps'
import { createMapScene } from '../replay/map-scene'
import { focusedCamera, type CameraState } from '../replay/map-camera'
import {
  createPlaybackClock,
  type PlaybackClock,
  type PlaybackSnapshot,
} from '../replay/playback-clock'
import type { ReplayRound } from '../replay/types'
import { createPlayerRenderer, type PlayerAppearance } from '../replay/player-renderer'
import { createUtilityRenderer } from '../replay/utility-renderer'
import type { DrawingConfiguration } from '../replay/drawing'
import { initialUtilityVisibility } from '../replay/utility'

export type DemoPlaybackController = PlaybackClock & { setFloor(floor: MapFloor): void }

export type DemoCameraState =
  | { status: 'loading' | 'error' }
  | {
      status: 'ready'
      zoom: number
      zoomIn(): void
      zoomOut(): void
      panBy(delta: { x: number; y: number }): void
      focus(): void
    }

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
  onResult,
  camera,
  onCamera,
  drawing,
}: {
  map: MapDefinition
  round?: ReplayRound
  onPlayback?: (state: DemoPlaybackState) => void
  onResult?: (outcome: ReplayRound['outcome'] | null) => void
  camera?: CameraState
  onCamera?: (state: DemoCameraState) => void
  drawing?: DrawingConfiguration
}) {
  const drawingRef = useRef(drawing)
  const sceneRef = useRef<ReturnType<typeof createMapScene>>(null)
  useEffect(() => {
    drawingRef.current = drawing
    if (drawing) sceneRef.current?.setDrawing(drawing)
  }, [drawing])
  const ownCamera = useRef<CameraState>({ current: focusedCamera(map.focusCenter) })
  const host = useRef<HTMLDivElement>(null)
  const [failedMap, setFailedMap] = useState<MapDefinition>()

  if (failedMap && failedMap !== map) setFailedMap(undefined)

  useEffect(() => {
    const element = host.current!
    const mapScene = createMapScene(map, camera ?? ownCamera.current)
    sceneRef.current = mapScene
    let cancelled = false
    let clock: PlaybackClock | undefined
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let updateMotion: (() => void) | undefined
    onPlayback?.({ status: 'loading' })
    onCamera?.({ status: 'loading' })
    let publishedZoom: number | undefined
    function publishCamera(zoom: number) {
      if (cancelled || publishedZoom === zoom) return
      publishedZoom = zoom
      onCamera?.({
        status: 'ready',
        zoom,
        zoomIn: () => mapScene.zoomBy(1.25),
        zoomOut: () => mapScene.zoomBy(1 / 1.25),
        focus: mapScene.focus,
        panBy: mapScene.panBy,
      })
    }

    async function mount() {
      if (!(await mapScene.mount(element))) return
      if (round) {
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
        if (cancelled) return
        const styles = getComputedStyle(element)
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 1
        const context = canvas.getContext('2d', { willReadFrequently: true })!
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
          armed: color('--color-bomb'),
          fontSize: 14,
        }
        const dropped = createDroppedItemRenderer(round, map, new Map(droppedTextures))
        dropped.container.tint = appearance.foreground
        mapScene.container.addChild(dropped.container)
        const utilities = createUtilityRenderer(round, map)
        mapScene.container.addChild(utilities.container)
        const players = createPlayerRenderer(round, map, appearance, {
          bomb: bombTexture,
          defuse: defuseTexture,
        })
        mapScene.container.addChild(players.container)
        const bombMarker = new Sprite(bombTexture)
        bombMarker.anchor.set(0.5)
        bombMarker.width = bombMarker.height = 18
        bombMarker.tint = appearance.foreground
        const bomb = createBombRenderer(round, map, bombMarker, {
          neutral: appearance.foreground,
          armed: appearance.armed,
          defusing: appearance.ct,
        })
        mapScene.container.addChild(bomb.container)
        const visibility = initialUtilityVisibility()
        let floor: MapFloor = map.floors === 'split' ? map.initialFloor : 'upper'
        let tick = round.liveStartTick
        let symbolScale = 1
        let controller: DemoPlaybackController
        function draw() {
          dropped.draw(tick, symbolScale, floor)
          utilities.draw(tick, symbolScale, visibility, floor)
          players.draw(tick, symbolScale, { floor, flashes: visibility.flashes })
          bomb.draw(tick, symbolScale, floor, reducedMotion.matches)
        }
        updateMotion = () => {
          draw()
          mapScene.app.render()
        }
        reducedMotion.addEventListener('change', updateMotion)
        mapScene.observeCamera((scale, zoom) => {
          symbolScale = 1 / scale
          draw()
          publishCamera(zoom)
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
          onMove({ from, to, cause }) {
            if (cancelled) return
            if (cause !== 'advance') onResult?.(null)
            else if (round.outcome && from < round.resultTick && to >= round.resultTick) {
              onPlayback?.({ status: 'ready', controller, snapshot: clock!.getSnapshot(), floor })
              onResult?.(round.outcome)
            }
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
        if (drawingRef.current) mapScene.setDrawing(drawingRef.current)
        clock.pause()
      } else {
        mapScene.observeCamera((_scale, zoom) => publishCamera(zoom))
      }
    }

    void mount().catch(() => {
      if (cancelled) return
      mapScene.destroy()
      setFailedMap(map)
      onPlayback?.({ status: 'error' })
      onCamera?.({ status: 'error' })
    })

    return () => {
      cancelled = true
      sceneRef.current = null
      if (updateMotion) reducedMotion.removeEventListener('change', updateMotion)
      mapScene.destroy()
    }
  }, [map, round, onPlayback, onResult, camera, onCamera])

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
