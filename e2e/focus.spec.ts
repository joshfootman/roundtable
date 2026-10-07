import { expect, test } from '@playwright/test'

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`replay tabs through controls in both directions at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await page.goto('/replay?source=example&example=astralis-vs-mouz-m2-nuke&round=2')
    const play = page.getByRole('button', { name: 'Play round', exact: true })
    await expect(play).toBeEnabled({ timeout: 30_000 })
    await page.locator('canvas').focus()
    await page.keyboard.press('9')
    if (viewport.width !== 390)
      await expect(page.getByRole('list', { name: 'Round kills, latest first' })).toBeVisible()
    await page.addStyleTag({
      content:
        '.demo-player-team, .demo-kill-feed-list { max-height: 64px !important; overflow-y: auto !important; }',
    })
    const previous = page.getByRole('button', { name: 'Previous round', exact: true })
    const next = page.getByRole('button', { name: 'Next round', exact: true })
    const picker = page.getByRole('button', { name: 'Choose round, current round 2', exact: true })
    const timeline = page.getByRole('slider', { name: 'Round timeline', exact: true })
    const floor = page.getByRole('button', { name: /Upper floor.*switch to lower/ })
    const controls =
      viewport.width === 390
        ? [
            previous,
            floor,
            page.getByRole('button', { name: 'Kill feed', exact: true }),
            next,
            picker,
            play,
            timeline,
          ]
        : [
            page.getByRole('button', { name: 'Zoom in', exact: true }),
            page.getByRole('button', { name: 'Zoom out', exact: true }),
            page.getByRole('button', { name: 'Focus map', exact: true }),
            floor,
            page.getByRole('button', { name: 'Draw on map', exact: true }),
            page.getByRole('button', { name: 'Clear map drawings', exact: true }),
            page.getByRole('button', { name: 'Keyboard shortcuts', exact: true }),
            previous,
            picker,
            next,
            play,
            timeline,
          ]
    await controls[0]!.focus()
    for (const control of controls.slice(1)) {
      await page.keyboard.press('Tab')
      await expect(control).toBeFocused()
    }
    await page.keyboard.press('Tab')
    if (viewport.width === 390)
      await expect(page.getByRole('button', { name: 'Players', exact: true })).toBeFocused()
    else
      expect(
        await page
          .locator('.demo-round')
          .evaluate((round) => round.contains(document.activeElement)),
      ).toBe(false)
    await controls.at(-1)!.focus()
    for (const control of controls.slice(0, -1).reverse()) {
      await page.keyboard.press('Shift+Tab')
      await expect(control).toBeFocused()
    }
    const map = page.getByRole('img', { name: 'Nuke map', exact: true })
    await map.focus()
    await expect(map).toHaveCSS('outline-style', 'none')
    await expect(map).toHaveAttribute('tabindex', '-1')
    if (viewport.width !== 390)
      await expect(page.getByRole('list', { name: 'Round kills, latest first' })).toHaveAttribute(
        'tabindex',
        '-1',
      )
    for (const team of await page.locator('.demo-player-team').all())
      await expect(team).toHaveAttribute('tabindex', '-1')
    await controls[0]!.focus()
    await expect(controls[0]!).toHaveCSS('outline-style', 'solid')
    await expect(controls[0]!).toHaveCSS('outline-width', '2px')
    await page.keyboard.press('0')
    const tick = await timeline.inputValue()
    const before = await map.screenshot()
    await page.keyboard.press('Shift+ArrowRight')
    const after = await map.screenshot()
    expect(after.equals(before), 'Shift + arrow pans from a map control').toBe(false)
    await expect(timeline).toHaveValue(tick)
    await expect(play).toBeVisible()
    await expect(picker).toBeVisible()
  })
}
