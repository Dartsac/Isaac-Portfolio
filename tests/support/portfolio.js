// @ts-check
// Shared helpers for browser tests of the portfolio.
const { test, expect, devices } = require('@playwright/test')

/**
 * @typedef {object} Layout a way visitors see the portfolio
 * @property {string} name
 * @property {string | undefined} browser the browser engine its visitors use, or any project's own
 * @property {Partial<import('@playwright/test').PlaywrightTestOptions>} emulation the screen and input to emulate
 */

/**
 * Phones, each emulated only in the browser engine its owners run: Chrome on Android, Safari on iPhone.
 * A describe group can't choose its browser, so a phone's tests skip any project running another one.
 * @type {Layout[]}
 */
const PHONES = ['Pixel 7', 'iPhone 15'].map((name) => {
  const { defaultBrowserType, ...emulation } = devices[name]
  return { name, browser: defaultBrowserType, emulation }
})

/**
 * The Mac Desktop on a computer, in every project's own browser, and the full-screen Mac Window on each phone.
 * @type {Layout[]}
 */
const LAYOUTS = [{ name: 'desktop', browser: undefined, emulation: {} }, ...PHONES]

/**
 * Runs a describe group's tests in a layout, and only in the browser its visitors use.
 * @param {Layout} layout
 */
function useLayout(layout) {
  test.skip(
    ({ browserName }) => layout.browser !== undefined && browserName !== layout.browser,
    `${layout.name} visitors use ${layout.browser}`,
  )
  test.use(layout.emulation)
}

/** The portfolio's Sections, in reading order. */
const SECTIONS = ['About', 'Projects', 'Technologies', 'Contact']

/** Matches a North American phone number such as (555) 555-5555 or 555.555.5555. */
const PHONE_NUMBER = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/

/**
 * Finds the control that skips the Intro or Short Boot.
 * @param {import('@playwright/test').Page} page
 */
function skipControl(page) {
  return page.getByRole('button', { name: 'Skip Intro' })
}

/**
 * Finds the sound control the Intro and Short Boot offer beside their skip control.
 * @param {import('@playwright/test').Page} page
 */
function introSoundControl(page) {
  return page.getByTestId('intro-controls').getByRole('button', { name: 'Sound', exact: true })
}

/**
 * Visits the portfolio as a browser arriving at it would, leaving the Intro or Short Boot to play.
 * The address is relative, so it works wherever the portfolio is served: GitHub Pages serves it below a path.
 * @param {import('@playwright/test').Page} page
 * @param {string} [fragment] the part of the address that names a Section to arrive at, such as #projects
 * @param {Parameters<import('@playwright/test').Page['goto']>[1]} [options]
 */
async function visitPortfolio(page, fragment = '', options) {
  await page.goto(`./${fragment}`, options)
}

/**
 * Opens the portfolio and skips the Intro, as a visitor who came for the content would, leaving the
 * portfolio in its ready state. Visitors who prefer reduced motion have no Intro to skip.
 * @param {import('@playwright/test').Page} page
 * @param {string} [fragment] the part of the address that names a Section to arrive at, such as #projects
 * @param {Parameters<import('@playwright/test').Page['goto']>[1]} [options]
 */
async function openPortfolio(page, fragment = '', options) {
  await visitPortfolio(page, fragment, options)
  const reducedMotion = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  if (!reducedMotion) await skipControl(page).click()
  await expect(skipControl(page)).toBeHidden()
}

/**
 * Finds one of the portfolio's Sections in the Mac Window by its accessible name.
 * @param {import('@playwright/test').Page} page
 * @param {string} name About, Projects, Technologies, or Contact
 */
function section(page, name) {
  return page.getByRole('main').getByRole('region', { name, exact: true })
}

/**
 * Finds a Section's heading, the title it is announced and shown by.
 * @param {import('@playwright/test').Page} page
 * @param {string} name About, Projects, Technologies, or Contact
 */
function sectionHeading(page, name) {
  return section(page, name).getByRole('heading', { level: 2, name, exact: true })
}

/**
 * Finds the persistent Menu Bar.
 * @param {import('@playwright/test').Page} page
 */
function menuBar(page) {
  return page.getByRole('navigation', { name: 'Menu Bar' })
}

/**
 * Finds the Menu Bar's menu title for a Section.
 * @param {import('@playwright/test').Page} page
 * @param {string} name About, Projects, Technologies, or Contact
 */
function menuTitle(page, name) {
  return menuBar(page).getByRole('link', { name, exact: true })
}

/**
 * Finds the Menu Bar's first menu, the way to the Easter Egg, as on a classic Macintosh.
 * @param {import('@playwright/test').Page} page
 */
function easterEggMenu(page) {
  return menuBar(page).getByRole('button', { name: 'About This Mac', exact: true })
}

/**
 * Finds the Easter Egg: the About This Mac window.
 * @param {import('@playwright/test').Page} page
 */
function easterEgg(page) {
  return page.getByRole('dialog', { name: 'About This Mac', exact: true })
}

/**
 * Finds the Menu Bar's sound control, which turns the startup chime on or off once the portfolio is ready.
 * @param {import('@playwright/test').Page} page
 */
