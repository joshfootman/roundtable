import { Application, Assets, Container, Sprite, type Texture } from 'pixi.js'
import type { MapDefinition, MapFloor } from './maps'
import { orientRadar } from './radar'
import type { DrawingConfiguration, DrawingStroke } from './drawing'
import { createDrawingLayer } from './drawing-layer'
import {
  cameraTransform,
  constrainCamera,
  focusedCamera,
  panCamera,
  zoomCamera,
  type CameraState,
  type CameraViewport,
} from './map-camera'

/** Shared map layer; replay callers add recorded objects to its container. */
export function createMapScene(
  map: MapDefinition,
  camera: CameraState = { current: focusedCamera(map.focusCenter) },
) {
  const app = new Application()
  const container = new Container()
  const annotations = createDrawingLayer()
  let renderedStrokes: DrawingConfiguration['strokes'] | undefined
  let drawing: DrawingConfiguration | undefined
  let draft:
    | {
        pointerId: number
        stroke: DrawingStroke
        previousSample?: { x: number; y: number; time: number; pressure: number }
      }
    | undefined
  let drawingInterrupted = false

  function cancelDraft() {
    if (!draft) return
    draft = undefined
    annotations.clearDraft()
  }

  function setDrawing(next: DrawingConfiguration) {
    const scopeChanged = drawing?.scope !== next.scope
    const strokesReplaced =
      drawing &&
      drawing.strokes !== next.strokes &&
      !(
        next.strokes.length > drawing.strokes.length &&
        drawing.strokes.every((stroke, index) => next.strokes[index] === stroke)
      )
    if (scopeChanged || !next.enabled || strokesReplaced) cancelDraft()
    const changed = renderedStrokes !== next.strokes
    const toolChanged = drawing?.enabled !== next.enabled || drawing?.scope !== next.scope
    drawing = next
    if (!initialized || disposed) return
    if (!changed && !toolChanged) return
    if (scopeChanged) annotations.clear()
    if (changed) {
      renderedStrokes = next.strokes
      annotations.setStrokes(next.strokes)
    }
    app.canvas.classList.remove('cursor-grab', 'cursor-grabbing', 'cursor-crosshair')
    app.canvas.classList.add(
      next.enabled ? 'cursor-crosshair' : pointers.size ? 'cursor-grabbing' : 'cursor-grab',
    )
    app.render()
  }

  let initialized = false
  let disposed = false
  let host: HTMLElement
  let observer: ResizeObserver | undefined
  let radar: Sprite
  let textures: Record<MapFloor, Texture>
  let viewport: CameraViewport
  let onCamera: ((scale: number, zoom: number) => void) | undefined
  let previousScale = 0
  const pointers = new Map<number, { x: number; y: number }>()
  const listeners = new AbortController()

  function updateCamera() {
    if (disposed || !viewport) return
    camera.current = constrainCamera(camera.current, viewport)
    const transform = cameraTransform(camera.current, viewport)
    container.scale.set(transform.scale)
    container.position.set(transform.x, transform.y)
    annotations.setCamera(transform.x, transform.y, transform.scale)
    if (previousScale !== transform.scale) {
      previousScale = transform.scale
      onCamera?.(transform.scale, camera.current.zoom)
    }
    app.render()
  }

  function zoomBy(factor: number, anchor?: { x: number; y: number }) {
    if (disposed || !viewport) return
    camera.current = zoomCamera(
      camera.current,
      viewport,
      factor,
      anchor ?? { x: viewport.width / 2, y: viewport.height / 2 },
    )
    updateCamera()
  }

  function panBy(delta: { x: number; y: number }) {
    if (disposed || !viewport) return
    camera.current = panCamera(camera.current, viewport, delta)
    updateCamera()
  }

  function focus() {
    if (disposed || !viewport) return
    camera.current = focusedCamera(map.focusCenter)
    updateCamera()
  }

  function destroy() {
    disposed = true
    observer?.disconnect()
    listeners.abort()
    pointers.clear()
    if (initialized) {
      app.destroy(true, { children: true })
      initialized = false
    }
    annotations.destroy()
  }

  async function mount(element: HTMLElement) {
    host = element
    await app.init({
      width: map.imageSize,
      height: map.imageSize,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio, 2),
      autoDensity: true,
      autoStart: false,
      preference: 'webgl',
    })
    initialized = true
    app.stage.addChild(container)
    if (disposed) {
      destroy()
      return false
    }

    const upper = await Assets.load<Texture>(map.floors === 'split' ? map.images.upper : map.image)
    const lower = map.floors === 'split' ? await Assets.load<Texture>(map.images.lower) : upper
    if (disposed) return false
    textures = { upper, lower }
    const floor = map.floors === 'split' ? map.initialFloor : 'upper'
    radar = new Sprite(textures[floor])
    orientRadar(radar, map)
    container.addChild(radar)
    app.stage.eventMode = 'none'
    app.canvas.className = 'absolute inset-0 block touch-none cursor-grab outline-none'
    app.canvas.tabIndex = -1
    app.canvas.setAttribute(
      'aria-description',
      'Press D to draw, Shift + D to clear. Drag to pan. Scroll or press plus and minus to zoom. Shift + arrow keys pan. Home focuses the map.',
    )
    app.canvas.setAttribute('role', 'img')
    app.canvas.setAttribute('aria-label', `${map.name} map`)
    const canvas = app.canvas
    const options = { signal: listeners.signal }
    function point(event: PointerEvent | WheelEvent) {
      const rect = canvas.getBoundingClientRect()
      return { x: event.clientX - rect.left, y: event.clientY - rect.top }
    }
    function sample(event: PointerEvent) {
      if (!draft) return
      const position = point(event)
      const previous = draft.previousSample
      if (previous?.x === position.x && previous.y === position.y) return
      let pressure =
        event.pointerType === 'pen' && event.type !== 'pointerup'
          ? event.pressure
          : (previous?.pressure ?? 0.5)
      if (event.pointerType !== 'pen' && previous && event.type !== 'pointerup') {
        const elapsed = event.timeStamp - previous.time
        if (elapsed > 0) {
          const speed = Math.hypot(position.x - previous.x, position.y - previous.y) / elapsed
          const target = 0.85 - 0.7 * Math.min(1, speed / 1.5)
          pressure += (target - pressure) * (1 - Math.exp(-elapsed / 24))
        }
      }
      draft.previousSample = { ...position, time: event.timeStamp, pressure }
      const local = container.toLocal(position)
      draft.stroke.points.push([local.x, local.y, pressure])
    }
    canvas.addEventListener(
      'wheel',
      (event) => {
        if (disposed || !viewport) return
        event.preventDefault()
        const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.height : 1
        zoomBy(
          Math.exp(Math.max(-Math.log(1.5), Math.min(Math.log(1.5), -event.deltaY * unit * 0.002))),
          point(event),
        )
      },
      { ...options, passive: false },
    )
    canvas.addEventListener(
      'pointerdown',
      (event) => {
        if (disposed || !viewport) return
        if (event.pointerType === 'mouse' && event.button !== 0) return
        canvas.setPointerCapture(event.pointerId)
        pointers.set(event.pointerId, point(event))
        if (pointers.size > 1) {
          cancelDraft()
          drawingInterrupted = true
        } else if (drawing?.enabled && !drawingInterrupted) {
          draft = {
            pointerId: event.pointerId,
            stroke: {
              color: drawing.color,
              points: [],
              simulatePressure: false,
            },
          }
          sample(event)
          annotations.setDraft(draft.stroke)
        } else if (!drawing?.enabled) canvas.classList.replace('cursor-grab', 'cursor-grabbing')
        canvas.focus({ preventScroll: true })
      },
      options,
    )
    canvas.addEventListener(
      'pointermove',
      (event) => {
        const old = pointers.get(event.pointerId)
        if (!old || !viewport) return
        const next = point(event)
        const before = [...pointers.values()]
        pointers.set(event.pointerId, next)
        const after = [...pointers.values()]
        if (draft?.pointerId === event.pointerId) {
          const samples = event.getCoalescedEvents?.() ?? []
          for (const entry of samples.length ? samples : [event]) sample(entry)
          annotations.setDraft(draft.stroke)
        } else if (pointers.size === 1 && !drawing?.enabled) {
          panBy({ x: next.x - old.x, y: next.y - old.y })
        } else if (pointers.size === 2) {
          const distance = (points: { x: number; y: number }[]) =>
            Math.hypot(points[1]!.x - points[0]!.x, points[1]!.y - points[0]!.y)
          const midpoint = (points: { x: number; y: number }[]) => ({
            x: (points[0]!.x + points[1]!.x) / 2,
            y: (points[0]!.y + points[1]!.y) / 2,
          })
          const from = midpoint(before)
          const to = midpoint(after)
          const oldDistance = distance(before)
          if (oldDistance > 0)
            camera.current = zoomCamera(
              camera.current,
              viewport,
              distance(after) / oldDistance,
              from,
            )
          camera.current = panCamera(camera.current, viewport, {
            x: to.x - from.x,
            y: to.y - from.y,
          })
          updateCamera()
        }
      },
      options,
    )
    function endPointer(event: PointerEvent) {
      if (draft?.pointerId === event.pointerId) {
        if (event.type === 'pointerup') sample(event)
        const stroke = draft.stroke
        draft = undefined
        annotations.commit(stroke)
        drawing?.onStroke(stroke)
      }
      pointers.delete(event.pointerId)
      if (!pointers.size) drawingInterrupted = false
      if (!pointers.size) canvas.classList.replace('cursor-grabbing', 'cursor-grab')
    }
    canvas.addEventListener('pointerup', endPointer, options)
    canvas.addEventListener('pointercancel', endPointer, options)
    canvas.addEventListener('lostpointercapture', endPointer, options)
    canvas.addEventListener(
      'keydown',
      (event) => {
        if (disposed || !viewport || event.ctrlKey || event.metaKey || event.altKey) return
        const delta = {
          ArrowLeft: { x: 48, y: 0 },
          ArrowRight: { x: -48, y: 0 },
          ArrowUp: { x: 0, y: 48 },
          ArrowDown: { x: 0, y: -48 },
        }[event.key]
        if (delta && event.shiftKey) {
          event.preventDefault()
          panBy(delta)
        } else if (['+', '=', '-', 'Home'].includes(event.key)) {
          event.preventDefault()
          if (event.key === 'Home') focus()
          else zoomBy(event.key === '-' ? 1 / 1.25 : 1.25)
        }
      },
      options,
    )
    host.append(canvas, annotations.svg)
    return true
  }

  function observeCamera(callback?: (scale: number, zoom: number) => void) {
    onCamera = callback
    previousScale = 0
    function resize() {
      if (disposed) return
      const width = host.clientWidth
      const height = host.clientHeight
      if (width === 0 || height === 0) return
      viewport = { width, height, imageSize: map.imageSize, defaultZoom: map.defaultZoom }
      app.renderer.resize(width, height)
      updateCamera()
    }
    observer?.disconnect()
    observer = new ResizeObserver(resize)
    observer.observe(host)
    resize()
  }

  function setFloor(floor: MapFloor) {
    cancelDraft()
    radar.texture = textures[floor]
    orientRadar(radar, map)
  }

  return {
    app,
    container,
    mount,
    observeCamera,
    zoomBy,
    panBy,
    focus,
    setFloor,
    setDrawing,
    destroy,
  }
}
