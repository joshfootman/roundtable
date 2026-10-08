import { expect, test } from '@playwright/test'

test('drawings follow the map and remain scoped to their round and floor', async ({ page }) => {
  await page.goto('/replay?source=example&example=astralis-vs-mouz-m2-nuke&round=1')
  const pen = page.getByRole('button', { name: 'Draw on map', exact: true })
  const clear = page.getByRole('button', { name: 'Clear map drawings', exact: true })
  const count = page.getByLabel('Drawing count', { exact: true })
  const map = page.getByRole('img', { name: 'Nuke map', exact: true })
  await expect(pen).toBeEnabled({ timeout: 30_000 })
  await pen.click()
  await expect(pen).toHaveAttribute('aria-pressed', 'true')
  await pen.click()
  await expect(pen).toHaveAttribute('aria-pressed', 'false')
  await map.focus()
  await page.keyboard.press('d')
  await expect(pen).toHaveAttribute('aria-pressed', 'true')
  await expect(map).toBeFocused()
  const bounds = (await map.boundingBox())!
  const x = bounds.x + bounds.width * 0.5
  const y = bounds.y + bounds.height * 0.45
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 55, y + 25, { steps: 15 })
  await page.mouse.up()
  await expect(count).toHaveText('1 drawing on this floor')
  await map.focus()
  await page.keyboard.press('l')
  await page.keyboard.press('+')
  await page.keyboard.press('r')
  await expect(count).toHaveText('1 drawing on this floor')
  await page.keyboard.press('f')
  await expect(page.getByRole('button', { name: /Lower floor.*switch to upper/ })).toBeVisible()
  await expect(count).toHaveText('0 drawings on this floor')
  await expect(clear).toBeHidden()
  await map.focus()
  await page.keyboard.press('f')
  await expect(count).toHaveText('1 drawing on this floor')
  await page.keyboard.press('ArrowRight')
  await expect(
    page.getByRole('button', { name: 'Choose round, current round 2', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play round', exact: true })).toBeEnabled()
  await expect(count).toHaveText('0 drawings on this floor')
  await map.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(
    page.getByRole('button', { name: 'Choose round, current round 1', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play round', exact: true })).toBeEnabled()
  await expect(count).toHaveText('1 drawing on this floor')
  await map.focus()
  await page.keyboard.press('Shift+D')
  await expect(count).toHaveText('0 drawings on this floor')
  await page.keyboard.press('d')
  await expect(pen).toHaveAttribute('aria-pressed', 'false')
})

test('drawing shortcuts preserve sliders and other popovers', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/replay?source=example&example=astralis-vs-mouz-m2-nuke&round=1')
  const pen = page.getByRole('button', { name: 'Draw on map', exact: true })
  const clear = page.getByRole('button', { name: 'Clear map drawings', exact: true })
  await expect(pen).toBeEnabled({ timeout: 30_000 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280)
  await expect(clear).toBeHidden()
  for (const control of [pen]) {
    const bounds = (await control.boundingBox())!
    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(1280)
  }
  await page.getByRole('slider', { name: 'Round timeline' }).focus()
  await page.keyboard.press('d')
  await expect(pen).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: 'Keyboard shortcuts', exact: true }).click()
  await page.keyboard.press('d')
  await expect(pen).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByText('Toggle drawing', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await pen.click()
  await expect(pen).toHaveAttribute('aria-pressed', 'true')
  await pen.click()
  await expect(pen).toHaveAttribute('aria-pressed', 'false')
})

test('clear cancels an unfinished stroke and pinch cancels touch drawing', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/replay?source=example&example=faze-vs-vitality-m2-dust2&round=1')
  const pen = page.getByRole('button', { name: 'Draw on map', exact: true })
  const count = page.getByLabel('Drawing count', { exact: true })
  const map = page.getByRole('img', { name: 'Dust II map', exact: true })
  await expect(pen).toBeEnabled({ timeout: 30_000 })
  await map.scrollIntoViewIfNeeded()
  await map.focus()
  await page.keyboard.press('d')
  const bounds = (await map.boundingBox())!
  const x = bounds.x + bounds.width / 2
  const y = bounds.y + bounds.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 30, y + 20, { steps: 5 })
  await page.keyboard.press('Shift+D')
  await page.mouse.up()
  await expect(count).toHaveText('0 drawings on this floor')
  await map.scrollIntoViewIfNeeded()
  const session = await page.context().newCDPSession(page)
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: x - 40, y, id: 1 }],
  })
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: x - 40, y, id: 1 },
      { x: x + 40, y, id: 2 },
    ],
  })
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { x: x - 80, y, id: 1 },
      { x: x + 80, y, id: 2 },
    ],
  })
  await expect(page.getByLabel('Map zoom', { exact: true })).toHaveText('180%')
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [{ x: x - 80, y, id: 1 }],
  })
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: x - 70, y: y + 20, id: 1 }],
  })
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect(count).toHaveText('0 drawings on this floor')
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y, id: 1 }],
  })
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: x + 20, y: y + 20, id: 1 }],
  })
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect(count).toHaveText('1 drawing on this floor')
})

for (const width of [1280, 1920]) {
  test(`drawing controls stay fixed when drawings appear and clear at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/replay?source=example&example=astralis-vs-mouz-m2-nuke&round=1')
    const pen = page.getByRole('button', { name: 'Draw on map', exact: true })
    const clear = page.getByRole('button', { name: 'Clear map drawings', exact: true })
    const shortcuts = page.getByRole('button', { name: 'Keyboard shortcuts', exact: true })
    const count = page.getByLabel('Drawing count', { exact: true })
    await expect(pen).toBeEnabled({ timeout: 30_000 })
    await expect(clear).toBeHidden()
    const penBounds = await pen.boundingBox()
    const shortcutsBounds = await shortcuts.boundingBox()
    await pen.click()
    await expect(clear).toBeHidden()
    const bounds = (await page.getByRole('img', { name: 'Nuke map', exact: true }).boundingBox())!
    const x = bounds.x + bounds.width / 2
    const y = bounds.y + bounds.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 50, y + 20, { steps: 10 })
    await page.mouse.up()
    await expect(count).toHaveText('1 drawing on this floor')
    await expect(clear).toBeVisible()
    expect(await pen.boundingBox()).toEqual(penBounds)
    expect(await shortcuts.boundingBox()).toEqual(shortcutsBounds)
    await clear.focus()
    await page.keyboard.press('Enter')
    await expect(count).toHaveText('0 drawings on this floor')
    await expect(clear).toBeHidden()
    await expect(pen).toBeFocused()
    expect(await pen.boundingBox()).toEqual(penBounds)
    expect(await shortcuts.boundingBox()).toEqual(shortcutsBounds)
    await shortcuts.click()
    await expect(page.getByText('Toggle drawing', { exact: true })).toBeVisible()
  })
}
