// @ts-check
const { test, expect } = require('@playwright/test')
const {
  LAYOUTS,
  PHONES,
  useLayout,
  openPortfolio,
  visitPortfolio,
  skipControl,
  menuBar,
  menuTitle,
  menuBarSoundControl,
  SECTIONS,
  easterEggMenu,
  easterEgg,
  lookAt,
  macWindowBox,
  boxOf,
  largestColorDifference,
} = require('./support/portfolio')

/**
 * Finds the Menu Bar's Dark Mode control, pressed while Dark Mode is on. Offered on every screen, phones included.
 * @param {import('@playwright/test').Page} page
 */
function darkModeControl(page) {
  return menuBar(page).getByRole('button', { name: 'Dark Mode', exact: true })
}

/**
 * Records how the Mac Window's paper looks in the first frame the page draws it, from the moment the page starts
 * loading: the page's window.firstMacWindowPaper. Until the stylesheet arrives nothing is drawn, and the paper
 * has no color yet.
 * @param {import('@playwright/test').Page} page
 */
async function watchFirstMacWindowPaper(page) {
  await page.addInitScript(() => {
    const look = () => {
      const macWindow = document.querySelector('.mac-window')
      const paper = macWindow && getComputedStyle(macWindow).backgroundColor
      if (paper && paper !== 'rgba(0, 0, 0, 0)') Object.assign(window, { firstMacWindowPaper: paper })
      else requestAnimationFrame(look)
    }
    requestAnimationFrame(look)
  })
}

/**
 * How the Mac Window's paper looked in the first frame the page drew it (see watchFirstMacWindowPaper).
 * @param {import('@playwright/test').Page} page
 */
function firstMacWindowPaper(page) {
  return page.evaluate(() => /** @type {{ firstMacWindowPaper?: string }} */ (/** @type {unknown} */ (window)).firstMacWindowPaper)
}

/**
 * A picture with every pixel's color inverted, black for white and white for black, as Dark Mode draws the
 * 1-bit screen.
 * @param {import('@playwright/test').Page} page
 * @param {Buffer} picture
 */
async function inverted(page, picture) {
  const base64 = await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = /** @type {OffscreenCanvasRenderingContext2D} */ (canvas.getContext('2d'))
    context.drawImage(bitmap, 0, 0)
    const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height)
    for (let i = 0; i < pixels.data.length; i += 4) {
      for (let channel = i; channel < i + 3; channel++) pixels.data[channel] = 255 - pixels.data[channel]
    }
    context.putImageData(pixels, 0, 0)
    const png = new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer())
    return btoa(Array.from(png, (byte) => String.fromCharCode(byte)).join(''))
  }, picture.toString('base64'))
  return Buffer.from(base64, 'base64')
}

/**
 * Takes a picture of the smiling computer in About This Mac, the Easter Egg.
 * @param {import('@playwright/test').Page} page
 */
async function smilingComputerInAboutThisMac(page) {
  await openPortfolio(page)
  await easterEggMenu(page).click()
  return easterEgg(page).locator('svg').first().screenshot()
}

/**
 * Takes a picture of the smiling computer greeting a returning visitor in the Short Boot, holding the Short Boot
 * still while it shows. It is seen on plain paper: the checkerboard pattern behind it, inverted, is the same
 * pattern a pixel along.
 * @param {import('@playwright/test').Page} page
 */
async function smilingComputerInShortBoot(page) {
  await page.addInitScript(() => window.localStorage.setItem('isaac-dobson-portfolio:intro-seen', 'yes'))
  // The page's clock stands still from the start, so the Short Boot moves on only as far as it is run on.
  const start = new Date('2026-01-01T09:00:00')
  await page.clock.install({ time: start })
  await page.clock.pauseAt(start)
  await visitPortfolio(page)
  const smilingComputer = page.getByTestId('intro-happy-computer')
  await page.clock.runFor(200)
  await expect.poll(() => smilingComputer.evaluate((svg) => getComputedStyle(svg).opacity)).toBe('1')
  return smilingComputer.screenshot({ style: '.intro__boot-screen { background: var(--paper) !important; }' })
}

const BLACK = 'rgb(0, 0, 0)'
const WHITE = 'rgb(255, 255, 255)'

