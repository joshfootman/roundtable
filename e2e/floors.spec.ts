import { expect, test } from '@playwright/test'

test('switches Nuke floors directly without changing the paused replay tick', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/replay?source=example&example=astralis-vs-mouz-m2-nuke&round=1')
  await expect(page.getByRole('button', { name: 'Play round', exact: true })).toBeEnabled({
    timeout: 30_000,
  })
  const floors = page.getByRole('group', { name: 'Map controls' })
  const toggle = floors.getByRole('button', { name: /floor — switch/ })
  await expect(toggle).toHaveAccessibleName('Upper floor — switch to lower floor')
  await expect(toggle).toHaveAttribute('title', 'Upper floor — switch to lower floor (F)')
  await expect(toggle).toHaveText('')
  const timeline = page.getByRole('slider', { name: 'Round timeline' })
  const bounds = (await timeline.boundingBox())!
  await timeline.click({ position: { x: bounds.width * 0.35, y: bounds.height / 2 } })
  const tick = await timeline.inputValue()
  await page.screenshot({ path: '.audit/round-outcomes/nuke-upper-controls.png' })
  await toggle.click()
  await expect(toggle).toHaveAccessibleName('Lower floor — switch to upper floor')
  await expect(timeline).toHaveValue(tick)
  await expect(page.getByRole('button', { name: 'Play round', exact: true })).toBeEnabled()
  await page.screenshot({ path: '.audit/round-outcomes/nuke-lower-controls.png' })
  await toggle.focus()
  await toggle.press('Enter')
  await expect(toggle).toHaveAccessibleName('Upper floor — switch to lower floor')
  await expect(timeline).toHaveValue(tick)
  await page.setViewportSize({ width: 320, height: 844 })
  await expect(toggle).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  await toggle.click()
  await expect(timeline).toHaveValue(tick)
  await page.screenshot({ path: '.audit/round-outcomes/nuke-mobile-controls.png', fullPage: true })
})
