import { expect, test } from '@playwright/test'

test('switches Nuke floors directly without changing the paused replay tick', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/replay?source=example&example=astralis-vs-mouz-m2-nuke&round=1')
  await expect(page.getByRole('button', { name: 'Play round', exact: true })).toBeEnabled({
    timeout: 30_000,
  })
  const floors = page.getByRole('navigation', { name: 'Map floor' })
  const upper = floors.getByRole('button', { name: 'Upper', exact: true })
  const lower = floors.getByRole('button', { name: 'Lower', exact: true })
  await expect(upper).toHaveAttribute('aria-pressed', 'true')
  await expect(lower).toBeVisible()
  const timeline = page.getByRole('slider', { name: 'Round timeline' })
  const bounds = (await timeline.boundingBox())!
  await timeline.click({ position: { x: bounds.width * 0.35, y: bounds.height / 2 } })
  const tick = await timeline.inputValue()
  await page.screenshot({ path: '.audit/round-outcomes/nuke-upper-controls.png' })
  await lower.click()
  await expect(lower).toHaveAttribute('aria-pressed', 'true')
  await expect(timeline).toHaveValue(tick)
  await expect(page.getByRole('button', { name: 'Play round', exact: true })).toBeEnabled()
  await page.screenshot({ path: '.audit/round-outcomes/nuke-lower-controls.png' })
  await upper.focus()
  await upper.press('Enter')
  await expect(upper).toHaveAttribute('aria-pressed', 'true')
  await expect(timeline).toHaveValue(tick)
  await page.setViewportSize({ width: 320, height: 844 })
  await expect(lower).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  await lower.click()
  await expect(timeline).toHaveValue(tick)
  await page.screenshot({ path: '.audit/round-outcomes/nuke-mobile-controls.png', fullPage: true })
})
