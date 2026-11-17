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

/** Matches the address of a file of three.js, the 3D library only the full Intro loads, by how it ends. */
const THREE_JS = /\/three\.[\w.]*js$/

/**
 * Collects the address of each request for three.js the page makes from now on.
 * @param {import('@playwright/test').Page} page
 */
function watchThreeJsRequests(page) {
  /** @type {string[]} */
  const requests = []
  page.on('request', (request) => {
    if (THREE_JS.test(request.url())) requests.push(request.url())
  })
  return requests
}

/**
 * @typedef {object} IntroSceneFrame how one drawing of the Intro's 3D scene looked
 * @property {number} time when it was drawn, by the page's clock (performance.now())
 * @property {number} darkest the brightness, from 0 to 255, of its darkest part
 * @property {number} brightest the brightness, from 0 to 255, of its brightest part
 * @property {boolean} fillsWindow whether the scene's canvas covered the whole browser window
 * @property {boolean} oneBit whether every pixel looked at was pure black or pure white, with some of each:
 *   the screen's 1-bit picture alone, with no shaded Macintosh, dark room, or flare blending over it
 * @property {boolean} gray whether every pixel looked at was a shade of gray, with no color
 * @property {number} brightestBelow the brightness, from 0 to 255, of the brightest part of its lower 40%, below
 *   the screen while the whole Macintosh is in view
 */

/** How many cells across and down a coarse picture of an area has (see lookAt). */
const COARSE_GRID = 12

/**
 * Watches the Intro's 3D scene from the moment the page starts loading: each WebGL context the page makes,
 * and what the scene's canvas shows each time it is drawn. So that what was drawn can be read back, the
 * page's WebGL contexts keep their drawing between frames. The page's window.lookAtIntroScene() tells how the
 * scene looks at any moment, such as when a sound starts, and lookAtScreenLanding how the screen looked as
 * the view landed on it.
 * @param {import('@playwright/test').Page} page
 */
