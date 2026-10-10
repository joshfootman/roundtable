import { expect, test } from '@playwright/test'

test('the timeline thumb follows playback every frame, not only on text updates', async ({
  page,
}) => {
  await page.goto('/replay?source=example&example=astralis-vs-mouz-m2-nuke&round=2')
  const play = page.getByRole('button', { name: 'Play round', exact: true })
  await expect(play).toBeEnabled({ timeout: 30_000 })
  await play.click()
  const values = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const input = document.querySelector<HTMLInputElement>(
          'input[aria-label="Round timeline"]',
        )!
        const seen = new Set<string>()
        const started = performance.now()
        function sample() {
          seen.add(`${input.value}|${input.style.getPropertyValue('--timeline-progress')}`)
          if (performance.now() - started < 2000) requestAnimationFrame(sample)
          else resolve(seen.size)
        }
        requestAnimationFrame(sample)
      }),
  )
  // React publishes four times a second (about 9 positions in 2 s); frames give far more.
  expect(values).toBeGreaterThan(20)
})
