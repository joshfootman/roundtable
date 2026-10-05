import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { expect, test } from '@playwright/test'

async function demoFile() {
  return {
    name: 'dust2.dem',
    mimeType: 'application/octet-stream',
    buffer: gunzipSync(
      await readFile(new URL('../fixtures/replay/dust2-first-round.dem.gz', import.meta.url)),
    ),
  }
}

test('imports and plays a local recording on the home workspace', async ({ page }) => {
  await page.goto('/')
  await page.locator('input[type=file]').setInputFiles(await demoFile())
  await expect(page.getByText('dust2.dem', { exact: true })).toBeVisible()
  const play = page.getByRole('button', { name: 'Play round', exact: true })
  await expect(play).toBeEnabled({ timeout: 15_000 })
  await expect(page.locator('canvas')).toHaveCount(1)
  const timeline = page.getByRole('slider', { name: 'Round timeline' })
  const initial = await timeline.inputValue()
  await play.click()
  const pause = page.getByRole('button', { name: 'Pause round', exact: true })
  await expect(pause).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => timeline.inputValue()).not.toBe(initial)
  await pause.click()
  await expect(play).toHaveAttribute('aria-pressed', 'false')
  await timeline.focus()
  await timeline.press('End')
  await expect(timeline).toHaveValue((await timeline.getAttribute('max'))!)
  await timeline.press('Home')
  await expect(timeline).toHaveValue((await timeline.getAttribute('min'))!)
  await expect(page.getByRole('button', { name: 'Previous round' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Next round' })).toBeDisabled()
  await expect(page).toHaveURL(/\/$/)
})

test('reports invalid files and recovers through the same chooser', async ({ page }) => {
  await page.goto('/')
  const input = page.locator('input[type=file]')
  await input.setInputFiles({
    name: 'archive.dem',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  })
  await expect(page.getByText('Demo import failed.', { exact: true })).toBeAttached()
  await expect(page.getByText(/ZIP.*Extract.*\.dem/i)).toBeAttached()
  await expect(page.locator('canvas')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Example demos' }).getByRole('button')).toHaveCount(
    12,
  )
  await input.setInputFiles(await demoFile())
  await expect(page.getByRole('button', { name: 'Play round' })).toBeEnabled({
    timeout: 15_000,
  })
  await expect(page.getByText(/ZIP.*Extract.*\.dem/i)).toHaveCount(0)
  await expect(page.getByText('dust2.dem', { exact: true })).toBeVisible()
})

test('restores example rounds on the shared replay workspace', async ({ page }) => {
  await page.goto('/replay?source=example&round=2')
  const navigation = page.getByRole('navigation', { name: 'Round navigation' })
  await expect(navigation.getByText('Round 2', { exact: true })).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByRole('button', { name: 'Play round' })).toBeEnabled()
  await page.getByRole('button', { name: 'Next round' }).click()
  await expect(navigation.getByText('Round 3', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Previous round' }).click()
  await expect(navigation.getByText('Round 2', { exact: true })).toBeVisible()
  await page.reload()
  await expect(navigation.getByText('Round 2', { exact: true })).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.locator('canvas')).toHaveCount(1)
  await page.goto('/replay?source=local&round=2')
  await expect(page.getByText('No demo chosen', { exact: true })).toBeVisible()
  await expect(page.locator('canvas')).toHaveCount(0)
})

test('shows twelve real match cards and starts a recording from the keyboard', async ({ page }) => {
  await page.goto('/')
  const catalog = page.getByRole('region', { name: 'Example demos' })
  await expect(catalog.getByRole('button')).toHaveCount(12)
  const images = catalog.locator('img')
  await expect(images).toHaveCount(36)
  for (const card of await catalog.getByRole('button').all()) {
    await card.scrollIntoViewIfNeeded()
    await expect
      .poll(() =>
        card
          .locator('img')
          .evaluateAll((elements) =>
            elements.every(
              (element) =>
                element instanceof HTMLImageElement && element.complete && element.naturalWidth > 0,
            ),
          ),
      )
      .toBe(true)
  }
  const dust2 = catalog.getByRole('button', {
    name: 'Play FaZe vs Vitality, Dust II, BLAST Premier Spring Final 2024, map 2',
    exact: true,
  })
  await dust2.focus()
  await expect(dust2).toBeFocused()
  await page.keyboard.press('Enter')
  const pause = page.getByRole('button', { name: 'Pause round', exact: true })
  await expect(pause).toBeEnabled({ timeout: 30_000 })
  await expect(catalog).toHaveCount(0)
  await expect(page.locator('canvas')).toHaveCount(1)
  const timeline = page.getByRole('slider', { name: 'Round timeline' })
  const initial = await timeline.inputValue()
  await expect.poll(() => timeline.inputValue()).not.toBe(initial)
  await pause.click()
})

test('plays a distinct example and keeps the catalog within a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  const catalog = page.getByRole('region', { name: 'Example demos' })
  await expect(catalog.getByRole('button')).toHaveCount(12)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
  await catalog
    .getByRole('button', {
      name: 'Play FaZe vs Natus Vincere, Ancient, PGL CS2 Major Copenhagen 2024, map 1',
      exact: true,
    })
    .click()
  await expect(page.getByRole('button', { name: 'Pause round', exact: true })).toBeEnabled({
    timeout: 30_000,
  })
  await expect(catalog).toHaveCount(0)
  await expect(page.locator('canvas')).toHaveCount(1)
})