function menuBarSoundControl(page) {
  return menuBar(page).getByRole('button', { name: 'Sound', exact: true })
}

/**
 * Moves keyboard focus to the next link or control, as a keyboard visitor would in this browser.
 * Safari on a Mac skips links on Tab unless the visitor holds Option, as its keyboard users do.
 * @param {import('@playwright/test').Page} page
 */
async function tabToNext(page) {
  const safariOnMac = page.context().browser()?.browserType().name() === 'webkit' && process.platform === 'darwin'
  await page.keyboard.press(safariOnMac ? 'Alt+Tab' : 'Tab')
}

/**
 * Swipes a finger 400 pixels up the screen, as a phone visitor does to read on, holding it still before it
 * lifts so the page doesn't fling on. Chromium only: Playwright can't swipe in other browsers. (Chromium's
 * synthesized scroll gestures can't touch-scroll in Linux, so the swipe is made of touch events.)
 * @param {import('@playwright/test').Page} page
 */
async function swipeUp(page) {
  const cdp = await page.context().newCDPSession(page)
  const finger = (/** @type {number} */ y) => ({ touchPoints: [{ x: 200, y }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', ...finger(600) })
  for (let y = 580; y >= 200; y -= 20) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', ...finger(y) })
  await page.waitForTimeout(300)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', ...finger(200) })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

/**
 * Expects something to be wholly on the screen, edge to edge. Fractional-pixel layouts count:
 * unlike a visibility ratio, the check doesn't depend on how the browser rounds them.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} locator
 */
async function expectWhollyOnScreen(page, locator) {
  await expect(locator).toBeVisible()
  await expect
    .poll(async () => {
      const box = await locator.boundingBox()
      const screen = page.viewportSize()
      if (!box || !screen) return false
      return box.x >= 0 && box.y >= 0 && box.x + box.width <= screen.width && box.y + box.height <= screen.height
    })
    .toBe(true)
}

/**
 * Where something is on screen.
 * @param {import('@playwright/test').Locator} locator
 */
async function boxOf(locator) {
  const box = await locator.boundingBox()
  if (!box) throw new Error(`${locator} is not on screen`)
  return box
}

/**
 * Where the Mac Window is on screen, from the top of its title bar to the bottom of its content.
 * @param {import('@playwright/test').Page} page
 */
async function macWindowBox(page) {
  const titleBar = await boxOf(page.getByTestId('mac-window-title-bar'))
  const content = await boxOf(page.getByRole('main'))
  return { x: titleBar.x, y: titleBar.y, width: titleBar.width, height: content.y + content.height - titleBar.y }
}

/**
 * The Mac Desktop's pattern on each side of the Mac Window, out to the edges of the browser window: left,
 * right, and below. A few pixels next to the Mac Window are left out, for its border and drop shadow.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{ side: 'left' | 'right' | 'below', area: ScreenArea }[]>}
 */
async function macDesktopPatternAreas(page) {
  const screen = page.viewportSize()
  if (!screen) throw new Error('No viewport')
  const macWindow = await macWindowBox(page)
  const gap = 6
  const right = macWindow.x + macWindow.width + gap
  const bottom = macWindow.y + macWindow.height + gap
  return /** @type {const} */ ([
    { side: 'left', area: { x: 0, y: macWindow.y, width: macWindow.x - gap, height: macWindow.height } },
    { side: 'right', area: { x: right, y: macWindow.y, width: screen.width - right, height: macWindow.height } },
    { side: 'below', area: { x: macWindow.x, y: bottom, width: macWindow.width, height: screen.height - bottom } },
  ])
}

/**
 * Finds a labelled group (such as Education or Languages) inside a Section.
 * @param {import('@playwright/test').Locator} container
 * @param {string} name
 */
function group(container, name) {
  return container.getByRole('group', { name, exact: true })
}

/**
 * Extracts the text a reader of a PDF would see, page by page.
 * @param {Uint8Array} data
 */
async function pdfText(data) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const pdf = await pdfjs.getDocument({ data, verbosity: 0 }).promise
  const pages = []
  for (let number = 1; number <= pdf.numPages; number++) {
    const content = await (await pdf.getPage(number)).getTextContent()
    pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(''))
  }
  return pages.join('\n')
}

/** @typedef {{ x: number, y: number, width: number, height: number }} ScreenArea area in page coordinates */

/**
 * Looks at an area of the screen as a visitor would see it.
 * @param {import('@playwright/test').Page} page
 * @param {ScreenArea} clip
 * @returns {Promise<{ colorfulness: number, brightness: number[] }>}
 *   colorfulness: the fraction of pixels, from 0 to 1, showing color rather than black, white, or gray;
 *   brightness: the average brightness of each cell in a 12 × 12 grid, a coarse picture of the area.
 */
async function lookAt(page, clip) {
  const screenshot = await page.screenshot({ clip })
  return page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
    const { width, height } = bitmap
    const context = /** @type {OffscreenCanvasRenderingContext2D} */ (new OffscreenCanvas(width, height).getContext('2d'))
    context.drawImage(bitmap, 0, 0)
    const pixels = context.getImageData(0, 0, width, height).data

    const grid = 12
    const sums = new Array(grid * grid).fill(0)
    const counts = new Array(grid * grid).fill(0)
    let colored = 0
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4
        const red = pixels[i]
        const green = pixels[i + 1]
        const blue = pixels[i + 2]
        if (Math.max(red, green, blue) - Math.min(red, green, blue) > 24) colored++
        const cell = Math.floor((y * grid) / height) * grid + Math.floor((x * grid) / width)
        sums[cell] += (red + green + blue) / 3
        counts[cell]++
      }
    }
    return { colorfulness: colored / (width * height), brightness: sums.map((sum, cell) => sum / counts[cell]) }
  }, screenshot.toString('base64'))
}

