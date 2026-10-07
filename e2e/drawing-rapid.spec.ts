import { expect, test } from '@playwright/test'

test('rapid strokes survive acknowledgement while the next stroke is still drawing', async ({
  page,
}) => {
  await page.goto('/replay?source=example&example=astralis-vs-mouz-m2-nuke&round=1')
  const map = page.getByRole('img', { name: 'Nuke map', exact: true })
  await expect(map).toBeVisible({ timeout: 30_000 })
  await map.focus()
  await page.keyboard.press('d')
  const counts = await map.evaluate(async (canvas) => {
    const bounds = canvas.getBoundingClientRect()
    const capture = canvas.setPointerCapture
    canvas.setPointerCapture = () => {}
    function pointer(type: string, x: number, y: number, buttons: number) {
      canvas.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          pointerId: 42,
          pointerType: 'mouse',
          clientX: bounds.x + x,
          clientY: bounds.y + y,
          button: 0,
          buttons,
          pressure: buttons ? 0.5 : 0,
        }),
      )
    }
    const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    for (let index = 0; index < 12; index++) {
      const x = 120 + index * 14
      pointer('pointerdown', x, 180, 1)
      pointer('pointermove', x + 20, 180, 1)
      pointer('pointerup', x + 30, 180, 0)
      pointer('pointerdown', x, 220, 1)
      await frame()
      pointer('pointermove', x + 20, 220, 1)
      pointer('pointerup', x + 30, 220, 0)
      await frame()
    }
    canvas.setPointerCapture = capture
    return canvas.parentElement!.querySelectorAll('svg path[d]').length
  })
  expect(counts, 'Every completed rapid stroke retains an outline').toBe(24)
  await expect(page.getByText('24 drawings on this floor', { exact: true })).toHaveCount(1)
})

test('mouse movement produces subtle pressure variation in the rendered ink', async ({ page }) => {
  await page.goto('/replay?source=example&example=faze-vs-vitality-m2-dust2&round=1')
  const map = page.getByRole('img', { name: 'Dust II map', exact: true })
  await expect(map).toBeVisible({ timeout: 30_000 })
  await map.focus()
  await page.keyboard.press('d')
  const bounds = (await map.boundingBox())!
  const x = bounds.width / 2 - 70
  const y = bounds.height / 2
  for (const [step, offset] of [
    [1, -25],
    [12, 25],
  ] as const) {
    await page.mouse.move(bounds.x + x, bounds.y + y + offset)
    await page.mouse.down()
    for (let distance: number = step; distance <= 120; distance += step) {
      await page.mouse.move(bounds.x + x + distance, bounds.y + y + offset)
    }
    await page.mouse.up()
  }
  await expect(page.getByText('2 drawings on this floor', { exact: true })).toHaveCount(1)
  const widths = await map.evaluate(
    async (canvas, centre) => {
      const svg = canvas.parentElement!.querySelector('svg')!.cloneNode(true) as SVGSVGElement
      svg.setAttribute('width', String(canvas.clientWidth))
      svg.setAttribute('height', String(canvas.clientHeight))
      const image = new Image()
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`
      await image.decode()
      const rendered = document.createElement('canvas')
      rendered.width = canvas.clientWidth
      rendered.height = canvas.clientHeight
      const context = rendered.getContext('2d')!
      context.drawImage(image, 0, 0)
      return [-25, 25].map((offset) => {
        const pixels = context.getImageData(
          Math.round(centre.x),
          Math.round(centre.y + offset - 10),
          20,
          20,
        ).data
        let ink = 0
        for (let index = 3; index < pixels.length; index += 4) ink += pixels[index]! / 255
        return ink / 20
      })
    },
    { x: x + 55, y },
  )
  expect(widths[0]!, 'Slow mouse movement draws thicker ink than quick movement').toBeGreaterThan(
    widths[1]! + 0.75,
  )
  expect(widths[1]!, 'Quick strokes stay legible').toBeGreaterThan(1)
})
