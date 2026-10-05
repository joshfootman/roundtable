import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { cpus, platform, release, totalmem } from 'node:os'
import { gunzipSync } from 'node:zlib'
import { expect, test } from '@playwright/test'

const importCycles = Number(process.env.IMPORT_CYCLES ?? 5)
if (!Number.isSafeInteger(importCycles) || importCycles < 2 || importCycles > 30)
  throw new Error('IMPORT_CYCLES must be an integer between 2 and 30.')

test('releases previous replay resources across repeated import cycles', async ({
  page,
  browser,
}, testInfo) => {
  await page.addInitScript(() => {
    const counts = { created: 0, terminated: 0, active: 0 }
    const NativeWorker = window.Worker
    window.Worker = class extends NativeWorker {
      private ended = false
      private readonly parser: boolean
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options)
        this.parser = new URL(String(url), location.href).pathname.includes('/demo.worker-')
        if (this.parser) {
          counts.created++
          counts.active++
        }
      }
      terminate() {
        if (this.parser && !this.ended) {
          this.ended = true
          counts.terminated++
          counts.active--
        }
        super.terminate()
      }
    }
    Object.defineProperty(window, 'replayWorkerCounts', { value: counts })
  })
  await page.goto('/')
  const cdp = await page.context().newCDPSession(page)
  const fixture = {
    name: 'dust2.dem',
    mimeType: 'application/octet-stream',
    buffer: gunzipSync(await readFile('fixtures/replay/dust2-first-round.dem.gz')),
  }
  const input = page.locator('input[type="file"]')
  const workers = () => page.evaluate(() => ({ ...Reflect.get(window, 'replayWorkerCounts') }))
  const memory = async () => {
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    )
    await cdp.send('HeapProfiler.collectGarbage')
    return cdp.send('Runtime.getHeapUsage')
  }
  const baseline = await memory()
  const cycles = []
  for (let cycle = 1; cycle <= importCycles; cycle++) {
    await page.evaluate(() => {
      history.pushState({}, '', '/replay?source=example&round=2')
      dispatchEvent(new PopStateEvent('popstate'))
    })
    await expect(page.locator('[data-state="success"]')).toBeAttached({ timeout: 30_000 })
    await expect(page.getByRole('navigation', { name: 'Round navigation' })).toContainText(
      'Round 2',
    )
    await expect(page.locator('canvas')).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Play round', exact: true })).toBeEnabled()
    const example = await memory()
    await input.setInputFiles(fixture)
    await expect(page.locator('[data-state="error"]')).toBeAttached({ timeout: 30_000 })
    await expect(page.getByRole('navigation', { name: 'Round navigation' })).toContainText(
      'Round 1',
    )
    await expect(page.getByRole('button', { name: 'Next round', exact: true })).toBeDisabled()
    await expect(page.locator('canvas')).toHaveCount(1)
    await expect
      .poll(workers)
      .toEqual({ created: cycle * 2 - 1, terminated: cycle * 2 - 1, active: 0 })
    const local = await memory()
    await input.setInputFiles([])
    await page.route(/\/demo\.worker-[^/]+\.js(?:\?.*)?$/, (route) =>
      route.fulfill({ contentType: 'text/javascript', body: 'self.onmessage = () => {}' }),
    )
    await input.setInputFiles(fixture)
    await expect(page.locator('[data-state="loading"]')).toBeAttached()
    await expect.poll(workers).toEqual({ created: cycle * 2, terminated: cycle * 2 - 1, active: 1 })
    await input.setInputFiles([])
    await page.unroute(/\/demo\.worker-[^/]+\.js(?:\?.*)?$/)
    await expect(page.locator('[data-state="idle"]')).toBeAttached()
    await expect(page.locator('canvas')).toHaveCount(0)
    await expect(page.getByRole('navigation', { name: 'Round navigation' })).toHaveCount(0)
    await expect.poll(workers).toEqual({ created: cycle * 2, terminated: cycle * 2, active: 0 })
    cycles.push({ cycle, example, local, cleared: await memory(), workers: await workers() })
    await page.evaluate(() => {
      history.pushState({}, '', '/')
      dispatchEvent(new PopStateEvent('popstate'))
    })
    await expect(page).toHaveURL(/\/$/)
    if (
      process.env.HEAP_SNAPSHOTS === '1' &&
      (cycle === Math.min(5, importCycles - 1) || cycle === importCycles)
    ) {
      const chunks: string[] = []
      const collect = ({ chunk }: { chunk: string }) => chunks.push(chunk)
      cdp.on('HeapProfiler.addHeapSnapshotChunk', collect)
      try {
        await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false })
        await writeFile(testInfo.outputPath(`cleared-${cycle}.heapsnapshot`), chunks.join(''))
      } finally {
        cdp.off('HeapProfiler.addHeapSnapshotChunk', collect)
      }
    }
  }
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
    appCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    build: {
      mode: 'production Vite build, no CPU/network throttling',
      replaySourceSha256: createHash('sha256')
        .update(await readFile('src/components/DemoMap.tsx'))
        .digest('hex'),
      indexSha256: createHash('sha256')
        .update(await readFile('dist/index.html'))
        .digest('hex'),
    },
    workloadContext:
      process.env.BENCHMARK_CONTEXT ?? 'Other machine workloads were not controlled.',
    source: manifest.source,
    baseline,
    cycles,
    limitations:
      'Forced-GC main-renderer V8 heap and reported backing/embedder storage only. Excludes worker process, GPU and browser RSS. Fixture imports use native parsing; pending-import resets hold a controlled worker idle. Counters record explicit ownership termination without retaining worker references. Example navigation stays in one document to retain session and memory history. A finite repeated-import run cannot prove every long-session leak absent.',
  }
  const path = testInfo.outputPath('repeated-imports.json')
  await writeFile(path, JSON.stringify(result, null, 2))
  await testInfo.attach('repeated-imports', { path, contentType: 'application/json' })
  console.log(JSON.stringify(result, null, 2))
})
