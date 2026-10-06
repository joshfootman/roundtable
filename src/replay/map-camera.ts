export type MapCamera = { zoom: number; center: { x: number; y: number } }
export type CameraState = { current: MapCamera }
export type CameraViewport = {
  width: number
  height: number
  imageSize: number
  defaultZoom: number
}
export const minimumZoom = 0.6
export const initialZoom = 0.9
export const maximumZoom = 4
export function focusedCamera(center = { x: 0.5, y: 0.5 }): MapCamera {
  return { zoom: initialZoom, center: { ...center } }
}
export function cameraTransform(camera: MapCamera, viewport: CameraViewport) {
  const scale =
    (Math.min(viewport.width, viewport.height) * viewport.defaultZoom * camera.zoom) /
    viewport.imageSize
  return {
    scale,
    x: viewport.width / 2 - camera.center.x * viewport.imageSize * scale,
    y: viewport.height / 2 - camera.center.y * viewport.imageSize * scale,
  }
}
export function constrainCamera(camera: MapCamera, viewport: CameraViewport): MapCamera {
  const zoom = Math.max(minimumZoom, Math.min(maximumZoom, camera.zoom))
  const size = cameraTransform({ ...camera, zoom }, viewport).scale * viewport.imageSize
  function axis(center: number, length: number) {
    const edge = length / (2 * size)
    const padding = (Math.min(viewport.width, viewport.height) * 0.1) / size
    const minimum = Math.min(edge, 1 - edge) - padding
    const maximum = Math.max(edge, 1 - edge) + padding
    return Math.max(minimum, Math.min(maximum, center))
  }
  return {
    zoom,
    center: { x: axis(camera.center.x, viewport.width), y: axis(camera.center.y, viewport.height) },
  }
}
export function zoomCamera(
  camera: MapCamera,
  viewport: CameraViewport,
  factor: number,
  anchor: { x: number; y: number },
): MapCamera {
  const zoom = Math.max(minimumZoom, Math.min(maximumZoom, camera.zoom * factor))
  const old = cameraTransform(camera, viewport)
  const size = old.scale * viewport.imageSize
  const nextSize = (size * zoom) / camera.zoom
  return constrainCamera(
    {
      zoom,
      center: {
        x: (anchor.x - old.x) / size - (anchor.x - viewport.width / 2) / nextSize,
        y: (anchor.y - old.y) / size - (anchor.y - viewport.height / 2) / nextSize,
      },
    },
    viewport,
  )
}
export function panCamera(
  camera: MapCamera,
  viewport: CameraViewport,
  delta: { x: number; y: number },
): MapCamera {
  const size = cameraTransform(camera, viewport).scale * viewport.imageSize
  return constrainCamera(
    {
      ...camera,
      center: { x: camera.center.x - delta.x / size, y: camera.center.y - delta.y / size },
    },
    viewport,
  )
}
