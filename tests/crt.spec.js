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
      expect(Math.max(...pixels) - Math.min(...pixels), 'variation across a blank screen').toBeGreaterThan(0.02)
    })

    test('make the grain and flicker move', async ({ page }) => {
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

test.describe('CRT effects for a visitor who prefers reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  for (const layout of LAYOUTS) {
    test.describe(`on ${layout.name}`, () => {
      useLayout(layout)

      test('keep the screen’s texture but hold the grain and flicker still', async ({ page }) => {
        await openPortfolio(page)
        const area = await blankScreenArea(page)

        const pixels = await luminances(page, area)
        expect(Math.max(...pixels) - Math.min(...pixels), 'variation across a blank screen').toBeGreaterThan(0.02)
        for (let look = 0; look < 3; look++) {
          expect(await changeOverAMoment(page, area), 'how far the screen changes').toBeLessThanOrEqual(2)
        }
        expect(await page.evaluate(() => document.getAnimations().length), 'running animations').toBe(0)
      })
    })
  }
})
