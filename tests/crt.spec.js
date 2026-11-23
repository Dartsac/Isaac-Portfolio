// @ts-check
const { test, expect } = require('@playwright/test')
const {
  LAYOUTS,
  useLayout,
  openPortfolio,
  section,
  menuTitle,
  menuBarSoundControl,
  easterEggMenu,
  boxOf,
  macDesktopPatternAreas,
  largestColorDifference,
} = require('./support/portfolio')

/** @typedef {import('./support/portfolio').ScreenArea} ScreenArea */

/**
 * The relative luminance of every pixel in an area of the screen, as WCAG defines it, from 0 to 1.
 * @param {import('@playwright/test').Page} page
 * @param {ScreenArea} clip
 * @returns {Promise<number[]>}
 */
async function luminances(page, clip) {
  const screenshot = await page.screenshot({ clip })
  return page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
    const { width, height } = bitmap
    const context = /** @type {OffscreenCanvasRenderingContext2D} */ (new OffscreenCanvas(width, height).getContext('2d'))
    context.drawImage(bitmap, 0, 0)
    const pixels = context.getImageData(0, 0, width, height).data
    const linear = (/** @type {number} */ level) => {
      const c = level / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    }
    const result = []
    for (let i = 0; i < pixels.length; i += 4) {
      result.push(0.2126 * linear(pixels[i]) + 0.7152 * linear(pixels[i + 1]) + 0.0722 * linear(pixels[i + 2]))
    }
    return result
  }, screenshot.toString('base64'))
}

/**
 * The value below which a fraction of the values fall.
 * @param {number[]} values
 * @param {number} fraction
 */
function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))]
}

/**
 * How far apart the largest and smallest values are. (Spreading a large screenshot's pixels into
 * Math.max would overflow the call stack.)
 * @param {number[]} values
 */
function spread(values) {
  return values.reduce((max, v) => Math.max(max, v), -Infinity) - values.reduce((min, v) => Math.min(min, v), Infinity)
}

/**
 * A blank stretch of the Mac Window, between its title bar and Isaac's name, where only the screen's own
 * texture shows.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<ScreenArea>}
 */
async function blankScreenArea(page) {
  const titleBar = await boxOf(page.getByTestId('mac-window-title-bar'))
  const name = await boxOf(page.getByRole('heading', { level: 1, name: 'Isaac Dobson' }))
  const top = titleBar.y + titleBar.height + 4
  return { x: titleBar.x + titleBar.width * 0.2, y: top, width: titleBar.width * 0.6, height: name.y - 4 - top }
}

/**
 * Takes two looks at an area of the screen a moment apart, and says how far apart they are.
 * @param {import('@playwright/test').Page} page
 * @param {ScreenArea} clip
 */
async function changeOverAMoment(page, clip) {
  const before = await page.screenshot({ clip })
  await page.waitForTimeout(300)
  return largestColorDifference(page, before, await page.screenshot({ clip }))
}

for (const layout of LAYOUTS) {
  test.describe(`CRT effects on ${layout.name}`, () => {
    useLayout(layout)

    test('keep body text readable, close to the contrast of black on white', async ({ page }) => {
      await openPortfolio(page)
      const paragraph = section(page, 'About').getByText('Isaac is a Senior Software Engineer at AT&T')
      await paragraph.scrollIntoViewIfNeeded()

      const pixels = await luminances(page, await boxOf(paragraph))
      // The darkest ink of the letters against the paper around them, which is most of the area.
      const ink = percentile(pixels, 0.01)
      const paper = percentile(pixels, 0.5)
      // Black on white is 21:1, and WCAG asks 7:1 of small text at its strictest. Subtle effects keep most of it.
      expect((paper + 0.05) / (ink + 0.05), 'contrast ratio').toBeGreaterThanOrEqual(15)
    })

    test('give the screen a texture of grain and scanlines', async ({ page }) => {
      await openPortfolio(page)

      const pixels = await luminances(page, await blankScreenArea(page))
      expect(spread(pixels), 'variation across a blank screen').toBeGreaterThan(0.02)
    })

    test('make the grain move', async ({ page }) => {
      await openPortfolio(page)
      const area = await blankScreenArea(page)

      await expect.poll(() => changeOverAMoment(page, area), 'how far the screen changes').toBeGreaterThan(2)
    })

    test('let visitors use the Menu Bar, Time Machine, and links through them', async ({ page }) => {
      await openPortfolio(page)
      const controls = [
        easterEggMenu(page),
        menuTitle(page, 'Projects'),
        menuBarSoundControl(page),
        page.getByRole('button', { name: 'Full color headshot' }),
        page.getByRole('link', { name: 'Download Public Resume (PDF)' }),
      ]

      // Each control is the first thing under the pointer, with nothing of the screen in its way.
      for (const control of controls) await control.click({ trial: true })
      await menuTitle(page, 'Projects').click()
      await expect(menuTitle(page, 'Projects')).toHaveAttribute('aria-current', 'location')
    })
  })
}