/**
 * How bright the Mac Window looks, from 0, black, to 255, white, on average across it, seen without the CRT
 * Effects: bright on a light screen, where text is black on white, and dark in Dark Mode.
 * @param {import('@playwright/test').Page} page
 */
async function macWindowBrightness(page) {
  const screen = /** @type {{ width: number, height: number }} */ (page.viewportSize())
  const box = await macWindowBox(page)
  // As much of it as is on screen: a phone's runs on below.
  const seen = { ...box, height: Math.min(box.height, screen.height - box.y) }
  const { brightness } = await lookAt(page, seen, { style: '.crt { display: none; }' })
  return brightness.reduce((sum, cell) => sum + cell, 0) / brightness.length
}

for (const layout of LAYOUTS) {
  test.describe(`Dark Mode on ${layout.name}`, () => {
    useLayout(layout)

    test('is off for a visitor whose system is set to light, leaving the Mac Window black on white', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' })
      await openPortfolio(page)

      expect(await macWindowBrightness(page)).toBeGreaterThan(200)
    })

    test('is on for a visitor whose system is set to dark, drawing the Mac Window white on black', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' })
      await openPortfolio(page)

      expect(await macWindowBrightness(page)).toBeLessThan(55)
    })

    test('turns on and off from the Menu Bar from the start, without scrolling', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' })
      await openPortfolio(page)

      await darkModeControl(page).click()

      await expect(darkModeControl(page)).toHaveAttribute('aria-pressed', 'true')
      expect(await macWindowBrightness(page)).toBeLessThan(55)

      await darkModeControl(page).click()

      await expect(darkModeControl(page)).toHaveAttribute('aria-pressed', 'false')
      expect(await macWindowBrightness(page)).toBeGreaterThan(200)
    })
  })
}

for (const phone of PHONES) {
  test.describe(`Dark Mode on ${phone.name}`, () => {
    useLayout(phone)

    for (const size of [undefined, { width: 320, height: 568 }]) {
      test(`fits its control in the Menu Bar beside every menu title${size ? ', even on a small phone' : ''}`, async ({
        page,
      }) => {
        if (size) await page.setViewportSize(size)
        await openPortfolio(page)

        const screen = /** @type {{ width: number, height: number }} */ (page.viewportSize())
        expect(await page.evaluate(() => document.documentElement.scrollWidth), 'the page doesn’t scroll sideways').toBeLessThanOrEqual(
          screen.width,
        )
        const bar = await boxOf(menuBar(page))
        for (const [name, menu] of [
          ['About This Mac', easterEggMenu(page)],
          ...SECTIONS.map((section) => [section, menuTitle(page, section)]),
          ['Dark Mode', darkModeControl(page)],
          ['Sound', menuBarSoundControl(page)],
        ]) {
          const box = await boxOf(/** @type {import('@playwright/test').Locator} */ (menu))
          expect(box.x, `the ${name} menu’s left edge`).toBeGreaterThanOrEqual(bar.x)
          expect(box.x + box.width, `the ${name} menu’s right edge`).toBeLessThanOrEqual(bar.x + bar.width)
        }
      })
    }
  })
}

for (const { name, pictureOf } of [
  { name: 'About This Mac', pictureOf: smilingComputerInAboutThisMac },
  { name: 'the Short Boot', pictureOf: smilingComputerInShortBoot },
]) {
  test(`draws the smiling computer in ${name} inverted, in white on black, face and all`, async ({ page, browser }) => {
    const lightPage = await browser.newPage({ viewport: page.viewportSize(), colorScheme: 'light' })
    const light = await pictureOf(lightPage)
    await lightPage.close()

    await page.emulateMedia({ colorScheme: 'dark' })
    const dark = await pictureOf(page)

    expect(await largestColorDifference(page, await inverted(page, light), dark)).toBeLessThanOrEqual(2)
  })
}

/**
 * Takes a picture of each of the portfolio's 1-bit images, the headshot and the projects' screenshots, without
 * the CRT Effects or the Full color toggles over them. Each is taken a pixel inside its edges, clear of the
 * frame around it, which an image at a fractional position shares a row of pixels with.
 * @param {import('@playwright/test').Page} page
 */
