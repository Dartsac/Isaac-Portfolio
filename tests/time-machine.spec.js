// @ts-check
const { test, expect } = require('@playwright/test')
const { openPortfolio, lookAt, colorfulness, similarity, loadedImage, expectWebOptimized } = require('./support/portfolio')

/** @typedef {import('./support/portfolio').ScreenArea} ScreenArea */
/** @typedef {{ name: string, images: (string | RegExp)[] }} ToggleGroup a Full color toggle and its images */

/** The CNN Art images form one group, so a single click or tap shows all of them in full color. */
/** @type {ToggleGroup} */
const CNN_ART = {
  name: 'Full color CNN Art images',
  images: [/^Content input: /, /^Style input: /, /^Generated output: /],
}

/**
 * Each Full color toggle and the 1-bit images, by alternative text, that it shows in full color together.
 * @type {ToggleGroup[]}
 */
const TOGGLES = [
  { name: 'Full color headshot', images: ['Isaac Dobson'] },
  { name: 'Full color Crystal home page', images: [/^Crystal prototype home page/] },
  CNN_ART,
]

/**
 * Finds a 1-bit image by its alternative text, scrolled into view and loaded.
 * @param {import('@playwright/test').Page} page
 * @param {RegExp | string} name
 */
async function oneBitImage(page, name) {
  const image = page.getByRole('main').getByRole('img', { name, exact: typeof name === 'string' })
  await image.scrollIntoViewIfNeeded()
  return loadedImage(image)
}

/**
 * The image's area on screen.
 * @param {import('@playwright/test').Locator} image
 */
async function areaOf(image) {
  const box = await image.boundingBox()
  if (!box) throw new Error('Image is not on screen')
  return box
}

/**
 * The image's area above any Full color toggle drawn over it, so a pressed toggle doesn't count as picture.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} image
 */
async function pictureAreaOf(page, image) {
  const area = await areaOf(image)
  let bottom = area.y + area.height
  for (const toggle of await page.getByRole('button', { name: /^Full color / }).all()) {
    const box = await toggle.boundingBox()
    const overlaps =
      box && box.x < area.x + area.width && box.x + box.width > area.x && box.y < bottom && box.y + box.height > area.y
    if (box && overlaps) bottom = Math.min(bottom, box.y)
  }
  return { ...area, height: bottom - area.y }
}

/**
 * A small square of the area, a sixth of its height across, centered on a point.
 * @param {ScreenArea} area
 * @param {{ x: number, y: number }} center
 * @returns {ScreenArea}
 */
function probeAround(area, center) {
  const size = area.height / 6
  return { x: center.x - size / 2, y: center.y - size / 2, width: size, height: size }
}

/**
 * The probe tucked into the area's top-left corner, far from its center.
 * @param {ScreenArea} area
 */
function cornerProbe(area) {
  return probeAround(area, { x: area.x + area.height / 12, y: area.y + area.height / 12 })
}

/**
 * Expects every CNN Art image to be in full color, or every one in 1-bit.
 * @param {import('@playwright/test').Page} page
 * @param {boolean} inColor
 */
async function expectCnnArtInColor(page, inColor) {
  for (const name of CNN_ART.images) {
    const area = await areaOf(page.getByRole('img', { name }))
    const color = expect.poll(() => colorfulness(page, area), String(name))
    await (inColor ? color.toBeGreaterThan(0.3) : color.toBe(0))
  }
}

