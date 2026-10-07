import { expect, test } from '@playwright/test'

for (const viewport of [
  { width: 320, height: 740 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 844, height: 390 },
]) {
  test(`mobile HUD keeps round navigation separate at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await page.goto('/replay?source=example&example=astralis-vs-mouz-m2-nuke&round=2')
    await expect(page.getByRole('button', { name: 'Play round', exact: true })).toBeEnabled({
      timeout: 30_000,
    })
    for (const name of [
      'Zoom in',
      'Zoom out',
      'Focus map',
      'Draw on map',
      'Clear map drawings',
      'Keyboard shortcuts',
    ])
      await expect(page.getByRole('button', { name, exact: true })).toBeHidden()
    const previous = page.getByRole('button', { name: 'Previous round', exact: true })
    const next = page.getByRole('button', { name: 'Next round', exact: true })
    const picker = page.getByRole('button', { name: 'Choose round, current round 2', exact: true })
    const previousBounds = (await previous.boundingBox())!
    const nextBounds = (await next.boundingBox())!
    const pickerBounds = (await picker.boundingBox())!
    expect(previousBounds.y).toBe(nextBounds.y)
    expect(previousBounds.y + previousBounds.height).toBeLessThan(pickerBounds.y)
    expect(previousBounds.width).toBeGreaterThanOrEqual(44)
    expect(nextBounds.width).toBeGreaterThanOrEqual(44)
    const logo = (await page.locator('.demo-logo').boundingBox())!
    expect(logo.width).toBe(128)
    expect(logo.height).toBe(32)
    await page.getByRole('button', { name: 'Kill feed', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Round kill feed' })).toBeVisible()
    await expect(page.getByText('No kills yet this round')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Kill feed', exact: true })).toBeFocused()
    const map = page.getByRole('img', { name: 'Nuke map', exact: true })
    await map.focus()
    await page.keyboard.press('9')
    await page.getByRole('button', { name: 'Kill feed', exact: true }).click()
    await expect(page.getByRole('list', { name: 'Round kills, latest first' })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Round kills, latest first' })).toHaveAttribute(
      'tabindex',
      '-1',
    )
    await page.keyboard.press('Escape')
    await next.click()
    await expect(
      page.getByRole('button', { name: 'Choose round, current round 3', exact: true }),
    ).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      viewport.width,
    )
  })
}

test('resizing to mobile disables an active pen without losing drawings', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/replay?source=example&example=astralis-vs-mouz-m2-nuke&round=1')
  const pen = page.getByRole('button', { name: 'Draw on map', exact: true })
  await expect(pen).toBeEnabled({ timeout: 30_000 })
  await pen.click()
  const desktopMap = page.getByRole('img', { name: 'Nuke map', exact: true })
  const desktopBounds = (await desktopMap.boundingBox())!
  await page.mouse.move(
    desktopBounds.x + desktopBounds.width / 2,
    desktopBounds.y + desktopBounds.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    desktopBounds.x + desktopBounds.width / 2 + 30,
    desktopBounds.y + desktopBounds.height / 2 + 25,
  )
  await page.mouse.up()
  await expect(page.getByLabel('Drawing count', { exact: true })).toHaveText(
    '1 drawing on this floor',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  const map = page.getByRole('img', { name: 'Nuke map', exact: true })
  await expect(map).toHaveClass(/cursor-grab(?:\s|$)/)
  await map.scrollIntoViewIfNeeded()
  const bounds = (await map.boundingBox())!
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width / 2 + 30, bounds.y + bounds.height / 2 + 25)
  await page.mouse.up()
  await page.setViewportSize({ width: 1280, height: 800 })
  await expect(page.getByLabel('Drawing count', { exact: true })).toHaveText(
    '1 drawing on this floor',
  )
})
