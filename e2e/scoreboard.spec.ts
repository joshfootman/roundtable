import { expect, test } from '@playwright/test'

test('centres the HUD and supports keyboard round selection with restored focus', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/replay?source=example&round=1')
  await expect(page.getByRole('button', { name: 'Play round' })).toBeEnabled({ timeout: 30_000 })
  const hud = page.getByRole('region', { name: 'Round controls' })
  await expect(hud.getByText('Vitality', { exact: true })).toBeVisible()
  await expect(hud.getByText('FaZe Clan', { exact: true })).toBeVisible()
  await expect(hud.locator('img')).toHaveCount(2)
  const stage = await page.locator('.demo-stage').boundingBox()
  const bounds = await hud.boundingBox()
  expect(Math.abs(bounds!.x + bounds!.width / 2 - stage!.x - stage!.width / 2)).toBeLessThan(2)
  const clock = await hud
    .getByRole('button', { name: 'Choose round, current round 1' })
    .boundingBox()
  const leftScore = await hud.getByLabel('Counter-Terrorist score').boundingBox()
  const rightScore = await hud.getByLabel('Terrorist score', { exact: true }).boundingBox()
  const previous = await hud.getByRole('button', { name: 'Previous round' }).boundingBox()
  const next = await hud.getByRole('button', { name: 'Next round' }).boundingBox()
  expect(Math.abs(clock!.x + clock!.width / 2 - bounds!.x - bounds!.width / 2)).toBeLessThan(1)
  expect(previous!.height).toBe(clock!.height)
  expect(next!.height).toBe(clock!.height)
  expect(previous!.width).toBe(next!.width)
  expect(leftScore!.width).toBe(72)
  expect(rightScore!.width).toBe(72)
  expect(leftScore!.height - clock!.height).toBe(16)
  expect(leftScore!.y).toBe(clock!.y)
  expect(rightScore!.y).toBe(clock!.y)
  expect(previous!.x + previous!.width + 8).toBeLessThan(leftScore!.x)
  expect(next!.x - 8).toBeGreaterThan(rightScore!.x + rightScore!.width)
  expect((await hud.locator('img').first().boundingBox())!.width).toBe(36)

  const trigger = page.getByRole('button', { name: 'Choose round, current round 1' })
  await trigger.focus()
  await trigger.press('Enter')
  const picker = page.getByRole('dialog', { name: 'Select round' })
  await expect(picker).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(picker).toBeHidden()
  await expect(trigger).toBeFocused()
  await trigger.click()
  await picker.getByRole('button', { name: /^Round 13,/ }).click()
  await expect(page.getByRole('button', { name: 'Choose round, current round 13' })).toBeFocused()
  await expect(picker).toBeHidden()
  await expect(page.getByRole('button', { name: 'Play round' })).toBeEnabled()
  await expect(hud.locator('img').first()).toHaveAttribute('src', '/images/teams/faze.svg')
  await page.goto('/replay?source=example&example=faze-vs-natus-vincere-m1-ancient&round=1')
  await expect(page.getByRole('button', { name: 'Play round' })).toBeEnabled({ timeout: 30_000 })
  const clan = hud.getByText('Natus Vincere', { exact: true })
  await expect(clan).toBeVisible()
  expect(await clan.evaluate((element) => getComputedStyle(element).whiteSpace)).toBe('nowrap')
  expect(await clan.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
})