async function watchIntroScene(page) {
  await page.addInitScript((grid) => {
    /** @type {{ contexts: (WebGLRenderingContext | WebGL2RenderingContext)[], frames: IntroSceneFrame[], poweredOnAt?: number }} */
    const watched = { contexts: [], frames: [] }
    Object.assign(window, { introSceneWatched: watched })
    // When the screen powers on, as js/sound.js hears it to ring the Startup Chime.
    document.addEventListener('intro:power-on', () => (watched.poweredOnAt ??= performance.now()))

    const getContext = HTMLCanvasElement.prototype.getContext
    /** @this {HTMLCanvasElement} @param {string} type @param {any} [attributes] */
    function keepingDrawing(type, attributes) {
      const webgl = type === 'webgl' || type === 'webgl2'
      const context = getContext.call(this, type, webgl ? { ...attributes, preserveDrawingBuffer: true } : attributes)
      if (webgl && context && !watched.contexts.includes(/** @type {WebGL2RenderingContext} */ (context))) {
        watched.contexts.push(/** @type {WebGL2RenderingContext} */ (context))
      }
      return context
    }
    HTMLCanvasElement.prototype.getContext = /** @type {any} */ (keepingDrawing)

    // A coarse copy of each drawing is enough to tell a dark room, a lit screen, and a white flare apart,
    // and a few of its pixels, copied as they are, whether only the 1-bit screen shows. All of them tell
    // whether it shows black as well as white: its picture may be mostly white, with thin black lines a few
    // pixels can miss. More of its pixels, copied as they are, tell whether any shows color.
    const size = 24
    const graySize = 64
    const smallCanvas = (/** @type {number} */ side) =>
      /** @type {CanvasRenderingContext2D} */ (
        Object.assign(document.createElement('canvas'), { width: side, height: side }).getContext('2d', { willReadFrequently: true })
      )
    const copy = smallCanvas(size)
    const pixelsAt = smallCanvas(size)
    pixelsAt.imageSmoothingEnabled = false
    const grayPixelsAt = smallCanvas(graySize)
    grayPixelsAt.imageSmoothingEnabled = false
    /** Copies a drawing, whole, into a canvas, sized to it. @param {CanvasRenderingContext2D} into @param {HTMLCanvasElement} scene */
    const copyWhole = (into, scene) => {
      if (into.canvas.width !== scene.width || into.canvas.height !== scene.height) {
        Object.assign(into.canvas, { width: scene.width, height: scene.height })
      }
      into.drawImage(scene, 0, 0)
    }
    const whole = smallCanvas(0)
    /** Whether a drawing shows some pure black and some pure white. @param {HTMLCanvasElement} scene */
    const showsBlackAndWhite = (scene) => {
      copyWhole(whole, scene)
      const pixels = whole.getImageData(0, 0, scene.width, scene.height).data
      let [black, white] = [false, false]
      for (let i = 0; i < pixels.length && !(black && white); i += 4) {
        const brightness = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3
        black ||= brightness <= 8
        white ||= brightness >= 247
      }
      return black && white
    }
    // The last drawing in which the screen alone covered the browser window: where the view landed on it.
    const landing = smallCanvas(0)
    /**
     * A coarse picture of an area of the window as the view landed on the screen, as lookAt takes of the page.
     * @param {{ x: number, y: number, width: number, height: number }} clip
     */
    const lookAtLanding = ({ x, y, width, height }) => {
      if (landing.canvas.width === 0) return undefined
      const scale = landing.canvas.width / innerWidth
      const area = { x: Math.round(x * scale), y: Math.round(y * scale), width: Math.round(width * scale), height: Math.round(height * scale) }
      const pixels = landing.getImageData(area.x, area.y, area.width, area.height).data
      const sums = new Array(grid * grid).fill(0)
      const counts = new Array(grid * grid).fill(0)
      for (let i = 0; i < pixels.length; i += 4) {
        const [column, row] = [(i / 4) % area.width, Math.floor(i / 4 / area.width)]
        const cell = Math.floor((row * grid) / area.height) * grid + Math.floor((column * grid) / area.width)
        sums[cell] += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3
        counts[cell]++
      }
      return { brightness: sums.map((sum, cell) => sum / counts[cell]) }
    }
    Object.assign(window, { lookAtIntroSceneLanding: lookAtLanding })
    /** How the scene's latest drawing looks, if there is one. */
    const look = () => {
      const scene = document.querySelector('[data-testid="intro-scene"]')
      if (!(scene instanceof HTMLCanvasElement && scene.width > 0 && scene.height > 0)) return undefined
      copy.drawImage(scene, 0, 0, size, size)
      const pixels = copy.getImageData(0, 0, size, size).data
      let darkest = 255
      let brightest = 0
      let brightestBelow = 0
      for (let i = 0; i < pixels.length; i += 4) {
        const brightness = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3
        darkest = Math.min(darkest, brightness)
        brightest = Math.max(brightest, brightness)
        if (i / 4 >= size * size * 0.6) brightestBelow = Math.max(brightestBelow, brightness)
      }
      pixelsAt.drawImage(scene, 0, 0, size, size)
      const levels = [...pixelsAt.getImageData(0, 0, size, size).data].filter((_, i) => i % 4 !== 3)
      const oneBit = levels.every((level) => level <= 8 || level >= 247) && showsBlackAndWhite(scene)
      grayPixelsAt.drawImage(scene, 0, 0, graySize, graySize)
      const grayPixels = grayPixelsAt.getImageData(0, 0, graySize, graySize).data
      let gray = true
      for (let i = 0; i < grayPixels.length && gray; i += 4) {
        const channels = [grayPixels[i], grayPixels[i + 1], grayPixels[i + 2]]
        gray = Math.max(...channels) - Math.min(...channels) <= 2
      }
      const box = scene.getBoundingClientRect()
      const fillsWindow = box.left <= 0 && box.top <= 0 && box.right >= innerWidth && box.bottom >= innerHeight
      if (oneBit && fillsWindow) copyWhole(landing, scene)
      return { time: performance.now(), darkest, brightest, brightestBelow, fillsWindow, oneBit, gray }
    }
    Object.assign(window, { lookAtIntroScene: look })

    // Each drawing of the scene starts by clearing it, and is read back once finished, before anything else
    // happens, however slowly the browser draws.
    let readQueued = false
    for (const { prototype } of [WebGLRenderingContext, WebGL2RenderingContext]) {
      const clear = prototype.clear
      prototype.clear = /** @param {number} mask */ function (mask) {
        clear.call(this, mask)
        if (readQueued) return
        readQueued = true
        queueMicrotask(() => {
          readQueued = false
          const frame = look()
          if (frame) watched.frames.push(frame)
        })
      }
    }
  }, COARSE_GRID)
}

