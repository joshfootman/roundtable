import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import type { Route, Locator } from '@playwright/test'

async function demoFile() {
  if (process.env.DEMO_PATH) return resolve(process.env.DEMO_PATH)
  return {
    name: 'dust2.dem',
    mimeType: 'application/octet-stream',
    buffer: gunzipSync(
      await readFile(new URL('../fixtures/replay/dust2-first-round.dem.gz', import.meta.url)),
    ),
  }
}

async function seekReplay(slider: Locator, tick: number) {
  await slider.evaluate((element: HTMLInputElement, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
      element,
      String(value),
    )
    element.dispatchEvent(new Event('input', { bubbles: true }))
  }, tick)
}

test('imports recording metadata through the keyboard-accessible file chooser', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  await page.getByRole('link', { name: 'ROUNDTABLE CS2 DEMO VIEWER' }).focus()
  await page.keyboard.press('Tab')
  const input = page.getByLabel('Choose a .dem file')
  await expect(input).toBeFocused()
  const chooser = page.waitForEvent('filechooser')
  await page.keyboard.press('Enter')
  await (await chooser).setFiles(await demoFile())
  await expect(page.getByRole('status')).toBeEmpty()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Import demo' })).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(page.getByRole('status')).toContainText('First round loaded.')
  await expect(page.getByRole('heading', { name: 'Dust II', exact: true })).toBeVisible()
  const metadata = page.getByRole('region', { name: 'Dust II', exact: true })
  for (const value of [
    'de_dust2',
    'BLAST Premier 2024',
    'SourceTV Demo',
    '51m 18.25s',
    '197,008',
    '197,003',
    '14011',
    '10072',
    'valve_demo_2',
  ]) {
    await expect(metadata.getByRole('definition').filter({ hasText: value })).toHaveText(value)
  }
  const roster = page.getByRole('region', { name: 'Player roster' })
  await expect(roster.getByRole('listitem')).toHaveCount(10)
  for (const name of [
    'broky',
    'ropz',
    'frozen',
    'mezii',
    'rain',
    'flameZ',
    'apEX',
    'ZywOo',
    'Spinx',
    'karrigan',
  ]) {
    await expect(roster.getByText(name, { exact: true })).toBeVisible()
  }
  await expect(roster.getByRole('listitem').filter({ hasText: 'ZywOo' })).toContainText(
    '76561198113666193',
  )
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
})

