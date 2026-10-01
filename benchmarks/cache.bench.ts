import { readFile } from 'node:fs/promises'
import { cpus, platform, release, totalmem } from 'node:os'
import { createHash } from 'node:crypto'
import { test, expect } from '@playwright/test'
import type { benchmarkCache } from './cache-harness'

test('compares optional Dexie caching with warm HTTP replay loading', async ({
  page,
}, testInfo) => {
  const build = JSON.parse(await readFile('dist-cache/.vite/manifest.json', 'utf8')) as Record<
    string,
    { file: string }
  >
  const harness = build['benchmarks/cache-harness.ts']!
  await page.goto('/')
  await page.getByRole('button', { name: 'Load example match' }).click()
  await expect(page.getByRole('button', { name: /Round 23/ })).toBeVisible({ timeout: 90_000 })
  await expect(page.getByRole('status')).toContainText('Parsing complete')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  const before = await page.getByRole('slider', { name: 'Replay position' }).inputValue()
  const positions = page.getByLabel('Player inspection').getByText(/^X /)
  const beforePositions = await positions.allTextContents()
  const result = await page.evaluate(async (url) => {
    const gaps: number[] = []
    let previous = performance.now()
    let active = true
    const frame = (now: number) => {
      gaps.push(now - previous)
      previous = now
      if (active) requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
    try {
      const module = (await import(url)) as { benchmarkCache: typeof benchmarkCache }
      const measurement = await module.benchmarkCache()
      return { ...measurement, maximumFrameGapMs: Math.max(...gaps), frames: gaps.length }
    } finally {
      active = false
    }
  }, `/${harness.file}`)
  expect(result.pairs).toHaveLength(3)
  for (const pair of result.pairs) {
    expect(pair.http.rounds).toBe(23)
    expect(pair.indexedDB.rounds).toBe(23)
  }
  await expect(page.locator('canvas')).toHaveCount(1)
  expect(await page.getByRole('slider', { name: 'Replay position' }).inputValue()).not.toBe(before)
  expect(await positions.allTextContents()).not.toEqual(beforePositions)
  const manifest = JSON.parse(await readFile('public/example/manifest.json', 'utf8')) as {
    source: { sha256: string }
  }
  const report = {
    recordedAt: new Date().toISOString(),
    environment: {
      cpu: cpus()[0]!.model,
      os: platform(),
      release: release(),
      memoryBytes: totalmem(),
      node: process.version,
    },
    viewport: testInfo.project.use.viewport,
    sourceSha256: manifest.source.sha256,
    buildIndexSha256: createHash('sha256')
      .update(await readFile('dist-cache/index.html'))
      .digest('hex'),
    browser: 'Chromium',
    userAgent: await page.evaluate(() => navigator.userAgent),
    ...result,
  }
  await testInfo.attach('cache-measurement', {
    body: JSON.stringify(report, null, 2),
    contentType: 'application/json',
  })
  console.log(JSON.stringify(report))
})