test.describe('Time Machine toggle', () => {
  test('offers one Full color toggle, off by default, per image or group of images', async ({ page }) => {
    await openPortfolio(page)
    const toggles = page.getByRole('main').getByRole('button', { name: /^Full color / })

    await expect(toggles).toHaveCount(TOGGLES.length)
    for (const { name } of TOGGLES) {
      await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'false')
    }
  })

  test('shows every CNN Art image in full color from the keyboard, and back to 1-bit', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openPortfolio(page)
    for (const name of CNN_ART.images) await oneBitImage(page, name)
    const toggle = page.getByRole('button', { name: CNN_ART.name, exact: true })
    const output = await areaOf(page.getByRole('img', { name: CNN_ART.images[2] }))
    const outputCorner = cornerProbe(output)

    await toggle.focus()
    await page.keyboard.press('Enter')
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expectCnnArtInColor(page, true)
    expect(await colorfulness(page, outputCorner)).toBeGreaterThan(0.3)

    await page.keyboard.press('Space')
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await expectCnnArtInColor(page, false)
  })

  test('shows every CNN Art image in full color with one mouse click on the toggle, and another returns them to 1-bit', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openPortfolio(page)
    for (const name of CNN_ART.images) await oneBitImage(page, name)
    const toggle = page.getByRole('button', { name: CNN_ART.name, exact: true })

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expectCnnArtInColor(page, true)

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await page.mouse.move(0, 0)
    await expectCnnArtInColor(page, false)
  })

  test('shows an image in full color when it is double-clicked, as with one click', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openPortfolio(page)
    const crystal = TOGGLES[1]
    const image = await oneBitImage(page, crystal.images[0])
    const toggle = page.getByRole('button', { name: crystal.name, exact: true })

    await image.dblclick()
    await page.mouse.move(0, 0)
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    const area = await pictureAreaOf(page, image)
    await expect.poll(() => colorfulness(page, area)).toBeGreaterThan(0.05)
  })

  test('lines each full-color image up with its 1-bit image', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openPortfolio(page)

    for (const { name: toggleName, images } of TOGGLES) {
      const oneBitBrightness = []
      for (const name of images) {
        oneBitBrightness.push((await lookAt(page, await pictureAreaOf(page, await oneBitImage(page, name)))).brightness)
      }

      const toggle = page.getByRole('button', { name: toggleName, exact: true })
      await toggle.focus()
      await page.keyboard.press('Enter')
      for (const [index, name] of images.entries()) {
        const area = await pictureAreaOf(page, page.getByRole('img', { name }))
        await expect.poll(() => colorfulness(page, area), `${name} shows in full color`).toBeGreaterThan(0.05)
        await expect
          .poll(async () => similarity(oneBitBrightness[index], (await lookAt(page, area)).brightness), String(name))
          .toBeGreaterThan(0.9)
      }
      await page.keyboard.press('Enter')
    }
  })
})

test('loads every full-color image, web-optimized', async ({ page }) => {
  await openPortfolio(page)
  for (const { name } of TOGGLES) {
    const button = page.getByRole('button', { name, exact: true })
    await button.scrollIntoViewIfNeeded()
    await button.click()
  }

  const images = page.getByRole('main').locator('img')
  const imageCount = TOGGLES.flatMap(({ images }) => images).length
  await expect(images).toHaveCount(imageCount * 2)
  for (const image of await images.all()) {
    await image.scrollIntoViewIfNeeded()
    await expectWebOptimized(page, image, 100_000)
  }
})

test.describe('Time Machine 1-bit images on a full-HD desktop screen', () => {
  // The Macintosh reaches its largest size here, so every 1-bit image has room for its natural width.
  test.use({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })

  test('draws every 1-bit image at its natural width, so no pixel of the dither is dropped', async ({ page }) => {
    await openPortfolio(page)
    const images = page.getByRole('main').getByRole('img')
    await expect(images).toHaveCount(TOGGLES.flatMap(({ images }) => images).length)

    for (const image of await images.all()) {
      await image.scrollIntoViewIfNeeded()
      const naturalWidth = await (await loadedImage(image)).evaluate((img) => /** @type {HTMLImageElement} */ (img).naturalWidth)
      expect((await areaOf(image)).width, (await image.getAttribute('alt')) ?? '').toBe(naturalWidth)
    }
  })
})

test.describe('Time Machine on a touch screen', () => {
  test.use({ hasTouch: true })

  test('one tap on any CNN Art image shows all of them in full color, and another returns them to 1-bit', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openPortfolio(page)
    for (const name of CNN_ART.images) await oneBitImage(page, name)
    const toggle = page.getByRole('button', { name: CNN_ART.name, exact: true })

    await page.getByRole('img', { name: CNN_ART.images[1] }).tap()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expectCnnArtInColor(page, true)

    await page.getByRole('img', { name: CNN_ART.images[0] }).tap()
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await expectCnnArtInColor(page, false)
  })
})

