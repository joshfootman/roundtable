import { expect, test } from '@playwright/test'

test('closed and crossing freehand strokes retain ink without filling their interiors', async ({
  page,
}) => {
  await page.goto('/replay?source=example&example=faze-vs-vitality-m2-dust2&round=1')
  const map = page.getByRole('img', { name: 'Dust II map', exact: true })
  await expect(map).toBeVisible({ timeout: 30_000 })
  await map.focus()
  await page.keyboard.press('d')
  await expect(map).toHaveClass(/cursor-crosshair/)
  const bounds = (await map.boundingBox())!
  const x = bounds.x + bounds.width / 2
  const y = bounds.y + bounds.height / 2
  for (const kind of ['loop', 'crossing']) {
    await page.mouse.move(x, y + (kind === 'loop' ? 70 : 0))
    await page.mouse.down()
    for (let index = 1; index <= 180; index++) {
      const t = (index / 180) * Math.PI * (kind === 'loop' ? 6 : 4)
      await page.mouse.move(
        x + 90 * Math.sin(t),
        y + 70 * (kind === 'loop' ? Math.cos(t) : Math.sin(t * 2)),
      )
    }
    await map.evaluate((canvas) => {
      canvas.addEventListener(
        'pointerup',
        () => {
          const svg = canvas.parentElement!.querySelector('svg')!.cloneNode(true) as SVGSVGElement
          svg.setAttribute('width', String(canvas.clientWidth))
          svg.setAttribute('height', String(canvas.clientHeight))
          canvas.setAttribute('data-stroke-release', new XMLSerializer().serializeToString(svg))
        },
        { once: true },
      )
    })
    await page.mouse.up()
    const pixels = await map.evaluate(
      async (canvas, centre) => {
        const image = new Image()
        const source = canvas.getAttribute('data-stroke-release')!
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`
        await image.decode()
        const rendered = document.createElement('canvas')
        rendered.width = canvas.clientWidth
        rendered.height = canvas.clientHeight
        const context = rendered.getContext('2d')!
        context.drawImage(image, 0, 0, rendered.width, rendered.height)
        const imageData = context.getImageData(0, 0, rendered.width, rendered.height).data
        let ink = 0
        for (let index = 3; index < imageData.length; index += 4) if (imageData[index]! > 200) ink++
        return {
          ink,
          interior: context.getImageData(centre.x, centre.y + 25, 1, 1).data[3],
        }
      },
      { x: bounds.width / 2, y: bounds.height / 2 },
    )
    expect(pixels.ink, 'The completed stroke retains visible ink').toBeGreaterThan(500)
    expect(pixels.interior, 'The area enclosed by the stroke remains transparent').toBe(0)
    await page.keyboard.press('Shift+D')
  }
})
