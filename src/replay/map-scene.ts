import { Application, Assets, Container, Sprite, type Texture } from 'pixi.js'
import type { MapDefinition, MapFloor } from './maps'
import { orientRadar } from './radar'

/** Shared map layer; replay callers add recorded objects to its container. */
export function createMapScene(map: MapDefinition) {
  const app = new Application()
  const container = new Container()
  let initialized = false
  let disposed = false
  let host: HTMLElement
  let observer: ResizeObserver | undefined
  let radar: Sprite
  let textures: Record<MapFloor, Texture>

  function destroy() {
    disposed = true
    observer?.disconnect()
    if (initialized) {
      app.destroy(true, { children: true })
      initialized = false
    }
  }

  async function mount(element: HTMLElement) {
    host = element
    await app.init({
      width: map.imageSize,
      height: map.imageSize,
      backgroundAlpha: 0,
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
    app.canvas.className = 'absolute inset-0 block'
    app.canvas.setAttribute('role', 'img')
    app.canvas.setAttribute('aria-label', `${map.name} map`)
    host.appendChild(app.canvas)
    return true
  }

  function observeResize(onResize?: (scale: number) => void) {
    function resize() {
      const width = host.clientWidth
      const height = host.clientHeight
      if (width === 0 || height === 0) return
      const size = Math.min(width, height) * map.defaultZoom
      const scale = size / map.imageSize
      app.renderer.resize(width, height)
      container.scale.set(scale)
      container.position.set((width - size) / 2, (height - size) / 2)
      onResize?.(scale)
      app.render()
    }
    observer?.disconnect()
    observer = new ResizeObserver(resize)
    observer.observe(host)
    resize()
  }

  function setFloor(floor: MapFloor) {
    radar.texture = textures[floor]
    orientRadar(radar, map)
  }

  return { app, container, mount, observeResize, setFloor, destroy }
}