/**
 * Looks at an area of the browser window as the view landed on the Intro's 3D screen: the last drawing in
 * which the screen alone covered the window, before it flared (see watchIntroScene).
 * @param {import('@playwright/test').Page} page
 * @param {ScreenArea} [clip] the whole window if not given
 * @returns {Promise<{ brightness: number[] } | undefined>} brightness: a coarse picture of the area, as lookAt
 *   takes of the page; nothing if the screen never covered the window
 */
async function lookAtScreenLanding(page, clip) {
  const area = clip ?? { x: 0, y: 0, ...(/** @type {{ width: number, height: number }} */ (page.viewportSize())) }
  return page.evaluate(
    (area) => /** @type {{ lookAtIntroSceneLanding: (clip: ScreenArea) => { brightness: number[] } | undefined }} */ (/** @type {unknown} */ (window)).lookAtIntroSceneLanding(area),
    area,
  )
}

/**
 * What has been seen of the Intro's 3D scene so far, since watchIntroScene started watching.
 * @param {import('@playwright/test').Page} page
 */
async function introScene(page) {
  return page.evaluate(() => {
    const { contexts, frames, poweredOnAt } = /** @type {{ introSceneWatched: { contexts: WebGLRenderingContext[], frames: IntroSceneFrame[], poweredOnAt?: number } }} */ (
      /** @type {unknown} */ (window)
    ).introSceneWatched
    const beforePowerOn = frames.filter(({ time }) => poweredOnAt === undefined || time < poweredOnAt)
    return {
      contextsMade: contexts.length,
      contextsReleased: contexts.filter((context) => context.isContextLost()).length,
      /** whether the scene was ever drawn */
      drawn: frames.length > 0,
      /** how many frames were drawn before the screen powered on */
      framesBeforePowerOn: beforePowerOn.length,
      /** whether every frame drawn before the screen powered on was black: nothing shows but by its light */
      darkUntilPowerOn: beforePowerOn.every(({ brightest }) => brightest < 8),
      /** whether, as the screen first lit, with the whole Macintosh in view, its light showed what is below it */
      litBelowScreen: (frames.find(({ time }) => poweredOnAt !== undefined && time >= poweredOnAt)?.brightestBelow ?? 0) > 60,
      /** whether every frame drawn was in shades of gray, with no color */
      gray: frames.every(({ gray }) => gray),
      /** when the scene was first drawn with its screen lit, by the page's clock */
      litAt: frames.find(({ brightest }) => brightest > 60)?.time,
      /** whether a frame showed a lit screen in a dark room: bright and black parts together */
      showedLitMacintosh: frames.some(({ darkest, brightest }) => brightest > 100 && darkest < 30),
      /** whether the screen alone covered the whole browser window, before it flared */
      screenCoveredWindow: frames.some(({ oneBit, fillsWindow }) => fillsWindow && oneBit),
      /** whether the screen flared white over the whole browser window, once it covered it */
      flaredOverWindow: frames.some(
        ({ darkest, fillsWindow }, i) => fillsWindow && darkest > 235 && frames.slice(0, i).some(({ oneBit }) => oneBit),
      ),
    }
  })
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
 * @param {{ style?: string }} [options] style: a stylesheet applied only while looking
 * @returns {Promise<{ colorfulness: number, brightness: number[] }>}
 *   colorfulness: the fraction of pixels, from 0 to 1, showing color rather than black, white, or gray;
 *   brightness: the average brightness of each cell in a 12 × 12 grid, a coarse picture of the area.
 */
async function lookAt(page, clip, { style } = {}) {
  const screenshot = await page.screenshot({ clip, style })
  return page.evaluate(async ([base64, grid]) => {
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
    const { width, height } = bitmap
    const context = /** @type {OffscreenCanvasRenderingContext2D} */ (new OffscreenCanvas(width, height).getContext('2d'))
    context.drawImage(bitmap, 0, 0)
    const pixels = context.getImageData(0, 0, width, height).data

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
  }, /** @type {const} */ ([screenshot.toString('base64'), COARSE_GRID]))
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
  THREE_JS,
  watchThreeJsRequests,
  watchIntroScene,
  introScene,
  lookAtScreenLanding,
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
