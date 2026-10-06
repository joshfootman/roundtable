import { expect, test } from '@playwright/test'
import { examples } from '../src/demo/examples'

test('zooms, drags and focuses a paused map while retaining zoom across floors and rounds', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/replay?source=example&example=astralis-vs-mouz-m2-nuke&round=1')
  const zoomIn = page.getByRole('button', { name: 'Zoom in', exact: true })
  const zoomOut = page.getByRole('button', { name: 'Zoom out', exact: true })
  const focus = page.getByRole('button', { name: 'Focus map', exact: true })
  const zoom = page.getByLabel('Map zoom', { exact: true })
  const timeline = page.getByRole('slider', { name: 'Round timeline' })
  await expect(zoomIn).toBeEnabled({ timeout: 30_000 })
  await expect(zoomOut).toBeEnabled()
  const tick = await timeline.inputValue()
  await zoomIn.click()
  await expect(zoom).toHaveText('113%')
  const map = page.getByRole('img', { name: 'Nuke map', exact: true })
  const bounds = (await map.boundingBox())!
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  await page.mouse.wheel(0, -200)
  await expect(zoom).toHaveText('168%')
  await page.mouse.down()
  await expect(map).toHaveClass(/cursor-grabbing/)
  await page.mouse.move(bounds.x + bounds.width / 2 + 100, bounds.y + bounds.height / 2 + 80, {
    steps: 5,
  })
  await page.mouse.up()
  await expect(map).toHaveClass(/cursor-grab(?:\s|$)/)
  await testInfo.attach('panned-map', { body: await map.screenshot(), contentType: 'image/png' })
  await expect(timeline).toHaveValue(tick)
  await page.getByRole('button', { name: /Upper floor.*switch to lower/ }).click()
  await expect(zoom).toHaveText('168%')
  await expect(timeline).toHaveValue(tick)
  await page.getByRole('button', { name: 'Next round', exact: true }).click()
  await expect(zoomIn).toBeEnabled()
  await expect(zoom).toHaveText('168%')
  const nextTick = await timeline.inputValue()
  await map.focus()
  await map.press('+')
  await expect(zoom).toHaveText('210%')
  await map.press('Shift+ArrowRight')
  await expect(timeline).toHaveValue(nextTick)
  await map.press('Home')
  await expect(zoom).toHaveText('90%')
  for (let i = 0; i < 7; i++) await zoomIn.click()
  await expect(zoom).toHaveText('400%')
  await expect(zoomIn).toBeDisabled()
  await focus.click()
  await expect(zoom).toHaveText('90%')
  await expect(zoomOut).toBeEnabled()
  await zoomOut.click()
  await zoomOut.click()
  await expect(zoom).toHaveText('60%')
  await expect(zoomOut).toBeDisabled()
  await focus.click()
  await expect(zoom).toHaveText('90%')
  await expect(timeline).toHaveValue(nextTick)
  await expect(page.getByRole('button', { name: 'Play round', exact: true })).toBeEnabled()
})

test('pinches on touch screens without changing playback or overflowing the phone layout', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/replay?source=example&example=faze-vs-vitality-m2-dust2&round=1')
  const zoom = page.getByLabel('Map zoom', { exact: true })
  await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeEnabled({
    timeout: 30_000,
  })
  const timeline = page.getByRole('slider', { name: 'Round timeline' })
  const tick = await timeline.inputValue()
  const map = page.getByRole('img', { name: 'Dust II map', exact: true })
  await map.scrollIntoViewIfNeeded()
  const bounds = (await map.boundingBox())!
  const session = await page.context().newCDPSession(page)
  const x = bounds.x + bounds.width / 2
  const y = bounds.y + bounds.height / 2
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
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect(zoom).toHaveText('180%')
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y, id: 1 }],
  })
  await expect(map).toHaveClass(/cursor-grabbing/)
  await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
  await expect(zoom).toHaveText('180%')
  await expect(timeline).toHaveValue(tick)
  await expect(map).toHaveClass(/cursor-grab(?:\s|$)/)
  await page.getByRole('button', { name: 'Focus map', exact: true }).click()
  await expect(zoom).toHaveText('90%')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('camera controls work on every curated map without seeking playback', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  const maps = [
    ...new Map(Object.values(examples).map((example) => [example.map, example])).values(),
  ]
  expect(maps).toHaveLength(10)
  for (const example of maps) {
    await test.step(example.mapName, async () => {
      await page.goto(`/replay?source=example&example=${example.id}&round=1`)
      const zoomIn = page.getByRole('button', { name: 'Zoom in', exact: true })
      const focus = page.getByRole('button', { name: 'Focus map', exact: true })
      const zoom = page.getByLabel('Map zoom', { exact: true })
      const timeline = page.getByRole('slider', { name: 'Round timeline' })
      await expect(zoomIn).toBeEnabled({ timeout: 30_000 })
      await expect(zoom).toHaveText('90%')
      const tick = await timeline.inputValue()
      const map = page.getByRole('img', { name: `${example.mapName} map`, exact: true })
      const bounds = (await map.boundingBox())!
      const x = bounds.x + bounds.width / 2
      const y = bounds.y + bounds.height * 0.45
      await page.mouse.move(x, y)
      await page.mouse.down()
      await expect(map).toHaveClass(/cursor-grabbing/)
      await page.mouse.move(x + 80, y, { steps: 4 })
      await page.mouse.up()
      await map.press('Shift+ArrowLeft')
      await expect(zoom).toHaveText('90%')
      await page.mouse.wheel(0, -100)
      await expect(zoom).toHaveText('110%')
      await map.press('+')
      await expect(zoom).toHaveText('137%')
      const floor = page.getByRole('button', { name: /floor.*switch/ })
      if (await floor.count()) {
        const label = await floor.getAttribute('aria-label')
        await floor.click()
        await expect(floor).not.toHaveAttribute('aria-label', label!)
        await expect(zoom).toHaveText('137%')
      }
      await testInfo.attach(`${example.map}-panned`, {
        body: await map.screenshot(),
        contentType: 'image/png',
      })
      await expect(timeline).toHaveValue(tick)
      await focus.click()
      await expect(zoom).toHaveText('90%')
      await expect(page.getByRole('button', { name: 'Zoom out', exact: true })).toBeEnabled()
      await expect(timeline).toHaveValue(tick)
      await expect(page.getByRole('button', { name: 'Play round', exact: true })).toBeEnabled()
    })
  }
})
