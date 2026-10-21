import { expect, test } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 1440, height: 900 } })

const replay = '/replay?source=example&example=faze-vs-vitality-m2-dust2'

test('pages through the map and both teams, then hands over to the HUD', async ({ page }) => {
  await page.goto(replay)
  const intro = page.locator('.intro')
  await expect(intro.getByText('Dust II', { exact: true })).toBeVisible()
  await expect(intro.getByText('faze-vs-vitality-m2-dust2.dem', { exact: true })).toBeVisible()
  const ct = intro.locator('[data-page="ct"]')
  await expect(ct.locator('.intro-team-name')).toHaveText('VITALITY', { timeout: 10_000 })
  await expect(ct.locator('.intro-player-name')).toHaveText([
    'mezii',
    'flameZ',
    'apEX',
    'Spinx',
    'ZywOo',
  ])
  await expect(intro.locator('[data-page="t"] .intro-team-name')).toHaveText('FAZE', {
    timeout: 10_000,
  })

  await expect(intro).toHaveCount(0, { timeout: 15_000 })
  await expect(page.locator('.demo-stage')).not.toHaveAttribute('data-intro')
  const players = page.getByRole('list', { name: 'Counter-Terrorist players' })
  await expect(players.getByRole('listitem').first()).toHaveCSS('opacity', '1')
})

test('holds on the map until the first round arrives', async ({ page }) => {
  await page.route('**/example/round-1.rpl', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 4_000))
    await route.continue()
  })
  await page.goto(replay)
  const stage = page.locator('.demo-stage')
  await expect(stage).toHaveAttribute('data-intro', 'map')
  // Past the map's dwell, with the round still on its way.
  await page.waitForTimeout(2_500)
  await expect(stage).toHaveAttribute('data-intro', 'map')

  await expect(stage).toHaveAttribute('data-intro', 'ct', { timeout: 10_000 })
  await expect(page.locator('.intro [data-page="ct"] .intro-team-name')).toHaveText('VITALITY')
  await expect(page.locator('.intro')).toHaveCount(0, { timeout: 15_000 })
})

test('a key press skips to the HUD without reaching it', async ({ page }) => {
  await page.goto(replay)
  const play = page.getByRole('button', { name: 'Play round', exact: true })
  await expect(play).toBeEnabled({ timeout: 30_000 })
  await expect(page.locator('.intro')).toHaveCount(1)
  await page.keyboard.press('Space')
  await expect(page.locator('.intro')).toHaveCount(0)
  await expect(page.locator('.demo-stage')).not.toHaveAttribute('data-intro')
  await expect(play).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Pause round', exact: true })).toHaveCount(0)
})
