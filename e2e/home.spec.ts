import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import type { Route } from '@playwright/test'

async function demoFile() {
  if (process.env.DEMO_PATH) return resolve(process.env.DEMO_PATH)
  return {
    name: 'dust2.dem',
    mimeType: 'application/octet-stream',
    buffer: await readFile(new URL('../fixtures/metadata/dust2-metadata.bin', import.meta.url)),
  }
}

test('imports recording metadata through the keyboard-accessible file chooser', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'ROUNDTABLE CS2 DEMO VIEWER' }).focus()
  await page.keyboard.press('Tab')
  const input = page.getByLabel('Choose a .dem file')
  await expect(input).toBeFocused()
  const chooser = page.waitForEvent('filechooser')
  await page.keyboard.press('Enter')
  await (await chooser).setFiles(await demoFile())
  await expect(page.getByRole('status')).toBeEmpty()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Import demo' })).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(page.getByRole('status')).toHaveText('Demo metadata loaded.')
  await expect(page.getByRole('heading', { name: 'Dust II', exact: true })).toBeVisible()
  const metadata = page.getByRole('region', { name: 'Dust II', exact: true })
  for (const value of [
    'de_dust2',
    'BLAST Premier 2024',
    'SourceTV Demo',
    '51m 18.25s',
    '197,008',
    '197,003',
    '14011',
    '10072',
    'valve_demo_2',
  ]) {
    await expect(metadata.getByRole('definition').filter({ hasText: value })).toHaveText(value)
  }
})

test('recovers from an invalid file with a fresh import', async ({ page }) => {
  await page.goto('/')
  const input = page.getByLabel('Choose a .dem file')
  await input.setInputFiles({
    name: 'not-a-demo.dem',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('This is not a CS2 demo file.'),
  })
  await page.getByRole('button', { name: 'Import demo' }).click()
  await expect(page.getByRole('alert')).toContainText('Select a raw CS2 .dem file')
  await input.setInputFiles(await demoFile())
  await page.getByRole('button', { name: 'Import demo' }).click()
  await expect(page.getByRole('heading', { name: 'Dust II', exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('keeps imported metadata readable on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  await page.getByLabel('Choose a .dem file').setInputFiles(await demoFile())
  await page.getByRole('button', { name: 'Import demo' }).click()
  await expect(page.getByRole('heading', { name: 'Dust II', exact: true })).toBeVisible()
  await expect(page.getByText('BLAST Premier 2024', { exact: true })).toBeVisible()
  const widths = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }))
  expect(widths.content).toBeLessThanOrEqual(widths.viewport)
})

test('can submit another demo while an earlier import is pending', async ({ page }) => {
  let capture: (route: Route) => void
  const pending = new Promise<Route>((resolve) => {
    capture = resolve
  })
  let first = true
  await page.route(/\/metadata\.worker-[^/]+\.js(?:\?.*)?$/, (route) => {
    if (first) {
      first = false
      capture(route)
      return
    }
    return route.continue()
  })
  await page.goto('/')
  const input = page.getByLabel('Choose a .dem file')
  const submit = page.getByRole('button', { name: 'Import demo' })
  await input.setInputFiles({
    name: 'pending.dem',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('An unfinished import'),
  })
  await submit.click()
  const held = await pending
  try {
    await expect(page.getByRole('status')).toHaveText('Reading pending.dem…')
    await input.setInputFiles(await demoFile())
    await submit.click()
    await expect(page.getByRole('status')).toHaveText('Demo metadata loaded.')
    await expect(page.getByRole('heading', { name: 'Dust II', exact: true })).toBeVisible()
    await expect(page.getByText('BLAST Premier 2024', { exact: true })).toBeVisible()
  } finally {
    await held.abort()
  }
})

test('rounds recording duration across a minute boundary', async ({ page }) => {
  const bytes = await readFile(new URL('../fixtures/metadata/dust2-metadata.bin', import.meta.url))
  const infoOffset = bytes.readUInt32LE(8)
  // This captured record has five framing bytes before the one-byte float field tag.
  bytes.writeFloatLE(59.999, infoOffset + 6)
  await page.goto('/')
  await page
    .getByLabel('Choose a .dem file')
    .setInputFiles({ name: 'duration.dem', mimeType: 'application/octet-stream', buffer: bytes })
  await page.getByRole('button', { name: 'Import demo' }).click()
  await expect(page.getByRole('heading', { name: 'Dust II', exact: true })).toBeVisible()
  await expect(page.getByRole('definition').filter({ hasText: '1m 0.00s' })).toHaveText('1m 0.00s')
})
