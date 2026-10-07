import { expect, test } from '@playwright/test'

test('playback shortcuts seek, toggle, switch rounds and control the map', async ({ page }) => {
  await page.goto('/replay?source=example&example=astralis-vs-mouz-m2-nuke&round=1')
  const timeline = page.getByRole('slider', { name: 'Round timeline' })
  const map = page.getByRole('img', { name: 'Nuke map', exact: true })
  const zoom = page.getByLabel('Map zoom', { exact: true })
  await expect(page.getByRole('button', { name: 'Play round', exact: true })).toBeEnabled({
    timeout: 30_000,
  })
  const minimum = Number(await timeline.getAttribute('min'))
  const maximum = Number(await timeline.getAttribute('max'))
  await map.focus()
  await page.keyboard.press('l')
  const tenSeconds = Number(await timeline.inputValue()) - minimum
  expect(tenSeconds).toBeGreaterThan(0)
  await page.keyboard.press('l')
  expect(Number(await timeline.inputValue()) - minimum).toBe(tenSeconds * 2)
  await page.keyboard.press('j')
  expect(Number(await timeline.inputValue()) - minimum).toBe(tenSeconds)
  await page.keyboard.press('j')
  await page.keyboard.press('j')
  await expect(timeline).toHaveValue(String(minimum))
  for (let digit = 0; digit < 10; digit++) {
    await page.keyboard.press(String(digit))
    await expect(timeline).toHaveValue(
      String(Math.floor(minimum + ((maximum - minimum) * digit) / 10)),
    )
  }
  await page.keyboard.press('0')
  await page.keyboard.press('k')
  await expect(page.getByRole('button', { name: 'Pause round', exact: true })).toBeVisible()
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: 'Play round', exact: true })).toBeVisible()
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: 'Pause round', exact: true })).toBeVisible()
  await page.keyboard.press('k')
  const pausedTick = await timeline.inputValue()
  await page.keyboard.press('f')
  await expect(page.getByRole('button', { name: /Lower floor.*switch to upper/ })).toBeVisible()
  await expect(timeline).toHaveValue(pausedTick)
  await page.keyboard.press('+')
  await expect(zoom).toHaveText('113%')
  await page.keyboard.press('-')
  await expect(zoom).toHaveText('90%')
  await page.keyboard.press('+')
  await page.keyboard.press('r')
  await expect(zoom).toHaveText('90%')
  await page.keyboard.press('ArrowRight')
  await expect(
    page.getByRole('button', { name: 'Choose round, current round 2', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play round', exact: true })).toBeEnabled()
  await expect(
    page.getByRole('button', { name: 'Choose round, current round 2', exact: true }),
  ).not.toBeFocused()
  await map.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(
    page.getByRole('button', { name: 'Choose round, current round 1', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play round', exact: true })).toBeEnabled()
  const pickerTrigger = page.getByRole('button', {
    name: 'Choose round, current round 1',
    exact: true,
  })
  await expect(pickerTrigger).not.toBeFocused()
  await page.getByRole('button', { name: 'Next round', exact: true }).focus()
  await page.keyboard.press('Shift+Tab')
  await expect(pickerTrigger).toBeFocused()
  await map.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(
    page.getByRole('button', { name: 'Choose round, current round 1', exact: true }),
  ).toBeVisible()
})

test('shortcuts preserve focused controls and popovers and provide help', async ({ page }) => {
  await page.goto('/replay?source=example&example=faze-vs-vitality-m2-dust2&round=1')
  const timeline = page.getByRole('slider', { name: 'Round timeline' })
  const map = page.getByRole('img', { name: 'Dust II map', exact: true })
  await expect(page.getByRole('button', { name: 'Play round', exact: true })).toBeEnabled({
    timeout: 30_000,
  })
  const opening = await timeline.inputValue()
  await timeline.focus()
  await page.keyboard.press('ArrowRight')
  expect(Number(await timeline.inputValue())).toBe(Number(opening) + 1)
  await expect(
    page.getByRole('button', { name: 'Choose round, current round 1', exact: true }),
  ).toBeVisible()
  const tick = await timeline.inputValue()
  await page.keyboard.press('k')
  await page.keyboard.press('9')
  await expect(timeline).toHaveValue(tick)
  await expect(page.getByRole('button', { name: 'Play round', exact: true })).toBeVisible()
  await map.focus()
  await page.keyboard.press('Control+l')
  await expect(timeline).toHaveValue(tick)
  await page.getByRole('button', { name: 'Choose round, current round 1', exact: true }).click()
  const picker = page.getByRole('dialog', { name: 'Select round' })
  await expect(picker).toBeVisible()
  await page.keyboard.press('l')
  await page.keyboard.press('ArrowRight')
  await expect(timeline).toHaveValue(tick)
  await expect(
    page.getByRole('button', { name: 'Choose round, current round 1', exact: true }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(picker).toBeHidden()
  await map.focus()
  await expect(map).toBeFocused()
  await page.keyboard.press('?')
  const help = page.getByRole('dialog', { name: 'Keyboard shortcuts' })
  await expect(help).toBeVisible()
  await expect(help.getByText('Jump to 0–90% of the round')).toBeVisible()
  await page.keyboard.press('k')
  await expect(page.getByRole('button', { name: 'Play round', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(help).not.toBeVisible()
  await page.getByRole('button', { name: 'Keyboard shortcuts', exact: true }).focus()
  await page.keyboard.press('Space')
  await expect(help).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play round', exact: true })).toBeVisible()
})
