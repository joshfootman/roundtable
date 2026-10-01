import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { cpus, platform, release, totalmem } from 'node:os'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

type LoadingMode = 'pre-parsed' | 'live-parsed'
type LoadingObservation = {
  mode: LoadingMode
  run: number
  firstPlayableMs: number
  allRoundsMs: number
  downloadMs: number
  firstPlayableAfterDownloadMs: number
  allRoundsAfterDownloadMs: number
  resourceBytes: number
  resources: { path: string; encodedBytes: number; decodedBytes: number }[]
}

const demoPath = resolve(process.env.DEMO_PATH ?? 'fixtures/local/faze-vs-vitality-m2-dust2.dem')

test('compares cold example loading with the same live-parsed recording', async ({
  browser,
}, testInfo) => {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(demoPath)) hash.update(chunk)
  const sourceSha256 = hash.digest('hex')
  const manifest = JSON.parse(await readFile('public/example/manifest.json', 'utf8')) as {
    source: { sha256: string }
    rounds: { compressedBytes: number }[]
  }
  expect(manifest.source.sha256).toBe(sourceSha256)
  expect(manifest.rounds).toHaveLength(23)
  const observations: LoadingObservation[] = []
  for (let run = 1; run <= 3; run++) {
    const modes: LoadingMode[] =
      run % 2 ? ['pre-parsed', 'live-parsed'] : ['live-parsed', 'pre-parsed']
    for (const mode of modes) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      try {
        const page = await context.newPage()
        await page.goto('http://127.0.0.1:4176')
        await page.evaluate(() => {
          performance.clearResourceTimings()
          const observer = new MutationObserver(() => {
            const canvas = document.querySelector('canvas')
            const play = canvas
              ?.closest('section')
              ?.querySelector<HTMLButtonElement>('button[aria-pressed]')
            if (play && !play.disabled && !performance.getEntriesByName('loading-first').length) {
              performance.mark('loading-first')
            }
            if (
              document
                .querySelector('output')
                ?.textContent?.includes('23 rounds available. Parsing complete.') &&
              !performance.getEntriesByName('loading-complete').length
            ) {
              performance.mark('loading-complete')
            }
            if (
              performance.getEntriesByName('loading-first').length &&
              performance.getEntriesByName('loading-complete').length
            )
              observer.disconnect()
          })
          observer.observe(document.body, {
            subtree: true,
            childList: true,
            attributes: true,
            characterData: true,
          })
        })
        if (mode === 'pre-parsed') {
          const example = page.getByRole('button', { name: 'Load example match', exact: true })
          await example.evaluate((button) => {
            button.addEventListener('click', () => performance.mark('loading-start'), {
              once: true,
            })
          })
          await example.click()
        } else {
          await page.evaluate(async () => {
            performance.mark('loading-start')
            const response = await fetch('http://127.0.0.1:4177/demo.dem')
            if (!response.ok) throw new Error(`Demo download failed (${response.status})`)
            const file = new File([await response.blob()], 'example.dem')
            performance.mark('loading-download')
            const transfer = new DataTransfer()
            transfer.items.add(file)
            const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
            input.files = transfer.files
            input.dispatchEvent(new Event('change', { bubbles: true }))
          })
          await page.getByRole('button', { name: 'Import demo', exact: true }).click()
        }
        await expect(page.getByRole('status')).toHaveText(
          'First round loaded. 23 rounds available. Parsing complete.',
          { timeout: 180_000 },
        )
        await expect(
          page.getByRole('region', { name: 'Dust II · Round 1', exact: true }).locator('canvas'),
        ).toBeVisible()
        await expect(page.getByRole('button', { name: /^Round \d+ · Ready$/ })).toHaveCount(23)
        await expect
          .poll(() => page.evaluate(() => performance.getEntriesByName('loading-complete').length))
          .toBe(1)
        await expect
          .poll(() =>
            page.evaluate(
              () =>
                performance
                  .getEntriesByType('resource')
                  .filter(
                    (entry) => entry.name.includes('/example/') || entry.name.endsWith('/demo.dem'),
                  ).length,
            ),
          )
          .toBe(mode === 'pre-parsed' ? 24 : 1)
        const observation = await page.evaluate(() => {
          const start = performance.getEntriesByName('loading-start')[0].startTime
          const first = performance.getEntriesByName('loading-first')[0].startTime
          const complete = performance.getEntriesByName('loading-complete')[0].startTime
          const download = performance.getEntriesByName('loading-download')[0]?.startTime ?? start
          const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
          const replayResources = resources.filter(
            (entry) => entry.name.includes('/example/') || entry.name.endsWith('/demo.dem'),
          )
          return {
            resources: replayResources.map((entry) => ({
              path: new URL(entry.name).pathname,
              encodedBytes: entry.encodedBodySize,
              decodedBytes: entry.decodedBodySize,
            })),
            firstPlayableMs: first - start,
            allRoundsMs: complete - start,
            downloadMs: download - start,
            firstPlayableAfterDownloadMs: first - download,
            allRoundsAfterDownloadMs: complete - download,
            resourceBytes: replayResources.reduce((sum, entry) => sum + entry.encodedBodySize, 0),
          }
        })
        observations.push({ mode, run, ...observation })
      } finally {
        await context.close()
      }
    }
  }
  const result = {
    recordedAt: new Date().toISOString(),
    environment: {
      os: platform(),
      release: release(),
      cpu: cpus()[0].model,
      memoryBytes: totalmem(),
      node: process.version,
      chromium: browser.version(),
      headless: true,
      viewport: { width: 1440, height: 900 },
    },
    source: { path: demoPath, bytes: (await stat(demoPath)).size, sha256: sourceSha256 },
    archiveCompressedBytes: manifest.rounds.reduce((sum, round) => sum + round.compressedBytes, 0),
    build: {
      mode: 'vite build and vite preview; fresh browser context per observation; no CPU or network throttling',
      indexSha256: createHash('sha256')
        .update(await readFile('dist/index.html'))
        .digest('hex'),
    },
    observations,
  }
  const path = testInfo.outputPath('loading-comparison.json')
  await writeFile(path, JSON.stringify(result, null, 2))
  await testInfo.attach('loading-comparison.json', { path, contentType: 'application/json' })
  console.log(JSON.stringify(result, null, 2))
})
