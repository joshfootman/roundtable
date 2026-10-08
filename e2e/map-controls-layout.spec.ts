import { expect, test } from '@playwright/test'

for (const example of ['faze-vs-vitality-m1-inferno', 'astralis-vs-mouz-m2-nuke']) {
  test(`map controls stay aligned and clear of the HUD and players on ${example}`, async ({
    page,
  }) => {
    await page.goto(`/replay?source=example&example=${example}&round=1`)
    await expect(page.getByRole('button', { name: 'Draw on map', exact: true })).toBeEnabled({
      timeout: 30_000,
    })

    for (const viewport of [
      { width: 320, height: 740 },
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 640, height: 390 },
      { width: 844, height: 390 },
      { width: 1024, height: 700 },
      { width: 1044, height: 974 },
      { width: 1280, height: 800 },
      { width: 1440, height: 900 },
      { width: 1599, height: 800 },
      { width: 1600, height: 900 },
      { width: 1727, height: 900 },
      { width: 1728, height: 900 },
      { width: 1920, height: 1080 },
    ]) {
      await page.setViewportSize(viewport)
      const controls = page.getByRole('group', { name: 'Map controls', exact: true })
      if (viewport.width < 1024 || viewport.height < 700) {
        await expect(controls).toBeHidden()
        continue
      }
      const navigation = controls.getByRole('group', { name: 'Map navigation', exact: true })
      const drawing = controls.getByRole('group', { name: 'Drawing and shortcuts', exact: true })
      const toolbar = (await controls.boundingBox())!
      const hud = (await page.getByRole('region', { name: 'Round controls' }).boundingBox())!
      const stage = (await page.locator('.demo-stage').boundingBox())!
      expect(toolbar.y).toBe(hud.y)
      expect(toolbar.x + toolbar.width + 8).toBeLessThanOrEqual(hud.x)
      expect(Math.abs(hud.x + hud.width / 2 - stage.x - stage.width / 2)).toBeLessThan(1)
      expect((await navigation.boundingBox())!.y).toBe((await drawing.boundingBox())!.y)
      for (const group of [navigation, drawing]) {
        const buttons = await group.getByRole('button').all()
        const bounds = await Promise.all(buttons.map((button) => button.boundingBox()))
        for (const [index, button] of bounds.entries()) {
          expect(button).not.toBeNull()
          if (viewport.width < 1728) {
            expect(button!.x).toBe(bounds[0]!.x)
            if (index > 0) {
              expect(button!.y).toBeGreaterThanOrEqual(
                bounds[index - 1]!.y + bounds[index - 1]!.height,
              )
            }
          } else {
            expect(button!.y).toBe(bounds[0]!.y)
            if (index > 0) {
              expect(button!.x).toBeGreaterThanOrEqual(
                bounds[index - 1]!.x + bounds[index - 1]!.width,
              )
            }
          }
          expect(button!.width).toBeGreaterThanOrEqual(44)
          expect(button!.height).toBeGreaterThanOrEqual(44)
          expect(button!.x).toBeGreaterThanOrEqual(0)
          expect(button!.x + button!.width).toBeLessThanOrEqual(viewport.width)
          expect(button!.y + button!.height).toBeLessThanOrEqual(viewport.height)
        }
      }
      for (const team of ['Counter-Terrorist players', 'Terrorist players']) {
        const players = (await page
          .locator('.demo-player-cards-overlay')
          .getByLabel(team, { exact: true })
          .boundingBox())!
        expect(toolbar.y + toolbar.height + 8).toBeLessThanOrEqual(players.y)
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        viewport.width,
      )
    }
  })
}
