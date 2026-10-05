import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { cpus, platform, release, totalmem } from 'node:os'
import { gunzipSync } from 'node:zlib'
import { decodeRound } from '../src/demo/replay-codec'
import { expect, test } from '@playwright/test'

function percentile(values: number[], fraction: number) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.ceil(sorted.length * fraction) - 1]
}

test('measures a minute of recorded playback and retained browser memory', async ({
  page,
  browser,
}, testInfo) => {
  const recordedRound = decodeRound(
    new Uint8Array(gunzipSync(await readFile('public/example/round-2.rpl'))).buffer,
  )
  const tickInterval = recordedRound.tickInterval
  await page.goto('/replay?source=example&round=2')
  await expect(page.locator('[data-state="success"]')).toBeAttached({ timeout: 30_000 })
  await expect(page.getByRole('navigation', { name: 'Round navigation' })).toContainText('Round 2')
  const play = page.getByRole('button', { name: 'Play round', exact: true })
  await expect(play).toBeEnabled()
  const slider = page.getByRole('slider', { name: 'Round timeline' })
  await slider.press('End')
  await slider.press('Home')
  const initialTick = Number(await slider.getAttribute('min'))
  await expect(slider).toHaveValue(String(initialTick))
  const maxTick = Number(await slider.getAttribute('max'))
  expect((maxTick - initialTick) * tickInterval).toBeGreaterThan(60)
  await page.locator('canvas').scrollIntoViewIfNeeded()
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('HeapProfiler.collectGarbage')
  const memory = [{ elapsedMs: 0, ...(await cdp.send('Runtime.getHeapUsage')) }]
  await play.click()
  const frames = page.evaluate(
    () =>
      new Promise<{ elapsedMs: number; gaps: number[] }>((resolve) => {
        const gaps: number[] = []
        const start = performance.now()
        let previous = start
        function frame(now: number) {
          gaps.push(now - previous)
          previous = now
          if (now - start < 60_000) requestAnimationFrame(frame)
          else resolve({ elapsedMs: now - start, gaps })
        }
        requestAnimationFrame(frame)
      }),
  )
  const started = performance.now()
  for (let sample = 0; sample < 12; sample++) {
    await page.waitForTimeout(5_000)
    memory.push({
      elapsedMs: performance.now() - started,
      ...(await cdp.send('Runtime.getHeapUsage')),
    })
  }
  const { elapsedMs, gaps } = await frames
  await expect(page.getByRole('button', { name: 'Pause round', exact: true })).toBeEnabled()
  await expect
    .poll(async () => Number(await slider.inputValue()) - initialTick)
    .toBeGreaterThanOrEqual(Math.floor(elapsedMs / (tickInterval * 1000)))
  const finalTick = Number(await slider.inputValue())
  await page.getByRole('button', { name: 'Pause round', exact: true }).click()
  const seeks = []
  for (const key of ['End', 'Home']) {
    const start = performance.now()
    await slider.press(key)
    await expect(slider).toHaveValue(key === 'End' ? String(maxTick) : String(initialTick))
    seeks.push({ key, responseMs: performance.now() - start })
  }
  await cdp.send('HeapProfiler.collectGarbage')
  const afterGC = await cdp.send('Runtime.getHeapUsage')
  await cdp.detach()
  const manifest = JSON.parse(await readFile('public/example/manifest.json', 'utf8'))
  const result = {
    recordedAt: new Date().toISOString(),
    environment: {
      cpu: cpus()[0].model,
      os: platform(),
      release: release(),
      memoryBytes: totalmem(),
      node: process.version,
      chromium: browser.version(),
      headless: true,
      viewport: testInfo.project.use.viewport,
    },
    build: {
      mode: 'production Vite build, no CPU/network throttling, completed import before baseline',
      indexSha256: createHash('sha256')
        .update(await readFile('dist/index.html'))
        .digest('hex'),
    },
    appCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    workloadContext:
      process.env.BENCHMARK_CONTEXT ??
      'Other machine workloads were not controlled. Run without concurrent benchmarks for an isolated baseline.',
    source: manifest.source,
    playback: {
      round: 2,
      tickInterval,
      initialTick,
      finalTick,
      elapsedMs,
      sampledFrames: gaps.length,
      frameGapP50Ms: percentile(gaps, 0.5),
      frameGapP95Ms: percentile(gaps, 0.95),
      frameGapMaxMs: Math.max(...gaps),
    },
    controls: { seeks },
    memory: {
      sampleCadenceMs: 5_000,
      samples: memory,
      afterGC,
      peakUsedSize: Math.max(...memory.map((sample) => sample.usedSize)),
      limitations:
        'CDP main-renderer V8 heap and reported backing/embedder storage only; excludes workers, GPU and total browser/process memory. Forced GC changes normal collection behaviour. One minute is not a long-session leak proof.',
    },
  }
  const path = testInfo.outputPath('sustained-playback.json')
  await writeFile(path, JSON.stringify(result, null, 2))
  await testInfo.attach('sustained-playback', { path, contentType: 'application/json' })
  console.log(JSON.stringify(result, null, 2))
})