/**
 * How far an area of the screen is from how it would look with no CRT effects over it.
 * @param {import('@playwright/test').Page} page
 * @param {ScreenArea} clip
 */
async function crtEffectsOver(page, clip) {
  const withoutEffects = await page.screenshot({ clip, style: '.crt { display: none; }' })
  return largestColorDifference(page, await page.screenshot({ clip }), withoutEffects)
}

for (const layout of LAYOUTS) {
  test.describe(`CRT effects over the Time Machine on ${layout.name}`, () => {
    useLayout(layout)
    // The reveal is instant and the grain still, so each look sees the screen settled.
    test.use({ reducedMotion: 'reduce' })

    test('leave an image shown in full color crisp, as on a present-day screen, even as it scrolls', async ({ page }) => {
      await openPortfolio(page)
      const frame = page.locator('.about__headshot')
      const headshot = page.getByRole('img', { name: 'Isaac Dobson', exact: true })
      const toggle = page.getByRole('button', { name: 'Full color headshot', exact: true })
      await headshot.scrollIntoViewIfNeeded()
      const picture = await boxOf(headshot)
      expect(await crtEffectsOver(page, picture), 'the effects over the 1-bit image').toBeGreaterThan(2)

      await frame.click({ position: { x: 20, y: 20 } })
      await expect(toggle).toHaveAttribute('aria-pressed', 'true')
      await expect.poll(() => crtEffectsOver(page, picture), 'the effects over the full-color image').toBeLessThanOrEqual(2)

      // Half the image scrolls up under the Mac Window's title bar (on a phone, the stuck Menu Bar and title bar).
      const titleBar = await boxOf(page.getByTestId('mac-window-title-bar'))
      const distance = picture.y - (titleBar.y + titleBar.height) + picture.height / 2
      await page.getByRole('main').evaluate((main, by) => {
        const scroller = main.scrollHeight > main.clientHeight ? main : document.scrollingElement
        scroller?.scrollBy(0, by)
      }, distance)
      await expect.poll(async () => (await boxOf(headshot)).y).toBeLessThan(picture.y - distance / 2)
      const scrolled = await boxOf(headshot)
      const titleBarNow = await boxOf(page.getByTestId('mac-window-title-bar'))
      const visibleTop = titleBarNow.y + titleBarNow.height
      const stillShowing = { ...scrolled, y: visibleTop, height: scrolled.y + scrolled.height - visibleTop }
      await expect.poll(() => crtEffectsOver(page, stillShowing), 'the effects over what still shows').toBeLessThanOrEqual(2)
      const titleBarOverImage = { ...titleBarNow, x: scrolled.x, width: scrolled.width }
      expect(await crtEffectsOver(page, titleBarOverImage), 'the effects over the title bar').toBeGreaterThan(2)

      await toggle.focus()
      await page.keyboard.press('Enter')
      await expect(toggle).toHaveAttribute('aria-pressed', 'false')
      expect(await boxOf(headshot), 'the image, where it was').toEqual(scrolled)
      await expect.poll(() => crtEffectsOver(page, stillShowing), 'the effects over the 1-bit image again').toBeGreaterThan(2)
    })
  })
}

test.describe('CRT effects on the Mac Desktop', () => {
  test('cover the pattern around the Mac Window, out to the edges of the browser window', async ({ page }) => {
    await openPortfolio(page)
    const screen = page.viewportSize()
    if (!screen) throw new Error('No viewport')

    const edge = 8
    for (const { side, area } of await macDesktopPatternAreas(page)) {
      // The stretch of pattern farthest from the Mac Window, along the browser window's own edge.
      const farthest = {
        left: { ...area, width: edge },
        right: { ...area, x: screen.width - edge, width: edge },
        below: { ...area, y: screen.height - edge, height: edge },
      }[side]
      await expect.poll(() => changeOverAMoment(page, farthest), `how far the pattern ${side} it changes`).toBeGreaterThan(2)
    }
  })
})

test.describe('CRT effects for a visitor who prefers reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  for (const layout of LAYOUTS) {
    test.describe(`on ${layout.name}`, () => {
      useLayout(layout)

      test('keep the screen’s texture but hold the grain still', async ({ page }) => {
        await openPortfolio(page)
        const area = await blankScreenArea(page)

        const pixels = await luminances(page, area)
        expect(spread(pixels), 'variation across a blank screen').toBeGreaterThan(0.02)
        for (let look = 0; look < 3; look++) {
          expect(await changeOverAMoment(page, area), 'how far the screen changes').toBeLessThanOrEqual(2)
        }
        expect(await page.evaluate(() => document.getAnimations().length), 'running animations').toBe(0)
      })
    })
  }
})
