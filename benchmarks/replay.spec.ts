import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { cpus, platform, release, totalmem } from 'node:os'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

const gate = process.env.PLAYBACK_GATE === '1'
const demoPath = resolve(
  gate
    ? 'fixtures/replay/dust2-first-round.dem.gz'
    : (process.env.DEMO_PATH ?? 'fixtures/local/faze-vs-vitality-m2-dust2.dem'),
)

function percentile(values: number[], fraction: number) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.ceil(sorted.length * fraction) - 1]
}

test('records import, playback and seek timings', async ({ page, browser }, testInfo) => {
  const hash = createHash('sha256')
  const compact = gate ? gunzipSync(await readFile(demoPath)) : undefined
  if (compact) hash.update(compact)
  else for await (const chunk of createReadStream(demoPath)) hash.update(chunk)
  const runs = []
  for (let run = 0; run < 3; run++) {
    await page.goto('/')
    await page.locator('input[type="file"]').waitFor({ state: 'attached' })
    await page.evaluate(() => {
      document.querySelector('input[type="file"]')!.addEventListener(
        'change',
        () => {
          performance.mark('benchmark-import')
          function ready() {
            const button = document.querySelector<HTMLButtonElement>(
              'button[aria-label="Play round"]',
            )
            if (!document.querySelector('canvas') || !button || button.disabled) {
              requestAnimationFrame(ready)
              return
            }
            requestAnimationFrame(() => {
              performance.measure('benchmark-first-round', 'benchmark-import')
            })
          }
          requestAnimationFrame(ready)
        },
        { once: true },
      )
    })
    await page
      .locator('input[type="file"]')
      .setInputFiles(
        compact
          ? { name: 'dust2-first-round.dem', mimeType: 'application/octet-stream', buffer: compact }
          : demoPath,
      )
    const replay = page.getByRole('region', { name: 'Playback controls' })
    await expect(replay.getByRole('button', { name: 'Play round', exact: true })).toBeEnabled({
      timeout: 60_000,
    })
    await expect
      .poll(() => page.evaluate(() => performance.getEntriesByName('benchmark-first-round').length))
      .toBe(1)
    const firstRoundMs = await page.evaluate(
      () => performance.getEntriesByName('benchmark-first-round')[0].duration,
    )
    const slider = replay.getByRole('slider', { name: 'Round timeline' })
    await slider.press('Home')
    const canvas = page.locator('canvas[role="img"]')
    await expect(canvas).toBeVisible()
    await page.mouse.move(0, 0)
    const initialFrame = await canvas.screenshot({ animations: 'disabled' })
    const startingTick = Number(await slider.inputValue())
    const endTick = Number(await slider.getAttribute('max'))
    expect(startingTick).toBe(Number(await slider.getAttribute('min')))
    const parsingDuringPlayback = (await page.locator('[data-state="loading"]').count()) > 0
    await replay.getByRole('button', { name: 'Play round', exact: true }).click()
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
    await replay.getByRole('button', { name: 'Pause round', exact: true }).click()
    expect(Number(await slider.inputValue())).toBeGreaterThan(startingTick)
    await page.mouse.move(0, 0)
    expect((await canvas.screenshot({ animations: 'disabled' })).equals(initialFrame)).toBe(false)
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
      const expectedTick = key === 'End' ? endTick : startingTick
      await expect(slider).toHaveValue(String(expectedTick))
      seekTicks.push(Number(await slider.inputValue()))
      if (key === 'Home') {
        await page.mouse.move(0, 0)
        const restoredFrame = await canvas.screenshot({ animations: 'disabled' })
        if (!restoredFrame.equals(initialFrame)) {
          // The CI artifact uploads output files; buffered attachments alone are not retained.
          await writeFile(testInfo.outputPath('initial-frame.png'), initialFrame)
          await writeFile(testInfo.outputPath('restored-frame.png'), restoredFrame)
          await testInfo.attach('initial-frame', { body: initialFrame, contentType: 'image/png' })
          await testInfo.attach('restored-frame', { body: restoredFrame, contentType: 'image/png' })
        }
        expect(restoredFrame.equals(initialFrame), 'Home restores the rendered opening frame').toBe(
          true,
        )
      }
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
    demo: {
      path: demoPath,
      bytes: compact?.length ?? (await stat(demoPath)).size,
      sha256: hash.digest('hex'),
    },
    gate,
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
  if (gate) {
    expect(
      percentile(
        runs.map((run) => run.firstRoundMs),
        0.5,
      ),
      'Median first playable round',
    ).toBeLessThan(5000)
    expect(
      percentile(
        runs.map((run) => run.frameGapP95Ms),
        0.5,
      ),
      'Median playback frame-gap p95',
    ).toBeLessThan(100)
    for (const direction of ['seekEndMs', 'seekHomeMs'] as const)
      expect(
        percentile(
          runs.map((run) => run[direction]),
          0.5,
        ),
        `Median ${direction}`,
      ).toBeLessThan(250)
  }
})
