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
  await page.goto('/')
  await page.getByRole('button', { name: 'Load example match' }).click()
  await expect(page.getByRole('status')).toContainText('23 rounds available. Parsing complete.', {
    timeout: 30_000,
  })
  await page.getByRole('button', { name: 'Round 2 · Ready', exact: true }).click()
  const replay = page.getByRole('region', { name: 'Dust II · Round 2', exact: true })
  const play = replay.getByRole('button', { name: 'Play', exact: true })
  await expect(play).toBeEnabled()
  const slider = replay.getByRole('slider', { name: 'Replay position' })
  await slider.press('End')
  await slider.press('Home')
  const tick = replay.getByTestId('replay-tick')
  const initialTick = Number(await slider.getAttribute('min'))
  await expect(tick).toHaveAttribute('data-tick', String(initialTick))
  const maxTick = Number(await slider.getAttribute('max'))
  expect((maxTick - initialTick) * tickInterval).toBeGreaterThan(60)
  const players = replay.getByLabel('Player inspection').getByText(/^X /)
  const initialPositions = (await players.allTextContents()).map(
    (position) => position.split(' · Z')[0],
  )
  await replay.locator('canvas').scrollIntoViewIfNeeded()
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
  await expect(replay.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled()
  await expect
    .poll(async () => Number(await tick.getAttribute('data-tick')) - initialTick)
    .toBeGreaterThanOrEqual(Math.floor(elapsedMs / (tickInterval * 1000)))
  const finalTick = Number(await tick.getAttribute('data-tick'))
  expect(
    (await players.allTextContents()).map((position) => position.split(' · Z')[0]),
  ).not.toEqual(initialPositions)
  await replay.getByRole('button', { name: 'Pause', exact: true }).click()
  const seeks = []
  for (const key of ['End', 'Home']) {
    const start = performance.now()
    await slider.press(key)
    await expect(tick).toHaveAttribute(
      'data-tick',
      key === 'End' ? String(maxTick) : String(initialTick),
    )
    seeks.push({ key, responseMs: performance.now() - start })
  }
  await replay.getByText('Utility overlays', { exact: true }).click()
  const overlays = replay.getByRole('group', { name: 'Visible overlays' }).getByRole('checkbox')
  for (const overlay of await overlays.all()) {
    await overlay.uncheck()
    await expect(overlay).not.toBeChecked()
    await overlay.check()
    await expect(overlay).toBeChecked()
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
    controls: { seeks, utilityToggles: await overlays.count() },
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
