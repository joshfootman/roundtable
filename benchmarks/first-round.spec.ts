import { expect, test } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

// Fast 4G: what a phone on a good mobile connection sees when opening a shared replay.
const network = {
  latency: 60,
  downloadThroughput: (9 * 1024 * 1024) / 8,
  uploadThroughput: (1.5 * 1024 * 1024) / 8,
}
const runs = Number(process.env.FIRST_ROUND_RUNS ?? 5)

test('first round becomes playable on Fast 4G', async ({ browser }) => {
  const observations = []
  for (let run = 0; run < runs; run++) {
    const context = await browser.newContext()
    const page = await context.newPage()
    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
    await cdp.send('Network.emulateNetworkConditions', { offline: false, ...network })
    const started = Date.now()
    await page.goto('/replay?source=example&example=astralis-vs-mouz-m2-nuke&round=1')
    await expect(page.getByRole('button', { name: 'Play round', exact: true })).toBeEnabled({
      timeout: 60_000,
    })
    const playableMs = Date.now() - started
    const before = await page.evaluate(() => {
      const now = performance.now()
      const entries = (
        performance.getEntriesByType('resource') as PerformanceResourceTiming[]
      ).filter((entry) => entry.startTime < now)
      const kB = (filter: (name: string) => boolean) =>
        Math.round(
          entries.filter((e) => filter(e.name)).reduce((sum, e) => sum + e.transferSize, 0) / 1024,
        )
      return {
        totalKB: kB(() => true),
        catalogImagesKB: kB((name) => name.includes('/images/maps/')),
        laterRoundsKB: kB((name) => /round-([2-9]|\d\d)\.rpl/.test(name)),
      }
    })
    observations.push({ run, playableMs, ...before })
    console.log(JSON.stringify(observations.at(-1)))
    await context.close()
  }
  const sorted = observations.map((o) => o.playableMs).sort((a, b) => a - b)
  const summary = {
    network,
    runs,
    medianPlayableMs: sorted[Math.floor(sorted.length / 2)],
    observations,
  }
  mkdirSync('test-results/loading', { recursive: true })
  writeFileSync('test-results/loading/first-round.json', JSON.stringify(summary, null, 2))
  console.log('median playable', summary.medianPlayableMs, 'ms')
})
