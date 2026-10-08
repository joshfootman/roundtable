import { expect, test } from '@playwright/test'

test('reconstructs blue and orange score flames from recorded wins and seeks', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/replay?source=example&round=5')
  await expect(page.getByRole('button', { name: 'Play round', exact: true })).toBeEnabled({
    timeout: 30_000,
  })
  const ct = page.getByLabel('Counter-Terrorist score', { exact: true })
  const t = page.getByLabel('Terrorist score', { exact: true })
  const timeline = page.getByRole('slider', { name: 'Round timeline' })
  await expect(ct.locator('canvas')).toHaveCount(0)
  await timeline.press('End')
  await expect(ct).toContainText('5 consecutive round wins')
  await expect(ct.locator('canvas')).toHaveCount(1)
  await ct.locator('canvas').evaluate((canvas) => {
    const gl = (canvas as HTMLCanvasElement).getContext('webgl')!
    const original = gl.drawArrays.bind(gl)
    const state = { draws: 0, gl }
    ;(window as unknown as { flameProbe: typeof state }).flameProbe = state
    gl.drawArrays = (...args) => {
      state.draws++
      original(...args)
    }
  })
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { flameProbe: { draws: number } }).flameProbe.draws,
      ),
    )
    .toBeGreaterThan(1)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  const hiddenDraws = await page.evaluate(
    () => (window as unknown as { flameProbe: { draws: number } }).flameProbe.draws,
  )
  await page.waitForTimeout(150)
  expect(
    await page.evaluate(
      () => (window as unknown as { flameProbe: { draws: number } }).flameProbe.draws,
    ),
  ).toBe(hiddenDraws)
  await page.evaluate(() => {
    delete (document as unknown as { hidden?: boolean }).hidden
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { flameProbe: { draws: number } }).flameProbe.draws,
      ),
    )
    .toBeGreaterThan(hiddenDraws)
  const frame = await ct.screenshot()
  await expect.poll(async () => (await ct.screenshot()).equals(frame)).toBe(false)
  await page.screenshot({ path: '.audit/winning-streaks/ct-desktop.png' })
  await timeline.press('Home')
  await expect(ct.locator('canvas')).toHaveCount(0)
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as unknown as { flameProbe: { gl: WebGLRenderingContext } }
        ).flameProbe.gl.isContextLost(),
      ),
    )
    .toBe(true)
  await page.goto('/replay?source=example&round=7')
  await expect(page.getByRole('button', { name: 'Play round', exact: true })).toBeEnabled({
    timeout: 30_000,
  })
  await expect(ct).toContainText('6 consecutive round wins')
  await timeline.press('End')
  await expect(ct.locator('canvas')).toHaveCount(0)
  await expect(t.locator('canvas')).toHaveCount(0)
  await page.goto('/replay?source=example&round=11')
  await expect(page.getByRole('button', { name: 'Play round', exact: true })).toBeEnabled({
    timeout: 30_000,
  })
  await expect(page.getByRole('button', { name: 'Choose round, current round 11' })).toBeVisible()
  await timeline.press('End')
  await expect(t).toContainText('5 consecutive round wins')
  await page.screenshot({ path: '.audit/winning-streaks/t-desktop.png' })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect
    .poll(async () => {
      const first = await t.screenshot()
      return (await t.screenshot()).equals(first)
    })
    .toBe(true)
  await page.setViewportSize({ width: 390, height: 844 })
  expect((await t.boundingBox())!.width).toBe(44)
  await page.screenshot({ path: '.audit/winning-streaks/t-mobile-reduced.png', fullPage: true })
  await t.locator('canvas').evaluate((canvas) => {
    const gl = (canvas as HTMLCanvasElement).getContext('webgl')!
    gl.getExtension('WEBGL_lose_context')!.loseContext()
  })
  await expect(t.locator('svg')).toBeVisible()
})

test('retains a static flame when WebGL is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args) {
      if (args[0] === 'webgl') return null
      return Reflect.apply(original, this, args)
    } as typeof original
  })
  await page.goto('/replay?source=example&round=6')
  await expect(page.getByRole('button', { name: 'Play round', exact: true })).toBeEnabled({
    timeout: 30_000,
  })
  const ct = page.getByLabel('Counter-Terrorist score', { exact: true })
  await expect(ct.locator('svg')).toBeVisible()
  await expect(ct).toContainText('5 consecutive round wins')
})
