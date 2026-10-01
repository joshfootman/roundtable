import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat, writeFile } from 'node:fs/promises'
import { cpus, platform, release, totalmem } from 'node:os'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

const demoPath = resolve(process.env.DEMO_PATH ?? 'fixtures/local/faze-vs-vitality-m2-dust2.dem')

function percentile(values: number[], fraction: number) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.ceil(sorted.length * fraction) - 1]
}

test('records import, playback and seek timings', async ({ page, browser }, testInfo) => {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(demoPath)) hash.update(chunk)
  const runs = []
  for (let run = 0; run < 3; run++) {
    await page.goto('/')
    await page.getByLabel('Choose a .dem file').setInputFiles(demoPath)
    await page.evaluate(() => {
      document.querySelector('form')!.addEventListener(
        'submit',
        () => {
          performance.mark('benchmark-submit')
          function ready() {
            const button = document
              .querySelector<HTMLCanvasElement>('canvas')
              ?.closest('section')
              ?.querySelector<HTMLButtonElement>('button[aria-pressed]')
            if (!button || button.disabled) {
              requestAnimationFrame(ready)
              return
            }
            requestAnimationFrame(() => {
              performance.measure('benchmark-first-round', 'benchmark-submit')
            })
          }
          requestAnimationFrame(ready)
        },
        { once: true },
      )
    })
    await page.getByRole('button', { name: 'Import demo' }).click()
    const replay = page.getByRole('region', { name: /· Round 1$/ })
    await expect(replay.getByRole('button', { name: 'Play', exact: true })).toBeEnabled({
      timeout: 60_000,
    })
    await expect
      .poll(() => page.evaluate(() => performance.getEntriesByName('benchmark-first-round').length))
      .toBe(1)
    const firstRoundMs = await page.evaluate(
      () => performance.getEntriesByName('benchmark-first-round')[0].duration,
    )
    const slider = replay.getByRole('slider', { name: 'Replay position' })
    await slider.press('Home')
    await replay.locator('canvas').scrollIntoViewIfNeeded()
    const players = replay.getByLabel('Player inspection').getByText(/^X /)
    const startingPosition = await players.allTextContents()
    const parsingDuringPlayback = (await page.getByRole('status').textContent())!.includes(
      'Parsing continues',
    )
    await replay.getByRole('button', { name: 'Play', exact: true }).click()
    const gaps = await page.evaluate(
      () =>
        new Promise<number[]>((resolve) => {
          const gaps: number[] = []
          let previous = performance.now()
          const start = previous
          function frame(now: number) {
            gaps.push(now - previous)
            previous = now
            if (now - start < 2_000) requestAnimationFrame(frame)
            else resolve(gaps)
          }
          requestAnimationFrame(frame)
        }),
    )
    await replay.getByRole('button', { name: 'Pause', exact: true }).click()
    expect(await players.allTextContents()).not.toEqual(startingPosition)
    const seekMs = []
    const seekTicks = []
    for (const key of ['End', 'Home']) {
      await page.evaluate(() => {
        performance.clearMeasures('benchmark-seek')
        document.querySelector('input[type="range"]')!.addEventListener(
          'keydown',
          () => {
            performance.mark('benchmark-seek-start')
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                performance.measure('benchmark-seek', 'benchmark-seek-start')
              }),
            )
          },
          { once: true },
        )
      })
      await slider.press(key)
      await expect
        .poll(() => page.evaluate(() => performance.getEntriesByName('benchmark-seek').length))
        .toBe(1)
      seekMs.push(
        await page.evaluate(() => performance.getEntriesByName('benchmark-seek')[0].duration),
      )
      seekTicks.push(Number(await replay.getByTestId('replay-tick').getAttribute('data-tick')))
      if (key === 'Home') await expect(players).toHaveText(startingPosition)
    }
    expect(seekTicks[0]).toBeGreaterThan(seekTicks[1])
    runs.push({
      firstRoundMs,
      parsingDuringPlayback,
      frameGapP50Ms: percentile(gaps, 0.5),
      frameGapP95Ms: percentile(gaps, 0.95),
      frameGapMaxMs: Math.max(...gaps),
      sampledFrames: gaps.length,
      seekEndMs: seekMs[0],
      seekHomeMs: seekMs[1],
    })
  }
  const result = {
    recordedAt: new Date().toISOString(),
    project: testInfo.project.name,
    viewport: testInfo.project.use.viewport,
    environment: {
      os: platform(),
      release: release(),
      cpu: cpus()[0].model,
      memoryBytes: totalmem(),
      node: process.version,
      chromium: browser.version(),
      headless: true,
    },
    demo: { path: demoPath, bytes: (await stat(demoPath)).size, sha256: hash.digest('hex') },
    build: 'vite build followed by vite preview, no CPU or network throttling',
    runs,
  }
  const resultPath = testInfo.outputPath('playback-baseline.json')
  await writeFile(resultPath, JSON.stringify(result, null, 2))
  await testInfo.attach('playback-baseline.json', {
    path: resultPath,
    contentType: 'application/json',
  })
  console.log(JSON.stringify(result, null, 2))
})
