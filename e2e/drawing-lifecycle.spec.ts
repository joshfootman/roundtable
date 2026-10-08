import { expect, test, type Locator } from '@playwright/test'

async function inkWidths(map: Locator, regions: { x: number; y: number }[]) {
  return map.evaluate(async (canvas, samples) => {
    const svg = canvas.parentElement!.querySelector('svg')!.cloneNode(true) as SVGSVGElement
    svg.setAttribute('width', String(canvas.clientWidth))
    svg.setAttribute('height', String(canvas.clientHeight))
    const image = new Image()
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`
    await image.decode()
    const rendered = document.createElement('canvas')
    rendered.width = canvas.clientWidth
    rendered.height = canvas.clientHeight
    const context = rendered.getContext('2d')!
    context.drawImage(image, 0, 0)
    return samples.map(({ x, y }) => {
      const pixels = context.getImageData(Math.round(x), Math.round(y - 12), 20, 24).data
      let ink = 0
      for (let index = 3; index < pixels.length; index += 4) ink += pixels[index]! / 255
      return ink / 20
    })
  }, regions)
}

for (const termination of ['lostpointercapture', 'pointercancel']) {
  test(`${termination} retains the visible unfinished stroke once`, async ({ page }) => {
    await page.goto('/replay?source=example&example=faze-vs-vitality-m2-dust2&round=1')
    const map = page.getByRole('img', { name: 'Dust II map', exact: true })
    const count = page.getByLabel('Drawing count', { exact: true })
    await expect(map).toBeVisible({ timeout: 30_000 })
    await map.focus()
    await page.keyboard.press('d')
    const bounds = (await map.boundingBox())!
    const x = bounds.width / 2 - 80
    const y = bounds.height / 2
    await map.evaluate((canvas) => {
      canvas.addEventListener(
        'pointerdown',
        (event) => {
          canvas.setAttribute('data-test-pointer-id', String((event as PointerEvent).pointerId))
        },
        { once: true },
      )
    })
    await page.mouse.move(bounds.x + x, bounds.y + y)
    await page.mouse.down()
    await page.mouse.move(bounds.x + x + 150, bounds.y + y, { steps: 30 })
    expect((await inkWidths(map, [{ x: x + 60, y }]))[0]).toBeGreaterThan(1)
    await map.evaluate((canvas, reason) => {
      const id = Number(canvas.getAttribute('data-test-pointer-id'))
      if (!canvas.hasPointerCapture(id)) throw new Error('The drawing pointer must be captured')
      if (reason === 'lostpointercapture') canvas.releasePointerCapture(id)
      else
        canvas.dispatchEvent(
          new PointerEvent('pointercancel', { pointerId: id, pointerType: 'mouse', bubbles: true }),
        )
    }, termination)
    await page.mouse.move(bounds.x + x + 155, bounds.y + y)
    await expect(count).toHaveText('1 drawing on this floor')
    await page.mouse.up()
    await expect(count).toHaveText('1 drawing on this floor')
    await expect(map.locator('..').locator('svg path[d]')).toHaveCount(1)
    expect((await inkWidths(map, [{ x: x + 60, y }]))[0]).toBeGreaterThan(1)
  })
}

test('stroke weight follows elapsed mouse speed and pen pressure', async ({ page }) => {
  await page.goto('/replay?source=example&example=faze-vs-vitality-m2-dust2&round=1')
  const map = page.getByRole('img', { name: 'Dust II map', exact: true })
  await expect(map).toBeVisible({ timeout: 30_000 })
  await map.focus()
  await page.keyboard.press('d')
  const regions = await map.evaluate(async (canvas) => {
    const bounds = canvas.getBoundingClientRect()
    const capture = canvas.setPointerCapture
    canvas.setPointerCapture = () => {}
    const x = bounds.width / 2 - 160
    const y = bounds.height / 2
    function pointer(
      type: string,
      distance: number,
      offset: number,
      time: number,
      pointerType = 'mouse',
      pressure = 0.5,
    ) {
      const event = new PointerEvent(type, {
        bubbles: true,
        pointerId: 42,
        pointerType,
        clientX: bounds.x + x + distance,
        clientY: bounds.y + y + offset,
        button: 0,
        buttons: type === 'pointerup' ? 0 : 1,
        pressure: type === 'pointerup' ? 0 : pressure,
      })
      Object.defineProperty(event, 'timeStamp', { value: time })
      canvas.dispatchEvent(event)
    }
    try {
      for (const [interval, offset, spacing] of [
        [24, -25, 4],
        [2, 25, 4],
        [48, 75, 8],
      ] as const) {
        pointer('pointerdown', 0, offset, 1000)
        for (let index = 1; index <= 160 / spacing; index++) {
          pointer('pointermove', index * spacing, offset, 1000 + index * interval)
        }
        pointer('pointerup', 160, offset, 1000 + (160 / spacing + 1) * interval)
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      }
      pointer('pointerdown', 0, 125, 1000)
      for (let index = 1; index <= 80; index++) {
        const time = index <= 40 ? 1000 + index * 24 : 1960 + (index - 40) * 2
        pointer('pointermove', index * 4, 125, time)
      }
      pointer('pointerup', 320, 125, 2042)
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      for (const [pressure, offset] of [
        [0.1, -75],
        [0.9, -125],
      ] as const) {
        pointer('pointerdown', 0, offset, 1000, 'pen', pressure)
        for (let index = 1; index <= 40; index++) {
          pointer('pointermove', index * 4, offset, 1000 + index * 24, 'pen', pressure)
        }
        pointer('pointerup', 164, offset, 1984, 'pen', pressure)
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      }
    } finally {
      canvas.setPointerCapture = capture
    }
    return [
      ...[-25, 25, 75].map((offset) => ({ x: x + 65, y: y + offset })),
      { x: x + 65, y: y + 125 },
      { x: x + 240, y: y + 125 },
      { x: x + 65, y: y - 75 },
      { x: x + 65, y: y - 125 },
    ]
  })
  await expect(page.getByLabel('Drawing count', { exact: true })).toHaveText(
    '6 drawings on this floor',
  )
  const [slow, fast, sparseSlow, startSlow, endFast, lightPen, firmPen] = await inkWidths(
    map,
    regions,
  )
  await test.info().attach('rendered-stroke-widths', {
    body: JSON.stringify({ slow, fast, sparseSlow, startSlow, endFast, lightPen, firmPen }),
    contentType: 'application/json',
  })
  expect(
    slow!,
    'Slower motion visibly increases weight with the same spatial samples',
  ).toBeGreaterThan(fast! + 2)
  expect(fast!, 'Fast ink remains legible').toBeGreaterThan(1)
  expect(
    Math.abs(slow! - sparseSlow!),
    'The same speed keeps similar weight at a different sample density',
  ).toBeLessThan(0.25)
  expect(startSlow!, 'A continuous stroke responds when movement accelerates').toBeGreaterThan(
    endFast! + 2,
  )
  expect(endFast!, 'The fast segment stays legible').toBeGreaterThan(1)
  expect(firmPen!, 'Actual pen pressure controls visible weight').toBeGreaterThan(lightPen! + 0.75)
  expect(lightPen!, 'A light pen stroke stays legible').toBeGreaterThan(1)
})
