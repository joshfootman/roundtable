import { expect, test } from '@playwright/test'

test('map controls keep navigation and drawing together across viewport sizes', async ({
  page,
}) => {
  await page.goto('/replay?source=example&example=astralis-vs-mouz-m2-nuke&round=1')
  await expect(page.getByRole('button', { name: 'Draw on map', exact: true })).toBeEnabled({
    timeout: 30_000,
  })

  for (const viewport of [
    { width: 320, height: 740 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 640, height: 390 },
    { width: 844, height: 390 },
    { width: 1280, height: 800 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport)
    const controls = page.getByRole('group', { name: 'Map controls', exact: true })
    const navigation = controls.getByRole('group', { name: 'Map navigation', exact: true })
    const drawing = controls.getByRole('group', { name: 'Drawing and shortcuts', exact: true })
    for (const group of [navigation, drawing]) {
      const buttons = await group.getByRole('button').all()
      const bounds = await Promise.all(buttons.map((button) => button.boundingBox()))
      for (const button of bounds) {
        expect(button).not.toBeNull()
        expect(button!.y).toBe(bounds[0]!.y)
        expect(button!.width).toBeGreaterThanOrEqual(44)
        expect(button!.height).toBeGreaterThanOrEqual(44)
        expect(button!.x).toBeGreaterThanOrEqual(0)
        expect(button!.x + button!.width).toBeLessThanOrEqual(viewport.width)
        expect(button!.y + button!.height).toBeLessThanOrEqual(viewport.height)
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      viewport.width,
    )
  }
})