test.describe('Time Machine lens', () => {
  test('shows the full-color image only in a lens around the pointer', async ({ page }) => {
    await openPortfolio(page)
    const area = await areaOf(await oneBitImage(page, CNN_ART.images[2]))
    const center = { x: area.x + area.width / 2, y: area.y + area.height / 2 }
    const aroundPointer = probeAround(area, center)
    const farCorner = cornerProbe(area)

    expect(await colorfulness(page, area)).toBe(0)

    await page.mouse.move(center.x, center.y)
    await expect.poll(() => colorfulness(page, aroundPointer)).toBeGreaterThan(0.3)
    expect(await colorfulness(page, farCorner)).toBe(0)

    await page.mouse.move(0, 0)
    await expect.poll(() => colorfulness(page, area)).toBe(0)
  })

  test('draws the lens under each Full color toggle, so the toggle looks the same with the lens beside it', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openPortfolio(page)

    for (const { name, images } of TOGGLES) {
      for (const image of images) await oneBitImage(page, image)
      const toggle = page.getByRole('button', { name, exact: true })
      await toggle.scrollIntoViewIfNeeded()
      const box = await areaOf(toggle)
      // The image just left of the toggle, where the lens shows, and the toggle inside its rounded corners.
      const besideToggle = { x: box.x - 40, y: box.y, width: 40, height: box.height }
      const insideToggle = { x: box.x + 6, y: box.y + 3, width: box.width - 12, height: box.height - 6 }
      await page.mouse.move(0, 0)
      const toggleAlone = await page.screenshot({ clip: insideToggle })
      const besideAlone = await page.screenshot({ clip: besideToggle })

      // Just left of the toggle, so the lens rim runs across it.
      await page.mouse.move(box.x - 8, box.y + box.height / 2)
      await expect
        .poll(async () => (await page.screenshot({ clip: besideToggle })).equals(besideAlone), `${name}: lens shows`)
        .toBe(false)
      expect((await page.screenshot({ clip: insideToggle })).equals(toggleAlone), `${name} is unchanged`).toBe(true)
    }
  })

  test('keeps the lens under a still pointer while the Mac Window scrolls', async ({ page }) => {
    await openPortfolio(page)
    const image = await oneBitImage(page, CNN_ART.images[2])
    const before = await areaOf(image)
    const pointer = { x: before.x + before.width / 2, y: before.y + before.height / 5 }
    await page.mouse.move(pointer.x, pointer.y)
    await expect.poll(() => colorfulness(page, probeAround(before, pointer))).toBeGreaterThan(0.3)

    await page.mouse.wheel(0, before.height / 2)
    await expect.poll(async () => before.y - (await areaOf(image)).y).toBeGreaterThan(before.height / 3)
    const after = await areaOf(image)
    const oldLens = { x: pointer.x, y: pointer.y - (before.y - after.y) }

    await expect.poll(() => colorfulness(page, probeAround(after, pointer))).toBeGreaterThan(0.3)
    await expect.poll(() => colorfulness(page, probeAround(after, oldLens))).toBe(0)
  })

  test('hides the lens when the image scrolls out from under a still pointer', async ({ page }) => {
    await openPortfolio(page)
    const image = await oneBitImage(page, CNN_ART.images[2])
    const before = await areaOf(image)
    await page.mouse.move(before.x + before.width / 3, before.y + before.height - before.height / 8)
    await expect.poll(() => colorfulness(page, before)).toBeGreaterThan(0)

    await page.mouse.wheel(0, before.height / 2)
    await expect.poll(async () => before.y - (await areaOf(image)).y).toBeGreaterThan(before.height / 3)

    await expect.poll(async () => colorfulness(page, await areaOf(image))).toBe(0)
  })
})