test('lists rounds in one scrollable column and reopens at the selected round', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/replay?source=example&round=1')
  await expect(page.getByRole('button', { name: 'Play round' })).toBeEnabled({ timeout: 30_000 })
  const firstTrigger = page.getByRole('button', { name: 'Choose round, current round 1' })
  await firstTrigger.click()
  const picker = page.getByRole('dialog', { name: 'Select round' })
  await expect(picker).toBeVisible()
  await expect(picker.getByRole('heading')).toHaveCount(0)
  await expect(picker.getByRole('button', { name: 'Close round picker' })).toHaveCount(0)
  const cards = picker.getByRole('button')
  await expect(cards).toHaveCount(23)
  const first = (await cards.nth(0).boundingBox())!
  const second = (await cards.nth(1).boundingBox())!
  expect(second.x).toBe(first.x)
  expect(second.width).toBe(first.width)
  expect(second.y).toBeGreaterThanOrEqual(first.y + first.height)
  expect(await picker.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true)
  const last = cards.last()
  const lastNumber = 23
  await last.scrollIntoViewIfNeeded()
  const viewport = (await picker.boundingBox())!
  const lastBounds = (await last.boundingBox())!
  expect(lastBounds.y).toBeGreaterThanOrEqual(viewport.y)
  expect(lastBounds.y + lastBounds.height).toBeLessThanOrEqual(viewport.y + viewport.height)
  await last.click()
  const trigger = page.getByRole('button', { name: `Choose round, current round ${lastNumber}` })
  await expect(trigger).toBeFocused()
  await expect(picker).toBeHidden()
  await trigger.click()
  const current = picker.locator('[aria-current="step"]')
  await expect(current).toBeFocused()
  const reopened = (await picker.boundingBox())!
  const selected = (await current.boundingBox())!
  expect(selected.y).toBeGreaterThanOrEqual(reopened.y)
  expect(selected.y + selected.height).toBeLessThanOrEqual(reopened.y + reopened.height)
  await current.click()
  await expect(picker).toBeHidden()
  await expect(trigger).toBeFocused()
  await trigger.click()
  await page.keyboard.press('Escape')
  await expect(picker).toBeHidden()
  await expect(trigger).toBeFocused()
  await trigger.click()
  await page.locator('header').click({ position: { x: 2, y: 2 } })
  await expect(picker).toBeHidden()
})

test('fits the HUD and round picker on a narrow phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await page.goto('/replay?source=example&round=1')
  await expect(page.getByRole('button', { name: 'Play round' })).toBeEnabled({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Choose round, current round 1' }).click()
  const picker = page.getByRole('dialog', { name: 'Select round' })
  await expect(picker).toBeVisible()
  const bounds = await picker.boundingBox()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  await picker.getByRole('button', { name: /^Round 5,/ }).click()
  await expect(page.getByRole('button', { name: 'Choose round, current round 5' })).toBeFocused()
  await expect(picker).toBeHidden()
})

test('briefly highlights the next round only after a played outcome, with a static reduced-motion cue', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    await page.emulateMedia({ reducedMotion })
    await page.goto('/replay?source=example&round=1')
    const play = page.getByRole('button', { name: 'Play round', exact: true })
    await expect(play).toBeEnabled({ timeout: 30_000 })
    const timeline = page.getByRole('slider', { name: 'Round timeline' })
    const next = page.getByRole('button', { name: 'Next round', exact: true })
    const hint = next.locator('.demo-next-round-hint')
    await timeline.press('End')
    await expect(hint).toHaveCount(0)
    // The independent Dust II reference records round one's result at tick 7834.
    const minimum = Number(await timeline.getAttribute('min'))
    const maximum = Number(await timeline.getAttribute('max'))
    const bounds = (await timeline.boundingBox())!
    await timeline.click({
      position: {
        x: 5 + ((7834 - 128 - minimum) / (maximum - minimum)) * (bounds.width - 10),
        y: bounds.height / 2,
      },
    })
    await expect(hint).toHaveCount(0)
    await play.click()
    await expect(hint).toHaveCount(1, { timeout: 10_000 })
    await expect(hint).toHaveCSS(
      'animation-name',
      reducedMotion === 'reduce' ? 'none' : 'demo-next-round-hint',
    )
    if (reducedMotion === 'reduce') {
      await expect(hint).toHaveCSS('opacity', '0.7')
    }
    await expect(hint).toHaveCount(0, { timeout: 5_000 })
    await next.click()
    await expect(page.getByRole('button', { name: 'Choose round, current round 2' })).toBeVisible()
  }
})