test('explains archive extraction and recovers with a raw demo', async ({ page }) => {
  await page.goto('/')
  const input = page.getByLabel('Choose a .dem file')
  await input.setInputFiles({
    name: 'archive-renamed.dem',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  })
  await page.getByRole('button', { name: 'Import demo' }).click()
  await expect(page.getByRole('alert')).toContainText(/ZIP.*Extract.*\.dem/i)
  await expect(page.getByRole('alert')).toContainText('archive-renamed.dem')
  await input.setInputFiles({
    name: 'renamed.zip',
    mimeType: 'application/zip',
    buffer: gunzipSync(
      await readFile(new URL('../fixtures/replay/dust2-first-round.dem.gz', import.meta.url)),
    ),
  })
  await page.getByRole('button', { name: 'Import demo' }).click()
  await expect(page.getByRole('heading', { name: 'Dust II', exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByText('renamed.zip', { exact: true })).toBeVisible()
})

test('cancels an import and immediately opens another demo', async ({ page }) => {
  let capture: (route: Route) => void
  const pending = new Promise<Route>((resolve) => {
    capture = resolve
  })
  let first = true
  await page.route(/\/demo\.worker-[^/]+\.js(?:\?.*)?$/, (route) => {
    if (first) {
      first = false
      capture(route)
      return
    }
    return route.continue()
  })
  await page.goto('/')
  const input = page.getByLabel('Choose a .dem file')
  const submit = page.getByRole('button', { name: 'Import demo' })
  await input.setInputFiles({
    name: 'pending.dem',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('An unfinished import'),
  })
  await submit.click()
  const held = await pending
  await expect(page.getByRole('status')).toHaveText('Reading pending.dem…')
  await held.fulfill({
    contentType: 'text/javascript',
    body: `self.onmessage = () => { self.postMessage(${JSON.stringify({
      type: 'metadata',
      metadata: {
        mapName: 'de_dust2',
        serverName: 'BLAST Premier 2024',
        clientName: 'SourceTV Demo',
        gameDirectory: 'csgo',
        demoVersion: 'valve_demo_2',
        patchVersion: 14011,
        buildNumber: 10072,
        durationSeconds: 3078.25,
        playbackTicks: 197008,
        playbackFrames: 197003,
      },
      roundStartTicks: [537, 8282, 17370],
    })}); postMessage({ type: 'round-start', number: 1, startTick: 449 }); postMessage({ type: 'round-start', number: 1, startTick: 537 }); }`,
  })
  const rounds = page.getByRole('region', { name: 'Rounds', exact: true })
  await expect(rounds.getByRole('button')).toHaveCount(3)
  await expect(
    rounds.getByRole('button', { name: 'Round 2 · Pending', exact: true }),
  ).toBeDisabled()
  await page.getByRole('button', { name: 'Cancel import', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText(
    'Parsing cancelled. No completed competitive rounds found.',
  )
  await expect(rounds.getByRole('button')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Cancel import', exact: true })).toHaveCount(0)
  await input.setInputFiles(await demoFile())
  await submit.click()
  await expect(page.getByRole('status')).toContainText('First round loaded.')
  await expect(page.getByRole('heading', { name: 'Dust II', exact: true })).toBeVisible()
  await expect(page.getByText('BLAST Premier 2024', { exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Completed round data remains available')
  await expect(rounds.getByRole('button', { name: /Pending/ })).toHaveCount(0)
})

test('rounds recording duration across a minute boundary', async ({ page }) => {
  const bytes = gunzipSync(
    await readFile(new URL('../fixtures/replay/dust2-first-round.dem.gz', import.meta.url)),
  )
  const infoOffset = bytes.readUInt32LE(8)
  // This captured record has five framing bytes before the one-byte float field tag.
  bytes.writeFloatLE(59.999, infoOffset + 6)
  await page.goto('/')
  await page.getByLabel('Choose a .dem file').setInputFiles({
    name: 'duration.dem',
    mimeType: 'application/octet-stream',
    buffer: bytes,
  })
  await page.getByRole('button', { name: 'Import demo' }).click()
  await expect(page.getByRole('heading', { name: 'Dust II', exact: true })).toBeVisible()
  await expect(page.getByRole('definition').filter({ hasText: '1m 0.00s' })).toHaveText('1m 0.00s')
})

test('plays and scrubs the recorded round on the canvas, pauses, resumes and stops at its end', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  await page.getByLabel('Choose a .dem file').setInputFiles(await demoFile())
  await page.getByRole('button', { name: 'Import demo' }).click()
  await expect(page.getByRole('heading', { name: 'Dust II', exact: true })).toBeVisible({
    timeout: 15_000,
  })
  const replay = page.getByRole('region', { name: 'Dust II · Round 1' })
  const play = replay.getByRole('button', { name: 'Play', exact: true })
  await expect(play).toBeEnabled()
  const clockStart = new Date()
  await page.clock.install({ time: clockStart })
  await page.clock.pauseAt(new Date(clockStart.getTime() + 1_000))
  const broky = replay
    .getByLabel('Player inspection')
    .getByRole('listitem')
    .filter({ hasText: 'broky' })
  await expect(broky).toContainText('X -760.7 · Y -836.2 · Z 117.1 · Alive')
  await expect(broky).toContainText('Health 100 · Facing 128.5°')
  await expect(broky).toContainText('Weapon Glock-18 · Ammo 20 / 120')
  await expect(broky).toContainText('Money $800 · Armour 0 · No helmet')
  await expect(replay.getByLabel('Bomb state', { exact: true })).toContainText(
    'Bomb carried by frozen',
  )
  await expect(replay.getByTestId('replay-tick')).toHaveAttribute('data-tick', '537')
  const canvas = replay.locator('canvas')
  const startingMap = await canvas.screenshot()
  const originalCanvas = await canvas.elementHandle()
  await replay.getByText('Player filters', { exact: true }).click()
  const playerRows = replay.getByLabel('Player inspection').getByRole('listitem')
  await expect(playerRows).toHaveCount(10)
  await replay.getByRole('checkbox', { name: 'broky', exact: true }).uncheck()
  await expect(playerRows).toHaveCount(9)
  await expect(replay.getByLabel('Visible player count')).toHaveText('Showing 9 of 10 players')
  await replay.getByRole('checkbox', { name: 'Terrorists', exact: true }).uncheck()
  await expect(playerRows).toHaveCount(5)
  await expect(playerRows).not.toContainText(['broky'])
  await replay.getByRole('checkbox', { name: 'Counter-Terrorists', exact: true }).uncheck()
  await expect(playerRows).toHaveCount(0)
  expect(await canvas.screenshot()).not.toEqual(startingMap)
  await replay.getByRole('checkbox', { name: 'Terrorists', exact: true }).check()
  await expect(playerRows).toHaveCount(4)
  await replay.getByRole('checkbox', { name: 'Counter-Terrorists', exact: true }).check()
  const brokyFilter = replay.getByRole('checkbox', { name: 'broky', exact: true })
  await brokyFilter.focus()
  await brokyFilter.press('Space')
  await expect(playerRows).toHaveCount(10)
  await expect(replay.getByTestId('replay-tick')).toHaveAttribute('data-tick', '537')

  expect(await canvas.screenshot()).toEqual(startingMap)
  expect(await originalCanvas!.evaluate((node) => node.isConnected)).toBe(true)
  const freezeTime = replay.getByRole('checkbox', {
    name: 'Include freeze time',
  })
  const scrubber = replay.getByRole('slider', { name: 'Replay position' })
  await freezeTime.check()
  await scrubber.press('Home')
  await expect(replay.getByTestId('replay-tick')).toHaveAttribute('data-tick', '537')
  await expect(replay.getByLabel('Round phase', { exact: true })).toHaveText('Freeze time')
  await play.click()
  await brokyFilter.uncheck()
  await expect(replay.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await brokyFilter.check()
  await page.clock.runFor(1_008)
  await replay.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(broky).toContainText('X -760.7 · Y -836.2 · Z 117.1 · Alive')
  await expect(broky).toContainText('Health 100 · Facing 128.5°')
  await freezeTime.uncheck()
  await expect(replay.getByTestId('replay-tick')).toHaveAttribute('data-tick', '5732')
  await expect(replay.getByLabel('Round phase', { exact: true })).toHaveText('Live')
  const frozen = replay
    .getByLabel('Player inspection')
    .getByRole('listitem')
    .filter({ hasText: 'frozen' })
  await expect(frozen).toContainText('Armour 100 · No helmet')
  await expect(broky).toContainText('Money $0')
  await expect(frozen).toContainText('Grenades Flashbang × 1')
  const liveMap = await canvas.screenshot()
  expect(liveMap).not.toEqual(startingMap)
  const flying = replay.getByLabel('Flying grenades').getByRole('listitem')
  const detonations = replay.getByLabel('Grenade detonations').getByRole('listitem')
  await replay.getByText('Utility overlays', { exact: true }).click()
  await seekReplay(scrubber, 6492)
  const traces = replay.getByLabel('Bullet traces').getByRole('listitem')
  await expect(traces).toHaveText([
    'flameZ · USP-S shot · X 1392.6 · Y 961.8 · Z 55.2 · Pitch -0.7° · Facing -165.6°',
  ])
  const shotMap = await canvas.screenshot()
  await replay.getByRole('checkbox', { name: 'Bullet traces', exact: true }).uncheck()
  await expect(traces).toHaveCount(0)
  expect(await canvas.screenshot()).not.toEqual(shotMap)
  await replay.getByRole('checkbox', { name: 'Bullet traces', exact: true }).check()
  await expect(traces).toHaveCount(1)
  expect(await canvas.screenshot()).toEqual(shotMap)
  await expect(replay.getByTestId('replay-tick')).toHaveAttribute('data-tick', '6492')

  await seekReplay(scrubber, 6491)
  await expect(traces).toHaveCount(0)
  await seekReplay(scrubber, 6502)
  await expect(traces).toHaveCount(1)
  await expect(traces).not.toContainText(['X 1392.6 · Y 961.8 · Z 55.2'])
  await seekReplay(scrubber, 6363)
  await expect(flying).toHaveText(['Flashbang · frozen · X 385.2 · Y -355.4 · Z 110.3'])
  await seekReplay(scrubber, 6400)
  const flightMap = await canvas.screenshot()
  await replay.getByRole('checkbox', { name: 'Grenade trajectories', exact: true }).uncheck()
  await expect(flying).toHaveCount(0)
  expect(await canvas.screenshot()).not.toEqual(flightMap)
  await replay.getByRole('checkbox', { name: 'Grenade trajectories', exact: true }).check()
  await expect(flying).toHaveCount(1)
  expect(await canvas.screenshot()).toEqual(flightMap)

  await seekReplay(scrubber, 6466)
  await expect(flying).toHaveCount(0)
  await expect(detonations).toHaveText(['Flashbang detonated · X 999.5 · Y 475.7 · Z 416.2'])
  const flameZ = replay
    .getByLabel('Player inspection')
    .getByRole('listitem')
    .filter({ hasText: 'flameZ' })
  await expect(flameZ).toContainText('Flashed · 4.0 s remaining')
  await replay.getByRole('checkbox', { name: 'Grenade detonations', exact: true }).uncheck()
  await expect(detonations).toHaveCount(0)
  const flashMap = await canvas.screenshot()
  const flashLabel = flameZ.getByText('Flashed · 4.0 s remaining', { exact: true })
  const flashFilter = replay.getByRole('checkbox', { name: 'Flashed players', exact: true })
  await flashFilter.focus()
  await flashFilter.press('Space')
  await expect(flashLabel).toBeHidden()
  expect(await canvas.screenshot()).not.toEqual(flashMap)
  await flashFilter.check()
  await expect(flashLabel).toBeVisible()
  expect(await canvas.screenshot()).toEqual(flashMap)
  await replay.getByRole('checkbox', { name: 'Grenade detonations', exact: true }).check()
  await expect(detonations).toHaveCount(1)

  await seekReplay(scrubber, 6724)
  await expect(flameZ).toContainText('Not flashed')
  await seekReplay(scrubber, 6466)
  await expect(flameZ).toContainText('Flashed · 4.0 s remaining')
  await seekReplay(scrubber, 6361)
  await expect(flying).toHaveCount(0)
  await expect(detonations).toHaveCount(0)
  await seekReplay(scrubber, 6363)
  await expect(flying).toHaveCount(1)
  await seekReplay(scrubber, 7834)
  await expect(replay.getByLabel('Round phase', { exact: true })).toHaveText('Post-round')
  await expect(replay.getByLabel('Kill feed').getByRole('listitem')).toHaveCount(6)
  await expect(broky).toContainText('Weapon None')
  await expect(broky).toContainText('Money $1900')
  await expect(replay.getByLabel('Bomb state', { exact: true })).toContainText(
    'Bomb dropped · X -1938.0 · Y 1263.7 · Z 70.2',
  )
  await expect(frozen).toContainText('Grenades None')
  const spinx = replay
    .getByLabel('Player inspection')
    .getByRole('listitem')
    .filter({ hasText: 'Spinx' })
  await expect(spinx).toContainText('Weapon USP-S · Ammo 9 / 24')
  await expect(replay.getByLabel('Kill feed').getByRole('listitem').last()).toHaveText(
    'Spinx → rain · USP-S · Headshot',
  )
  const lastKill = replay.getByLabel('Kill feed').getByRole('listitem').last()
  await expect(lastKill.locator('img').first()).toHaveAttribute('src', /usp_silencer/)
  await expect(lastKill.locator('img').last()).toHaveAttribute('src', /icon_headshot/)
  await expect
    .poll(() =>
      replay
        .locator('img')
        .evaluateAll((images) =>
          images.every(
            (image) =>
              image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
          ),
        ),
    )
    .toBe(true)
  await scrubber.press('Home')
  await play.focus()
  await page.keyboard.press('Space')
  await expect(replay.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await page.clock.runFor(1_008)
  await replay.getByRole('button', { name: 'Pause', exact: true }).press('Space')
  await expect(broky).toContainText('X -945.0 · Y -772.8 · Z 118.9 · Alive')
  expect(await canvas.screenshot()).not.toEqual(startingMap)
  const tick = await replay.getByTestId('replay-tick').getAttribute('data-tick')
  const position = await broky.textContent()
  await page.clock.fastForward(5_000)
  await expect(replay.getByTestId('replay-tick')).toHaveAttribute('data-tick', tick!)
  await expect(broky).toHaveText(position!)
  await play.click()
  await freezeTime.check()
  await expect(replay.getByTestId('replay-tick')).toHaveAttribute('data-tick', tick!)
  await expect(replay.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await freezeTime.uncheck()
  await expect(replay.getByTestId('replay-tick')).toHaveAttribute('data-tick', tick!)
  await replay.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Completed round data remains available')
  await scrubber.press('End')
  await expect(replay.getByTestId('replay-tick')).toHaveAttribute('data-tick', '8282')
  await expect(broky).toContainText('X -2000.4 · Y 1383.1 · Z 29.7 · Dead')
  await expect(broky).toContainText('Health 0 · Facing 77.3°')
  await expect(scrubber).toHaveAttribute('aria-valuetext', '0:39 of 0:39')
  expect(await canvas.screenshot()).not.toEqual(startingMap)
  await scrubber.press('Home')
  await expect(replay.getByTestId('replay-tick')).toHaveAttribute('data-tick', '5732')
  await expect(broky).toContainText('X -760.7 · Y -836.2 · Z 117.1 · Alive')
  await expect(broky).toContainText('Health 100 · Facing 156.4°')
  expect(await canvas.screenshot()).toEqual(liveMap)
  await expect(replay.getByLabel('Bomb state', { exact: true })).toContainText(
    'Bomb carried by broky',
  )
  await expect(frozen).toContainText('Grenades Flashbang × 1')
  await expect(broky).toContainText('Money $0')
  await expect(spinx).toContainText('Weapon Knife')
  await expect(spinx).not.toContainText('Ammo')
  await expect(broky).toContainText('Weapon Glock-18 · Ammo 20 / 120')
  await expect(replay.getByLabel('Kill feed').getByRole('listitem')).toHaveCount(0)
  await page.clock.fastForward(1_000)
  await expect(replay.getByTestId('replay-tick')).toHaveAttribute('data-tick', '5732')
  await expect(replay.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  await replay.getByRole('button', { name: 'Play', exact: true }).press('Space')
  await page.clock.runFor(1_008)
  await scrubber.press('Home')
  await expect(replay.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await page.clock.runFor(1_008)
  await replay.getByRole('button', { name: 'Pause', exact: true }).press('Space')
  await expect(broky).toContainText('X -945.0 · Y -772.8 · Z 118.9 · Alive')
  await replay.getByRole('button', { name: 'Play', exact: true }).press('Space')
  await scrubber.press('End')
  await expect(replay.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  await scrubber.press('Home')
  await replay.getByRole('button', { name: 'Play', exact: true }).press('Space')
  await page.clock.fastForward(45_000)
  await expect(replay.getByTestId('replay-tick')).toHaveAttribute('data-tick', '8282')
  await expect(replay.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  await expect(broky).toContainText('Dead')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
})

test('selects completed rounds without restarting import or changing selection on arrival', async ({
  page,
}) => {
  let workerRequests = 0
  await page.route(/\/demo\.worker-[^/]+\.js(?:\?.*)?$/, async (route) => {
    workerRequests++
    await route.fulfill({
      contentType: 'text/javascript',
      body: `
        const channel = new BroadcastChannel('round-navigation');
        const round = (number) => ({
          type: 'round',
          round: {
            number, startTick: number * 100, liveStartTick: number * 100 + 1,
            resultTick: number * 100 + 1, endTick: number * 100 + 2,
            overtime: number === 25 ? 1 : 0, tickInterval: 1 / 64,
            players: [{ name: 'Recorded player', steamId: '76561198201620490' }],
            ticks: new Uint32Array([number * 100, number * 100 + 1]),
            positions: new Float32Array([number * 100, 200, 30, number * 100 + 10, 210, 30]),
            alive: new Uint8Array([1, 1]),
            inspection: [[{tick: number * 100, weapon: {type: 'none'}, money: 800, armour: 0, helmet: false, grenades: [], flash: {type: 'none'}}]],
            bomb: [{tick: number * 100, state: {type: 'inactive'}}],
            fires: [{tick: 0, fires: []}],
      shots: [],
      smokes: [],
      projectiles: [],
            detonations: [],
            bombEvents: [],
            deaths: [],
            health: new Int32Array([100, 100]),
            yaw: new Float32Array([90, 90]),
            teams: new Uint8Array([number === 1 ? 2 : 3, number === 1 ? 2 : 3])
          }
        });
        channel.onmessage = ({ data }) => {
          if (data === 'memory') postMessage({ type: 'error', message: 'The browser ran out of memory while reading this demo. Close other tabs or choose a shorter recording.' });
          else if (data === 'reset') { postMessage({ type: 'reset' }); postMessage(round(1)); }
          else postMessage(round(data));
        };
        self.onmessage = () => {
          postMessage({ type: 'metadata', roundStartTicks: [], metadata: {
            mapName: 'de_dust2', serverName: 'Reference server', clientName: 'SourceTV',
            gameDirectory: 'csgo', demoVersion: 'valve_demo_2', patchVersion: 1,
            buildNumber: 1, durationSeconds: 100,
            playbackTicks: 6400, playbackFrames: 6400
          }});
          postMessage(round(1));
          postMessage(round(2));
        };
      `,
    })
  })
  await page.goto('/')
  await page.getByLabel('Choose a .dem file').setInputFiles({
    name: 'navigation.dem',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('Controlled round stream'),
  })
  await page.getByRole('button', { name: 'Import demo' }).click()
  const replay = page.getByRole('region', {
    name: 'Dust II · Round 1',
    exact: true,
  })
  await expect(replay.getByRole('button', { name: 'Play', exact: true })).toBeEnabled()
  const rounds = page.getByRole('region', { name: 'Rounds', exact: true })
  const second = rounds.getByRole('button', {
    name: 'Round 2 · Ready',
    exact: true,
  })
  await second.focus()
  await page.keyboard.press('Enter')
  const selected = page.getByRole('region', {
    name: 'Dust II · Round 2',
    exact: true,
  })
  await expect(selected.getByRole('button', { name: 'Play', exact: true })).toBeEnabled()
  await expect(
    selected.getByText('X 200.0 · Y 200.0 · Z 30.0 · Alive', { exact: true }),
  ).toBeVisible()
  await expect(second).toHaveAttribute('aria-pressed', 'true')
  await selected.getByRole('slider', { name: 'Replay position' }).focus()
  await page.keyboard.press('End')
  await expect(selected.getByTestId('replay-tick')).toHaveAttribute('data-tick', '202')
  await page.evaluate(() => {
    const channel = new BroadcastChannel('round-navigation')
    channel.postMessage(25)
    channel.close()
  })
  await expect(rounds.getByRole('button', { name: 'Round 25 · Ready', exact: true })).toBeVisible()
  await expect(second).toHaveAttribute('aria-pressed', 'true')
  await expect(selected.getByTestId('replay-tick')).toHaveAttribute('data-tick', '202')
  await rounds.getByRole('button', { name: 'Round 1 · Ready', exact: true }).click()
  await expect(replay.getByRole('button', { name: 'Play', exact: true })).toBeEnabled()
  await expect(
    replay.getByText('X 100.0 · Y 200.0 · Z 30.0 · Alive', { exact: true }),
  ).toBeVisible()
  await rounds.getByRole('button', { name: 'Round 25 · Ready', exact: true }).click()
  await expect(
    page
      .getByRole('region', {
        name: 'Dust II · Round 25 · Overtime 1',
        exact: true,
      })
      .getByRole('button', { name: 'Play', exact: true }),
  ).toBeEnabled()
  await page.evaluate(() => {
    const channel = new BroadcastChannel('round-navigation')
    channel.postMessage('reset')
    channel.close()
  })
  await expect(rounds.getByRole('button')).toHaveCount(1)
  await expect(replay.getByRole('button', { name: 'Play', exact: true })).toBeEnabled()
  await expect(replay.getByTestId('replay-tick')).toHaveAttribute('data-tick', '100')
  await replay.getByRole('slider', { name: 'Replay position' }).focus()
  await page.keyboard.press('End')
  await expect(replay.getByTestId('replay-tick')).toHaveAttribute('data-tick', '102')
  await page.getByRole('button', { name: 'Cancel import', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText(
    'First round loaded. 1 rounds available. Parsing cancelled.',
  )
  await expect(replay.getByTestId('replay-tick')).toHaveAttribute('data-tick', '102')
  await expect(replay.locator('canvas')).toHaveCount(1)
  await expect(
    rounds.getByRole('button', { name: 'Round 1 · Ready', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  expect(workerRequests).toBe(1)

  await page.getByRole('button', { name: 'Import demo' }).click()
  await expect(rounds.getByRole('button', { name: 'Round 2 · Ready', exact: true })).toBeVisible()
  await page.evaluate(() => {
    const channel = new BroadcastChannel('round-navigation')
    channel.postMessage('memory')
    channel.close()
  })
  await expect(page.getByRole('alert')).toContainText(
    'Close other tabs or choose a shorter recording.',
  )
  await expect(replay.getByRole('button', { name: 'Play', exact: true })).toBeEnabled()
  await replay.getByRole('slider', { name: 'Replay position' }).focus()
  await page.keyboard.press('End')
  await expect(replay.getByTestId('replay-tick')).toHaveAttribute('data-tick', '102')
  await expect(rounds.getByRole('button', { name: 'Round 2 · Ready', exact: true })).toBeEnabled()
})

test('replays timed utility and bomb states across recorded rounds', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Choose a .dem file').setInputFiles({
    name: 'dust2.dem',
    mimeType: 'application/octet-stream',
    buffer: gunzipSync(
      await readFile(new URL('../fixtures/replay/dust2-through-round-4.dem.gz', import.meta.url)),
    ),
  })
  await page.getByRole('button', { name: 'Import demo' }).click()
  await page.getByRole('button', { name: 'Round 2 · Ready', exact: true }).click()
  const smokeReplay = page.getByRole('region', { name: 'Dust II · Round 2', exact: true })
  await expect(smokeReplay.getByRole('button', { name: 'Play', exact: true })).toBeEnabled()
  const smokeSlider = smokeReplay.getByRole('slider', { name: 'Replay position' })
  const smokeAreas = smokeReplay.getByLabel('Approximate smoke areas').getByRole('listitem')
  await seekReplay(smokeSlider, 10331)
  await expect(smokeAreas).toContainText(['Approximate smoke area · X -2036.1 · Y 1579.7 · Z 34.6'])
  await smokeReplay.getByText('Utility overlays', { exact: true }).click()
  const smokeCanvas = smokeReplay.locator('canvas')
  const smokeMap = await smokeCanvas.screenshot()
  await smokeReplay.getByRole('checkbox', { name: 'Smoke areas', exact: true }).uncheck()
  await expect(smokeAreas).toHaveCount(0)
  expect(await smokeCanvas.screenshot()).not.toEqual(smokeMap)
  await smokeReplay.getByRole('checkbox', { name: 'Smoke areas', exact: true }).check()
  await expect(smokeAreas).toHaveCount(1)
  expect(await smokeCanvas.screenshot()).toEqual(smokeMap)

  await seekReplay(smokeSlider, 11758)
  await expect(smokeAreas).toHaveCount(0)
  await seekReplay(smokeSlider, 10331)
  await expect(smokeAreas).toHaveCount(1)
  await page.getByRole('button', { name: 'Round 3 · Ready', exact: true }).click()
  const fireReplay = page.getByRole('region', { name: 'Dust II · Round 3', exact: true })
  await expect(fireReplay.getByRole('button', { name: 'Play', exact: true })).toBeEnabled()
  const fireSlider = fireReplay.getByRole('slider', { name: 'Replay position' })
  const fireAreas = fireReplay.getByLabel('Approximate fire areas').getByRole('listitem')
  await seekReplay(fireSlider, 19201)
  await expect(fireAreas).toHaveText(['Approximate fire area · 1 burning cell'])
  await seekReplay(fireSlider, 19400)
  await expect(fireAreas).toHaveText(['Approximate fire area · 16 burning cells'])
  await fireReplay.getByText('Utility overlays', { exact: true }).click()
  const fireCanvas = fireReplay.locator('canvas')
  const fireMap = await fireCanvas.screenshot()
  await fireReplay.getByRole('checkbox', { name: 'Fire areas', exact: true }).uncheck()
  await expect(fireAreas).toHaveCount(0)
  expect(await fireCanvas.screenshot()).not.toEqual(fireMap)
  await fireReplay.getByRole('checkbox', { name: 'Fire areas', exact: true }).check()
  await expect(fireAreas).toHaveCount(1)
  expect(await fireCanvas.screenshot()).toEqual(fireMap)

  await seekReplay(fireSlider, 19554)
  await expect(fireAreas).toHaveCount(0)
  await seekReplay(fireSlider, 19201)
  await expect(fireAreas).toHaveCount(1)
  await page.getByRole('button', { name: 'Round 4 · Ready', exact: true }).click()
  const replay = page.getByRole('region', { name: 'Dust II · Round 4', exact: true })
  await expect(replay.getByRole('button', { name: 'Play', exact: true })).toBeEnabled()
  const slider = replay.getByRole('slider', { name: 'Replay position' })
  const state = replay.getByLabel('Bomb state', { exact: true })
  const events = replay.getByLabel('Bomb events').getByRole('listitem')
  await seekReplay(slider, 30355)
  await expect(state).toContainText('Bomb being planted by frozen')
  await expect(events).toHaveText(['frozen started planting'])
  await seekReplay(slider, 30555)
  await expect(state).toContainText('Bomb planted')
  await expect(events).toHaveCount(2)
  await seekReplay(slider, 31328)
  await expect(state).toContainText('Bomb being defused by flameZ')
  await seekReplay(slider, 31528)
  await expect(state).toContainText('Bomb planted')
  await expect(events.last()).toHaveText('flameZ stopped defusing')
  await seekReplay(slider, 31965)
  await expect(state).toHaveText('Bomb inactive')
  await expect(events).toHaveCount(6)
  await expect(events.last()).toHaveText('flameZ defused the bomb')
  await seekReplay(slider, 30555)
  await expect(state).toContainText('Bomb planted')
  await expect(events).toHaveText(['frozen started planting', 'frozen planted the bomb'])
})

test('switches map floors without replacing the canvas or interrupting playback', async ({
  page,
}) => {
  await page.route(/\/demo\.worker-[^/]+\.js(?:\?.*)?$/, (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: `self.onmessage = () => {
      postMessage({ type: 'metadata', roundStartTicks: [], metadata: {
        mapName: 'de_nuke', serverName: 'Reference server', clientName: 'SourceTV',
        gameDirectory: 'csgo', demoVersion: 'valve_demo_2', patchVersion: 1,
        buildNumber: 1, durationSeconds: 100,
        playbackTicks: 6400, playbackFrames: 6400
      }});
      postMessage({ type: 'round', round: {
        number: 1, overtime: 0, startTick: 100, liveStartTick: 100, resultTick: 600, endTick: 700,
        tickInterval: 1 / 64, players: [{name: 'Upper player', steamId: 'upper'}, {name: 'Lower player', steamId: 'lower'}],
        ticks: new Uint32Array([100, 600]),
        positions: new Float32Array([-1000, 0, 0, -1000, 0, -600, -500, 0, 0, -500, 0, -600]),
        alive: new Uint8Array([1,1,1,1]), health: new Int32Array([100,100,100,100]),
        yaw: new Float32Array([0,0,0,0]), teams: new Uint8Array([2,3,2,3]),
        inspection: [0,1].map(() => [{tick: 100, weapon: {type: 'none'}, money: 800, armour: 0, helmet: false, grenades: [], flash: {type: 'none'}}]),
        bomb: [{tick: 100, state: {type: 'dropped', x: -900, y: 0, z: -600}}],
        fires: [{tick: 100, fires: [{entity: 1, serial: 1, positions: [-800, 0, -600]}]}],
        shots: [{tick: 100, player: 'lower', weapon: 7, x: -1000, y: 0, z: -600, pitch: 0, yaw: 0}],
        smokes: [{entity: 2, startTick: 100, endTick: 700, x: -1400, y: 500, z: -600}],
        projectiles: [{entity: 3, serial: 1, kind: 'he', thrower: 'lower', startTick: 100, endTick: 200,
          ticks: new Uint32Array([100, 101, 102]),
          positions: new Float32Array([-2000, 1000, -600, -1500, 1000, 0, -1000, 1000, -600])}],
        detonations: [
          {tick: 100, kind: 'he', entity: 4, x: -500, y: 1500, z: -600},
          {tick: 100, kind: 'flash', entity: 5, x: 1000, y: 1500, z: 0}
        ], bombEvents: [], deaths: []
      }});
    };`,
    }),
  )
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  await page.getByLabel('Choose a .dem file').setInputFiles(await demoFile())
  await page.getByRole('button', { name: 'Import demo' }).click()
  const replay = page.getByRole('region', { name: 'Nuke · Round 1', exact: true })
  const upper = replay.getByRole('radio', { name: 'Upper floor', exact: true })
  const lower = replay.getByRole('radio', { name: 'Lower floor', exact: true })
  await expect(upper).toBeEnabled()
  await page.clock.install()
  const canvas = replay.locator('canvas')
  const originalCanvas = await canvas.elementHandle()
  const upperImage = await canvas.screenshot()
  await lower.check()
  await expect(replay.getByTestId('replay-tick')).toHaveAttribute('data-tick', '100')
  const lowerImage = await canvas.screenshot()
  expect(lowerImage).not.toEqual(upperImage)
  await replay.getByText('Utility overlays', { exact: true }).click()
  const smoke = replay.getByRole('checkbox', { name: 'Smoke areas', exact: true })
  await smoke.uncheck()
  expect(await canvas.screenshot()).not.toEqual(lowerImage)
  await smoke.check()
  expect(await canvas.screenshot()).toEqual(lowerImage)
  await replay.getByText('Player filters', { exact: true }).click()
  await replay.getByRole('checkbox', { name: 'Lower player', exact: true }).uncheck()
  expect(await canvas.screenshot()).not.toEqual(lowerImage)
  await replay.getByRole('checkbox', { name: 'Lower player', exact: true }).check()
  expect(await canvas.screenshot()).toEqual(lowerImage)
  await upper.check()
  expect(await canvas.screenshot()).toEqual(upperImage)
  await smoke.uncheck()
  expect(await canvas.screenshot()).toEqual(upperImage)
  await smoke.check()
  await replay.getByRole('checkbox', { name: 'Lower player', exact: true }).uncheck()
  expect(await canvas.screenshot()).toEqual(upperImage)
  expect(await originalCanvas!.evaluate((element) => element.isConnected)).toBe(true)
  const crop = async (x: number, y: number, size = 24) => {
    await canvas.scrollIntoViewIfNeeded()
    const box = (await canvas.boundingBox())!
    const scale = box.width / 1024
    return page.screenshot({
      clip: {
        x: box.x + (x - size / 2) * scale,
        y: box.y + (y - size / 2) * scale,
        width: size * scale,
        height: size * scale,
      },
    })
  }
  const trajectories = replay.getByRole('checkbox', { name: 'Grenade trajectories', exact: true })
  const detonations = replay.getByRole('checkbox', { name: 'Grenade detonations', exact: true })
  const scrubber = replay.getByRole('slider', { name: 'Replay position', exact: true })
  await seekReplay(scrubber, 101)
  const upperMarker = await crop(279, 270)
  await trajectories.uncheck()
  expect(await crop(279, 270)).not.toEqual(upperMarker)
  await trajectories.check()
  await seekReplay(scrubber, 102)
  const hiddenMarker = await crop(350, 270)
  await trajectories.uncheck()
  expect(await crop(350, 270)).toEqual(hiddenMarker)
  await trajectories.check()
  const upperDetonation = await crop(636, 198, 128)
  await detonations.uncheck()
  expect(await crop(636, 198, 128)).not.toEqual(upperDetonation)
  await detonations.check()
  await lower.check()
  const lowerMarker = await crop(350, 270)
  const hiddenBridge = await crop(279, 270)
  await trajectories.uncheck()
  expect(await crop(350, 270)).not.toEqual(lowerMarker)
  expect(await crop(279, 270)).toEqual(hiddenBridge)
  await trajectories.check()
  const lowerDetonation = await crop(422, 198, 128)
  const hiddenUpperDetonation = await crop(636, 198, 128)
  await detonations.uncheck()
  expect(await crop(422, 198, 128)).not.toEqual(lowerDetonation)
  expect(await crop(636, 198, 128)).toEqual(hiddenUpperDetonation)
  await detonations.check()
  await seekReplay(scrubber, 200)
  const endedProjectile = await crop(350, 270)
  await trajectories.uncheck()
  expect(await crop(350, 270)).toEqual(endedProjectile)
  await trajectories.check()
  await upper.check()
  await replay.getByRole('button', { name: 'Play', exact: true }).click()
  await page.clock.runFor(512)
  const playingTick = Number(await replay.getByTestId('replay-tick').getAttribute('data-tick'))
  await lower.check()
  await expect(replay.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await page.clock.runFor(512)
  expect(Number(await replay.getByTestId('replay-tick').getAttribute('data-tick'))).toBeGreaterThan(
    playingTick,
  )
  expect(await originalCanvas!.evaluate((element) => element.isConnected)).toBe(true)
})

test('explains unavailable replay while preserving recorded metadata and players', async ({
  page,
}) => {
  await page.goto('/')
  const input = page.getByLabel('Choose a .dem file')
  const submit = page.getByRole('button', { name: 'Import demo' })
  await input.setInputFiles({
    name: 'metadata-only.dem',
    mimeType: 'application/octet-stream',
    buffer: await readFile(new URL('../fixtures/metadata/dust2-metadata.bin', import.meta.url)),
  })
  await submit.click()
  await expect(page.getByRole('status')).toHaveText(
    'Parsing complete. No completed competitive rounds found.',
  )
  await expect(page.getByRole('region', { name: 'Rounds', exact: true })).toContainText(
    'No completed competitive rounds were found in this recording. Metadata remains available.',
  )
  await expect(page.getByRole('region', { name: 'Dust II', exact: true })).toContainText(
    'BLAST Premier 2024',
  )
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.locator('canvas')).toHaveCount(0)

  const bytes = gunzipSync(
    await readFile(new URL('../fixtures/replay/dust2-first-round.dem.gz', import.meta.url)),
  )
  const mapOffset = bytes.indexOf(Buffer.from('de_dust2'))
  expect(mapOffset).toBeGreaterThan(0)
  bytes.write('de_other', mapOffset)
  await input.setInputFiles({
    name: 'unknown-map.dem',
    mimeType: 'application/octet-stream',
    buffer: bytes,
  })
  await submit.click()
  await expect(
    page.getByRole('heading', { name: 'Map imagery unavailable', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText('A calibrated radar is not registered for de_other.', { exact: false }),
  ).toBeVisible()
  await expect(page.getByRole('region', { name: 'de_other', exact: true })).toContainText(
    'BLAST Premier 2024',
  )
  await expect(
    page.getByRole('region', { name: 'Player roster' }).getByRole('listitem'),
  ).toHaveCount(10)
  await expect(page.getByRole('button', { name: 'Round 1 · Ready', exact: true })).toBeVisible()
  await expect(page.locator('canvas')).toHaveCount(0)
})
