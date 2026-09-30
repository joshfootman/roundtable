import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import type { Route } from '@playwright/test'

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

test('can submit another demo while an earlier import is pending', async ({ page }) => {
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
        serverStartTick: 42184,
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
  await input.setInputFiles(await demoFile())
  await submit.click()
  await expect(page.getByRole('status')).toContainText('First round loaded.')
  await expect(page.getByRole('heading', { name: 'Dust II', exact: true })).toBeVisible()
  await expect(page.getByText('BLAST Premier 2024', { exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Completed rounds remain playable')
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
  await page.clock.install()
  await page.clock.pauseAt(new Date())
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
  const freezeTime = replay.getByRole('checkbox', {
    name: 'Include freeze time',
  })
  const scrubber = replay.getByRole('slider', { name: 'Replay position' })
  await freezeTime.check()
  await scrubber.press('Home')
  await expect(replay.getByTestId('replay-tick')).toHaveAttribute('data-tick', '537')
  await expect(replay.getByLabel('Round phase', { exact: true })).toHaveText('Freeze time')
  await play.click()
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
  await scrubber.evaluate((element: HTMLInputElement) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(element, '7834')
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
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
    'Spinx → rain · Headshot',
  )
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
  await expect(page.getByRole('alert')).toContainText('Completed rounds remain playable')
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
            inspection: [[{tick: number * 100, weapon: {type: 'none'}, money: 800, armour: 0, helmet: false, grenades: []}]],
            bomb: [{tick: number * 100, state: {type: 'inactive'}}],
            deaths: [],
            health: new Int32Array([100, 100]),
            yaw: new Float32Array([90, 90]),
            teams: new Uint8Array([number === 1 ? 2 : 3, number === 1 ? 2 : 3])
          }
        });
        channel.onmessage = ({ data }) => {
          if (data === 'reset') { postMessage({ type: 'reset' }); postMessage(round(1)); }
          else postMessage(round(data));
        };
        self.onmessage = () => {
          postMessage({ type: 'metadata', roundStartTicks: [], metadata: {
            mapName: 'de_dust2', serverName: 'Reference server', clientName: 'SourceTV',
            gameDirectory: 'csgo', demoVersion: 'valve_demo_2', patchVersion: 1,
            buildNumber: 1, serverStartTick: 0, durationSeconds: 100,
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
  expect(workerRequests).toBe(1)
})
