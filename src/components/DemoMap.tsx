import { useEffect, useRef, useState } from 'react'
import type { MapDefinition, MapFloor } from '../replay/maps'
import { createMapScene } from '../replay/map-scene'
import { focusedCamera, type CameraState } from '../replay/map-camera'
import {
  createPlaybackClock,
  type PlaybackClock,
  type PlaybackSnapshot,
} from '../replay/playback-clock'
import type { ReplayRound } from '../replay/types'
import type { PlayerAppearance } from '../replay/player-renderer'
import { createRoundLayer } from '../replay/round-layer'
import type { DrawingConfiguration } from '../replay/drawing'

export type DemoPlaybackController = PlaybackClock & {
  setFloor(floor: MapFloor): void
  /** Called with the fractional tick on every drawn frame; returns an unsubscribe. */
  subscribeFrame(listener: (tick: number) => void): () => void
}

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
  // The mounted scene for `map`; it outlives rounds so switching rounds keeps the renderer.
  const [scene, setScene] = useState<{ map: MapDefinition; mapScene: MapScene }>()
  const cameraScale = useRef({
    scale: 1,
    listener: undefined as ((scale: number) => void) | undefined,
  })

  if (failedMap && failedMap !== map) setFailedMap(undefined)

  // Declared before the scene effect so its cleanup runs while the scene still exists.
  useEffect(() => {
    if (!round || scene?.map !== map) return
    const { mapScene } = scene
    const element = host.current!
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const scale = cameraScale.current
    let cancelled = false
    let layer: Awaited<ReturnType<typeof createRoundLayer>> | undefined
    let advance: ((ticker: { deltaMS: number }) => void) | undefined
    let updateMotion: (() => void) | undefined
    onPlayback?.({ status: 'loading' })

    createRoundLayer(round, map, appearance(element))
      .then((created) => {
        if (cancelled) return created.destroy()
        layer = created
        mapScene.container.addChild(layer.container)
        let floor: MapFloor = map.floors === 'split' ? map.initialFloor : 'upper'
        mapScene.setFloor(floor)
        let tick = round.liveStartTick
        let symbolScale = 1 / scale.scale
        let controller: DemoPlaybackController
        const draw = () => created.draw(tick, symbolScale, floor, reducedMotion.matches)
        scale.listener = (next) => {
          symbolScale = 1 / next
          draw()
        }
        updateMotion = () => {
          draw()
          mapScene.app.render()
        }
        reducedMotion.addEventListener('change', updateMotion)
        const frameListeners = new Set<(tick: number) => void>()
        const clock: PlaybackClock = createPlaybackClock({
          initialTick: round.liveStartTick,
          minimum: round.liveStartTick,
          maximum: round.endTick,
          tickInterval: round.tickInterval,
          draw(nextTick) {
            tick = nextTick
            draw()
            for (const listener of frameListeners) listener(tick)
            if (!mapScene.app.ticker.started) mapScene.app.render()
          },
          publish(snapshot) {
            if (!cancelled) onPlayback?.({ status: 'ready', controller, snapshot, floor })
          },
          onMove({ from, to, cause }) {
            if (cancelled) return
            if (cause !== 'advance') onResult?.(null)
            else if (round.outcome && from < round.resultTick && to >= round.resultTick) {
              onPlayback?.({ status: 'ready', controller, snapshot: clock.getSnapshot(), floor })
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
          subscribeFrame(listener) {
            frameListeners.add(listener)
            return () => frameListeners.delete(listener)
          },
          setFloor(nextFloor) {
            floor = nextFloor
            mapScene.setFloor(floor)
            draw()
            mapScene.app.render()
            if (!cancelled)
              onPlayback?.({ status: 'ready', controller, snapshot: clock.getSnapshot(), floor })
          },
        }
        advance = (ticker) => clock.advance(ticker.deltaMS)
        mapScene.app.ticker.add(advance)
        clock.pause()
      })
      .catch(() => {
        if (cancelled) return
        setFailedMap(map)
        onPlayback?.({ status: 'error' })
      })

    return () => {
      cancelled = true
      scale.listener = undefined
      if (updateMotion) reducedMotion.removeEventListener('change', updateMotion)
      if (advance) {
        mapScene.app.ticker.remove(advance)
        mapScene.app.ticker.stop()
      }
      layer?.destroy()
    }
  }, [map, scene, round, onPlayback, onResult])

  useEffect(() => {
    const element = host.current!
    const mapScene = createMapScene(map, camera ?? ownCamera.current)
    sceneRef.current = mapScene
    let cancelled = false
    onCamera?.({ status: 'loading' })
    let publishedZoom: number | undefined

    mapScene
      .mount(element)
      .then((mounted) => {
        if (!mounted || cancelled) return
        mapScene.observeCamera((scale, zoom) => {
          cameraScale.current.scale = scale
          cameraScale.current.listener?.(scale)
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
        })
        if (drawingRef.current) mapScene.setDrawing(drawingRef.current)
        setScene({ map, mapScene })
      })
      .catch(() => {
        if (cancelled) return
        mapScene.destroy()
        setFailedMap(map)
        onPlayback?.({ status: 'error' })
        onCamera?.({ status: 'error' })
      })

    return () => {
      cancelled = true
      sceneRef.current = null
      setScene(undefined)
      mapScene.destroy()
    }
  }, [map, camera, onCamera, onPlayback])

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

type MapScene = ReturnType<typeof createMapScene>

/** Resolve the theme's colour tokens to the numbers Pixi tints with. */
function appearance(element: HTMLElement): PlayerAppearance {
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
  return {
    ct: color('--color-ct'),
    t: color('--color-t'),
    foreground: color('--color-mauve-200'),
    background: color('--color-neutral-800'),
    armed: color('--color-bomb'),
    fontSize: 14,
  }
}