async function picturesOfOneBitImages(page) {
  await openPortfolio(page)
  const pictures = []
  for (const image of await page.locator('.time-machine__one-bit').all()) {
    await image.scrollIntoViewIfNeeded()
    await expect.poll(() => image.evaluate((img) => /** @type {HTMLImageElement} */ (img).naturalWidth)).toBeGreaterThan(0)
    const box = await boxOf(image)
    const inside = { x: box.x + 1, y: box.y + 1, width: box.width - 2, height: box.height - 2 }
    pictures.push(await page.screenshot({ clip: inside, style: '.crt, .time-machine__toggle { visibility: hidden !important; }' }))
  }
  return pictures
}

test('shows the headshot and project screenshots in 1-bit as drawn, black on white, rather than inverted', async ({
  page,
  browser,
}) => {
  const lightPage = await browser.newPage({ viewport: page.viewportSize(), colorScheme: 'light' })
  const light = await picturesOfOneBitImages(lightPage)
  await lightPage.close()

  await page.emulateMedia({ colorScheme: 'dark' })
  const dark = await picturesOfOneBitImages(page)

  expect(dark.length).toBe(light.length)
  for (const [index, picture] of dark.entries()) {
    expect(await largestColorDifference(page, light[index], picture), `image ${index + 1}`).toBeLessThanOrEqual(2)
  }
})

test.describe('Dark Mode control in the Menu Bar', () => {
  test('turns Dark Mode on and off by pointer, showing whether it is on', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await openPortfolio(page)
    await expect(darkModeControl(page)).toHaveAttribute('aria-pressed', 'false')

    await darkModeControl(page).click()

    await expect(darkModeControl(page)).toHaveAttribute('aria-pressed', 'true')
    expect(await macWindowBrightness(page)).toBeLessThan(55)

    await darkModeControl(page).click()

    await expect(darkModeControl(page)).toHaveAttribute('aria-pressed', 'false')
    expect(await macWindowBrightness(page)).toBeGreaterThan(200)
  })

  test('turns Dark Mode on and off from the keyboard', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await openPortfolio(page)
    await darkModeControl(page).focus()

    await page.keyboard.press('Enter')
    await expect(darkModeControl(page)).toHaveAttribute('aria-pressed', 'true')

    await page.keyboard.press('Space')
    await expect(darkModeControl(page)).toHaveAttribute('aria-pressed', 'false')
  })

  test('shows Dark Mode on for a visitor whose system is set to dark', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await openPortfolio(page)

    await expect(darkModeControl(page)).toHaveAttribute('aria-pressed', 'true')
  })

  for (const { system, on, paper } of [
    { system: 'light', on: true, paper: BLACK },
    { system: 'dark', on: false, paper: WHITE },
  ]) {
    test(`remembers Dark Mode turned ${on ? 'on' : 'off'} for the next visit, over a system set to ${system}, from the first frame`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: /** @type {'light' | 'dark'} */ (system) })
      await openPortfolio(page)
      await darkModeControl(page).click()

      await watchFirstMacWindowPaper(page)
      await visitPortfolio(page)

      await expect.poll(() => firstMacWindowPaper(page)).toBe(paper)
      await skipControl(page).click()
      await expect(darkModeControl(page)).toHaveAttribute('aria-pressed', String(on))
    })
  }

  test('follows the system setting again once the visitor chooses what it is set to', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await openPortfolio(page)
    await darkModeControl(page).click()
    await darkModeControl(page).click()

    await page.emulateMedia({ colorScheme: 'dark' })

    await expect(darkModeControl(page)).toHaveAttribute('aria-pressed', 'true')
    expect(await macWindowBrightness(page)).toBeLessThan(55)
  })

  test('still turns Dark Mode on for this visit when browser storage is blocked', async ({ page }) => {
    /** @type {Error[]} */
    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(error))
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get: () => {
          throw new DOMException('Access is denied for this document.', 'SecurityError')
        },
      })
    })
    await page.emulateMedia({ colorScheme: 'light' })
    await openPortfolio(page)

    await darkModeControl(page).click()

    await expect(darkModeControl(page)).toHaveAttribute('aria-pressed', 'true')
    expect(await macWindowBrightness(page)).toBeLessThan(55)
    expect(pageErrors).toEqual([])
  })
})