/**
 * How far apart two screenshots of the same size are: the largest difference, from 0 to 255, in any
 * color channel of any pixel. Browsers may round a color a level differently from one composition of a
 * page to the next, so a level or two is a difference no visitor could see.
 * @param {import('@playwright/test').Page} page
 * @param {Buffer} a
 * @param {Buffer} b
 */
async function largestColorDifference(page, a, b) {
  return page.evaluate(
    async ([a, b]) => {
      const pixelsOf = async (/** @type {string} */ base64) => {
        const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
        const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
        const { width, height } = bitmap
        const context = /** @type {OffscreenCanvasRenderingContext2D} */ (new OffscreenCanvas(width, height).getContext('2d'))
        context.drawImage(bitmap, 0, 0)
        return { width, height, data: context.getImageData(0, 0, width, height).data }
      }
      const [first, second] = await Promise.all([pixelsOf(a), pixelsOf(b)])
      if (first.width !== second.width || first.height !== second.height) return 255
      let largest = 0
      for (let i = 0; i < first.data.length; i++) largest = Math.max(largest, Math.abs(first.data[i] - second.data[i]))
      return largest
    },
    [a.toString('base64'), b.toString('base64')],
  )
}

/**
 * Measures how much of an area of the screen shows color rather than black, white, or gray.
 * @param {import('@playwright/test').Page} page
 * @param {ScreenArea} clip
 */
async function colorfulness(page, clip) {
  return (await lookAt(page, clip)).colorfulness
}

/**
 * How closely two coarse pictures share the same composition, from -1 to 1 (Pearson correlation).
 * Returns 0 when either picture is one flat brightness: a flat area has no composition to share.
 * @param {number[]} a
 * @param {number[]} b
 */
function similarity(a, b) {
  const mean = (/** @type {number[]} */ values) => values.reduce((sum, v) => sum + v, 0) / values.length
  const [meanA, meanB] = [mean(a), mean(b)]
  let covariance = 0
  let varianceA = 0
  let varianceB = 0
  for (let i = 0; i < a.length; i++) {
    covariance += (a[i] - meanA) * (b[i] - meanB)
    varianceA += (a[i] - meanA) ** 2
    varianceB += (b[i] - meanB) ** 2
  }
  if (varianceA === 0 || varianceB === 0) return 0
  return covariance / Math.sqrt(varianceA * varianceB)
}

/**
 * Waits until an image has loaded, and returns it.
 * @param {import('@playwright/test').Locator} image
 */
async function loadedImage(image) {
  await expect.poll(() => image.evaluate((img) => /** @type {HTMLImageElement} */ (img).naturalWidth)).toBeGreaterThan(0)
  return image
}

/**
 * Expects every file an image can show (its src and each srcset candidate, whatever the screen's
 * pixel density) to download successfully and weigh less than a budget.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} image
 * @param {number} maxBytes
 */
async function expectWebOptimized(page, image, maxBytes) {
  const sources = await (await loadedImage(image)).evaluate((img) => {
    const { src, srcset } = /** @type {HTMLImageElement} */ (img)
    const candidates = srcset
      .split(',')
      .map((candidate) => candidate.trim().split(/\s+/)[0])
      .filter(Boolean)
      .map((url) => new URL(url, document.baseURI).href)
    return [...new Set([src, ...candidates].filter(Boolean))]
  })
  expect(sources.length, 'the image has a file to show').toBeGreaterThan(0)
  for (const source of sources) {
    const response = await page.request.get(source)
    expect(response.ok(), source).toBe(true)
    expect((await response.body()).length, `${source} is under ${maxBytes} bytes`).toBeLessThan(maxBytes)
  }
}

module.exports = {
  SECTIONS,
  PHONE_NUMBER,
  PHONES,
  LAYOUTS,
  useLayout,
  skipControl,
  introSoundControl,
  visitPortfolio,
  openPortfolio,
  section,
  sectionHeading,
  menuBar,
  menuTitle,
  easterEggMenu,
  easterEgg,
  menuBarSoundControl,
  tabToNext,
  swipeUp,
  expectWhollyOnScreen,
  boxOf,
  macDesktopPatternAreas,
  group,
  pdfText,
  lookAt,
  largestColorDifference,
  colorfulness,
  similarity,
  loadedImage,
  expectWebOptimized,
}
