import { strokeOutline, type DrawingStroke } from './drawing'

const svgNamespace = 'http://www.w3.org/2000/svg'

export function createDrawingLayer() {
  const svg = document.createElementNS(svgNamespace, 'svg')
  svg.setAttribute('class', 'pointer-events-none absolute inset-0 h-full w-full overflow-hidden')
  svg.setAttribute('aria-hidden', 'true')
  const camera = document.createElementNS(svgNamespace, 'g')
  const committed = document.createElementNS(svgNamespace, 'g')
  const pending = document.createElementNS(svgNamespace, 'g')
  const draft = document.createElementNS(svgNamespace, 'path')
  camera.append(committed, pending, draft)
  svg.append(camera)
  let pendingStrokes: DrawingStroke[] = []

  function path(stroke: DrawingStroke, complete: boolean) {
    const outline = strokeOutline(stroke, complete)
    return outline.length ? `M${outline.join(' ')}Z` : ''
  }

  function element(stroke: DrawingStroke) {
    const node = document.createElementNS(svgNamespace, 'path')
    node.setAttribute('d', path(stroke, true))
    node.setAttribute('fill', stroke.color)
    return node
  }

  return {
    svg,
    setCamera(x: number, y: number, scale: number) {
      camera.setAttribute('transform', `translate(${x} ${y}) scale(${scale})`)
    },
    setStrokes(strokes: readonly DrawingStroke[]) {
      committed.replaceChildren(...strokes.map(element))
      pendingStrokes = strokes.length
        ? pendingStrokes.filter((stroke) => !strokes.includes(stroke))
        : []
      pending.replaceChildren(...pendingStrokes.map(element))
    },
    setDraft(stroke: DrawingStroke) {
      draft.setAttribute('d', path(stroke, false))
      draft.setAttribute('fill', stroke.color)
    },
    clearDraft() {
      draft.removeAttribute('d')
    },
    commit(stroke: DrawingStroke) {
      pendingStrokes.push(stroke)
      pending.append(element(stroke))
      draft.removeAttribute('d')
    },
    clear() {
      pendingStrokes = []
      pending.replaceChildren()
      committed.replaceChildren()
      draft.removeAttribute('d')
    },
    destroy() {
      svg.remove()
    },
  }
}
