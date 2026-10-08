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
