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
  const input = page.getByLabel('Choose a .dem file')
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
    await page.getByRole('button', { name: 'Load example match', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('23 rounds available. Parsing complete.', {
      timeout: 30_000,
    })
    await expect(page.getByRole('button', { name: /^Round \d+ · Ready$/ })).toHaveCount(23)
    await expect(page.locator('canvas')).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled()
    const example = await memory()
    await input.setInputFiles(fixture)
    await page.getByRole('button', { name: 'Import demo', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('1 rounds available. Parsing stopped.', {
      timeout: 30_000,
    })
    await expect(page.getByRole('button', { name: /^Round \d+ · Ready$/ })).toHaveCount(1)
    await expect(page.locator('canvas')).toHaveCount(1)
    await expect
      .poll(workers)
      .toEqual({ created: cycle * 2 - 1, terminated: cycle * 2 - 1, active: 0 })
    const local = await memory()
    await page.getByRole('button', { name: 'Import demo', exact: true }).evaluate(
      (button: HTMLButtonElement) =>
        new Promise<void>((resolve) => {
          const observer = new MutationObserver(() => {
            const cancel = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
              (candidate) => candidate.textContent?.trim() === 'Cancel import',
            )
            if (cancel) {
              observer.disconnect()
              cancel.click()
              resolve()
            }
          })
          observer.observe(document.body, { childList: true, subtree: true })
          button.click()
        }),
    )
    await expect(page.getByRole('status')).toContainText('Import cancelled.')
    await expect(page.locator('canvas')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Round \d+ · Ready$/ })).toHaveCount(0)
    await expect.poll(workers).toEqual({ created: cycle * 2, terminated: cycle * 2, active: 0 })
    cycles.push({ cycle, example, local, cleared: await memory(), workers: await workers() })
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
        .update(await readFile('src/replay/TacticalReplay.tsx'))
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
      'Forced-GC main-renderer V8 heap and reported backing/embedder storage only. Excludes worker process, GPU and browser RSS. Native workers run normally; counters record explicit ownership termination without retaining worker references. A finite repeated-import run cannot prove every long-session leak absent.',
  }
  const path = testInfo.outputPath('repeated-imports.json')
  await writeFile(path, JSON.stringify(result, null, 2))
  await testInfo.attach('repeated-imports', { path, contentType: 'application/json' })
  console.log(JSON.stringify(result, null, 2))
})
