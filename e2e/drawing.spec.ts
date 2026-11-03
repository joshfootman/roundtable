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
  await expect(clear).toBeVisible()
  await expect(clear).toHaveAttribute('aria-disabled', 'true')
  await map.focus()
  await page.keyboard.press('f')
  await expect(count).toHaveText('1 drawing on this floor')
  await page.keyboard.press('ArrowRight')
  await expect(
    page.getByRole('button', { name: 'Choose round, current round 2', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pause round', exact: true })).toBeEnabled()
  await expect(count).toHaveText('0 drawings on this floor')
  await map.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(
    page.getByRole('button', { name: 'Choose round, current round 1', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pause round', exact: true })).toBeEnabled()
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
    await expect(clear).toBeVisible()
    await expect(clear).toHaveAttribute('aria-disabled', 'true')
    await page.keyboard.press('Tab')
    await expect(clear).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(shortcuts).toBeFocused()
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
    await expect(clear).toBeVisible()
    await expect(clear).toHaveAttribute('aria-disabled', 'true')
    await expect(clear).toBeFocused()
    expect(await pen.boundingBox()).toEqual(penBounds)
    expect(await shortcuts.boundingBox()).toEqual(shortcutsBounds)
    await shortcuts.click()
    await expect(page.getByText('Toggle drawing', { exact: true })).toBeVisible()
  })
}

test('drawing lobe morphs continuously on open, close and an interrupted close', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/replay?source=example&example=astralis-vs-mouz-m2-nuke&round=1')
  const pen = page.getByRole('button', { name: 'Draw on map', exact: true })
  const controls = page.getByRole('region', { name: 'Playback controls' })
  const silhouette = () => controls.evaluate((bar) => getComputedStyle(bar, '::before').clipPath)
  // Toggling inside the sample keeps a slow test runner from letting the transition finish first.
  const sampleMorph = (fraction: number, toggle = false) =>
    controls.evaluate(
      async (bar, { fraction, toggle }) => {
        if (toggle) bar.querySelector<HTMLElement>('[aria-label="Draw on map"]')!.click()
        await new Promise(requestAnimationFrame)
        const morph = bar
          .getAnimations()
          .find(
            (animation) =>
              animation instanceof CSSTransition &&
              animation.transitionProperty === '--drawing-lift',
          )
        if (!morph?.effect) throw new Error('Expected a running drawing silhouette transition')
        morph.pause()
        const duration = Number(morph.effect.getTiming().duration)
        morph.currentTime = duration * fraction
        return {
          silhouette: getComputedStyle(bar, '::before').clipPath,
          lift: Number.parseFloat(getComputedStyle(bar).getPropertyValue('--drawing-lift')),
          duration,
        }
      },
      { fraction, toggle },
    )
  await expect(pen).toBeEnabled({ timeout: 30_000 })
  const closed = await silhouette()
  const opening = await sampleMorph(0.25, true)
  const open = await sampleMorph(1)
  expect(opening.duration).toBe(500)
  expect(opening.silhouette).not.toBe(closed)
  expect(opening.silhouette).not.toBe(open.silhouette)
  expect((await sampleMorph(0, true)).silhouette).toBe(open.silhouette)
  const earlyClose = await sampleMorph(0.25)
  expect(earlyClose.duration).toBe(250)
  // A quarter of the way in, the lobe should still be mostly raised, without the old initial snap.
  expect(earlyClose.lift).toBeGreaterThan(open.lift * 0.75)
  expect(earlyClose.lift).toBeLessThan(open.lift)
  const closing = await sampleMorph(0.5)
  expect(closing.silhouette).not.toBe(open.silhouette)
  expect(closing.silhouette).not.toBe(closed)
  expect((await sampleMorph(0, true)).silhouette).toBe(closing.silhouette)
  expect((await sampleMorph(1)).silhouette).toBe(open.silhouette)
  expect((await sampleMorph(1, true)).silhouette).toBe(closed)
})

test('reduced motion fades the drawing bin without travel and restores focus on close', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/replay?source=example&example=astralis-vs-mouz-m2-nuke&round=1')
  const pen = page.getByRole('button', { name: 'Draw on map', exact: true })
  const clear = page.getByRole('button', { name: 'Clear map drawings', exact: true })
  const shortcuts = page.getByRole('button', { name: 'Keyboard shortcuts', exact: true })
  const lobe = page.locator('.demo-drawing-clear')
  const controls = page.getByRole('region', { name: 'Playback controls' })
  await expect(pen).toBeEnabled({ timeout: 30_000 })
  await pen.click()
  await expect(clear).toBeVisible()
  await expect(clear).toHaveAttribute('aria-disabled', 'true')
  await clear.focus()
  await page.keyboard.press('d')
  await expect(pen).toHaveAttribute('aria-pressed', 'false')
  await expect(pen).toBeFocused()
  await expect(lobe).toHaveAttribute('inert', '')
  await expect(lobe).toHaveAttribute('aria-hidden', 'true')
  await expect(lobe).toHaveCSS('transform', 'none')
  expect(await controls.evaluate((bar) => bar.getAnimations().length)).toBe(0)
  await page.keyboard.press('Tab')
  await expect(shortcuts).toBeFocused()
  await expect(lobe).toHaveCSS('opacity', '0')
  await pen.click()
  const fade = await lobe.evaluate((element) => {
    const animation = element
      .getAnimations()
      .find(
        (animation) =>
          animation instanceof CSSTransition && animation.transitionProperty === 'opacity',
      )
    if (!animation?.effect) throw new Error('Expected a brief opacity fade')
    animation.pause()
    const duration = Number(animation.effect.getTiming().duration)
    animation.currentTime = duration / 2
    return {
      duration,
      opacity: Number(getComputedStyle(element).opacity),
      transform: getComputedStyle(element).transform,
    }
  })
  expect(fade.duration).toBeLessThanOrEqual(200)
  expect(fade.opacity).toBeGreaterThan(0)
  expect(fade.opacity).toBeLessThan(1)
  expect(fade.transform).toBe('none')
})
