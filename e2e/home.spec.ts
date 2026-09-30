import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import type { Route } from '@playwright/test'

async function demoFile() {
  if (process.env.DEMO_PATH) return resolve(process.env.DEMO_PATH)
  return {
    name: 'dust2.dem',
    mimeType: 'application/octet-stream',
    buffer: await readFile(new URL('../fixtures/roster/import.dem', import.meta.url)),
  }
}

test('imports recording metadata through the keyboard-accessible file chooser', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
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
  const roster = page.getByRole('region', { name: 'Player roster' })
  await expect(roster.getByRole('listitem')).toHaveCount(10)
  for (const name of [
    'broky',
    'ropz',
    'frozen',
    'mezii',
    'rain',
    'flameZ',
    'apEX',
    'ZywOo',
    'Spinx',
    'karrigan',
  ]) {
    await expect(roster.getByText(name, { exact: true })).toBeVisible()
  }
  await expect(roster.getByRole('listitem').filter({ hasText: 'ZywOo' })).toContainText(
    '76561198113666193',
  )
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
})

test('explains archive extraction and recovers with a raw demo', async ({ page }) => {
  await page.goto('/')
  const input = page.getByLabel('Choose a .dem file')
  await input.setInputFiles({
    name: 'archive-renamed.dem',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  })
  await page.getByRole('button', { name: 'Import demo' }).click()
  await expect(page.getByRole('alert')).toContainText(/ZIP.*Extract.*\.dem/i)
  await expect(page.getByRole('alert')).toContainText('archive-renamed.dem')
  await input.setInputFiles({
    name: 'renamed.zip',
    mimeType: 'application/zip',
    buffer: await readFile(new URL('../fixtures/roster/import.dem', import.meta.url)),
  })
  await page.getByRole('button', { name: 'Import demo' }).click()
  await expect(page.getByRole('heading', { name: 'Dust II', exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByText('renamed.zip', { exact: true })).toBeVisible()
})

test('can submit another demo while an earlier import is pending', async ({ page }) => {
  let capture: (route: Route) => void
  const pending = new Promise<Route>((resolve) => {
    capture = resolve
  })
  let first = true
  await page.route(/\/demo\.worker-[^/]+\.js(?:\?.*)?$/, (route) => {
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
  const bytes = await readFile(new URL('../fixtures/roster/import.dem', import.meta.url))
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
