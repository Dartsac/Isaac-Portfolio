// @ts-check
const { test, expect } = require('@playwright/test')
const {
  menuBarSoundControl,
  introSoundControl,
  skipControl,
  visitPortfolio,
  openPortfolio,
  tabToNext,
  watchIntroScene,
  introScene,
} = require('./support/portfolio')

/**
 * @typedef {object} SoundHeard
 * @property {number} time when it began, by the page's clock (performance.now())
 * @property {number | undefined} screenBrightness how bright the full Intro's 3D scene was then, from 0 to
 *   255 at its brightest part, if the page was watched with watchIntroScene and the scene showed
 */

/**
 * Listens to the page from the moment it starts loading, noting each sound it makes. A chime is several
 * notes begun together, so sounds begun within a moment of each other count as one chime.
 * @param {import('@playwright/test').Page} page
 */
async function listenForChimes(page) {
  await page.addInitScript(() => {
    /** @type {SoundHeard[]} each audible sound */
    const sounds = []
    Object.assign(window, { soundsHeard: sounds })
    const start = AudioScheduledSourceNode.prototype.start
    AudioScheduledSourceNode.prototype.start = /** @param {Parameters<typeof start>} args */ function (...args) {
      // A suspended context makes no sound: the browser has not let the page play audio yet.
      if (this.context.state === 'running') {
        const look = /** @type {{ lookAtIntroScene?: () => { brightest: number } | undefined }} */ (window).lookAtIntroScene
        sounds.push({ time: performance.now(), screenBrightness: look?.()?.brightest })
      }
      return start.apply(this, args)
    }
  })
}

/**
 * The chimes the page has played so far: the first sound of each.
 * @param {import('@playwright/test').Page} page
 */
async function chimes(page) {
  const sounds = await page.evaluate(() => /** @type {{ soundsHeard: SoundHeard[] }} */ (/** @type {unknown} */ (window)).soundsHeard)
  return sounds.filter((sound, i) => i === 0 || sound.time - sounds[i - 1].time > 250)
}

/**
 * How many chimes the page has played so far.
 * @param {import('@playwright/test').Page} page
 */
async function chimesHeard(page) {
  return (await chimes(page)).length
}

/**
 * Makes the browser withhold audio until the visitor first presses or types on the page, as Safari and
 * most browsers do for a page that hasn't been interacted with.
 * @param {import('@playwright/test').Page} page
 */
async function blockAutoplay(page) {
  await page.addInitScript(() => {
    let interacted = false
    for (const type of ['pointerdown', 'keydown']) {
      window.addEventListener(type, (event) => (interacted ||= event.isTrusted), { capture: true })
    }
    const BrowserAudioContext = window.AudioContext
    window.AudioContext = class extends BrowserAudioContext {
      #allowed = interacted
      get state() {
        return this.#allowed ? super.state : 'suspended'
      }
      resume() {
        if (!interacted) return new Promise(() => {})
        this.#allowed = true
        return super.resume()
      }
    }
  })
}

/**
 * Waits until the Short Boot has started up its screen, when its chime would sound.
 * @param {import('@playwright/test').Page} page
 */
async function waitForShortBootStartUp(page) {
  // Checked every animation frame: the Short Boot shows its smiling computer only briefly.
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('[data-testid="intro-happy-computer"]')].some((happyComputer) =>
        happyComputer.checkVisibility({ opacityProperty: true }),
      ),
    undefined,
    { polling: 'raf', timeout: 10_000 },
  )
}

/**
 * Waits until the full Intro has powered on its 3D Macintosh's screen, when its chime would sound.
 * The page must be watched with watchIntroScene from before it loads.
 * @param {import('@playwright/test').Page} page
 */
async function waitForPowerOn(page) {
  await expect.poll(async () => (await introScene(page)).litAt, { message: 'the screen powers on', timeout: 10_000 }).toBeDefined()
}

/**
 * Turns sound on during a first visit, from the Intro, and skips the rest of it.
 * @param {import('@playwright/test').Page} page
 */
async function turnSoundOnInIntro(page) {
  await visitPortfolio(page)
  await introSoundControl(page).click()
  await expect(introSoundControl(page)).toHaveAttribute('aria-pressed', 'true')
  await skipControl(page).click()
}

test.describe('Sound for a first-time visitor', () => {
  test('is off by default, with each sound control showing that it is off', async ({ page }) => {
    await visitPortfolio(page)

    await expect(introSoundControl(page)).toBeVisible()
    await expect(introSoundControl(page)).toHaveAttribute('aria-pressed', 'false')
    await skipControl(page).click()
    await expect(menuBarSoundControl(page)).toBeVisible()
    await expect(menuBarSoundControl(page)).toHaveAttribute('aria-pressed', 'false')
  })

  test('stays silent while the Intro starts up the Macintosh', async ({ page }) => {
    await listenForChimes(page)
    await watchIntroScene(page)
    await visitPortfolio(page)

    await waitForPowerOn(page)
    await skipControl(page).click()

    expect(await chimesHeard(page)).toBe(0)
  })

  test('plays the chime once the visitor turns it on during the Intro, which plays on', async ({ page }) => {
    await listenForChimes(page)
    await watchIntroScene(page)
    await visitPortfolio(page)
    await waitForPowerOn(page)

    await introSoundControl(page).click()

    await expect(introSoundControl(page)).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => chimesHeard(page)).toBe(1)
    await expect(skipControl(page)).toBeVisible()
  })

  test('can be turned on from the keyboard during the Intro', async ({ page }) => {
    await visitPortfolio(page)
    await tabToNext(page)
    await expect(skipControl(page)).toBeFocused()

    await tabToNext(page)
    await expect(introSoundControl(page)).toBeFocused()
    await page.keyboard.press('Space')

    await expect(introSoundControl(page)).toHaveAttribute('aria-pressed', 'true')
    await expect(skipControl(page)).toBeVisible()
  })

  test('turned on in the Intro, stays on in the Menu Bar once the portfolio is ready', async ({ page }) => {
    await turnSoundOnInIntro(page)

    await expect(menuBarSoundControl(page)).toHaveAttribute('aria-pressed', 'true')
  })
})

test.describe('Sound in the Menu Bar', () => {
  test('turns on and off by pointer, playing the chime as it turns on', async ({ page }) => {
    await listenForChimes(page)
    await openPortfolio(page)

    await menuBarSoundControl(page).click()
    await expect(menuBarSoundControl(page)).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => chimesHeard(page)).toBe(1)

    await menuBarSoundControl(page).click()
    await expect(menuBarSoundControl(page)).toHaveAttribute('aria-pressed', 'false')
    expect(await chimesHeard(page)).toBe(1)
  })

  test('turns on and off from the keyboard', async ({ page }) => {
    await openPortfolio(page)
    await menuBarSoundControl(page).focus()

    await page.keyboard.press('Enter')
    await expect(menuBarSoundControl(page)).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.press('Space')
    await expect(menuBarSoundControl(page)).toHaveAttribute('aria-pressed', 'false')
  })

  test('works for visitors who prefer reduced motion, who have no Intro', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await listenForChimes(page)
    await openPortfolio(page)

    await menuBarSoundControl(page).click()

    await expect(menuBarSoundControl(page)).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => chimesHeard(page)).toBe(1)
  })
})

test.describe('Sound for a first-time visitor who turned it on while visiting a Section', () => {
  test('rings the chime as the full Intro powers on the 3D Macintosh’s screen', async ({ page }) => {
    // A link to a Section opens it with no Intro, so the next visit still gets the full Intro.
    await visitPortfolio(page, '#projects')
    await menuBarSoundControl(page).click()
    await expect(menuBarSoundControl(page)).toHaveAttribute('aria-pressed', 'true')

    await listenForChimes(page)
    await watchIntroScene(page)
    await visitPortfolio(page)
    await waitForPowerOn(page)

    await expect.poll(() => chimesHeard(page)).toBe(1)
    // The screen is lit as the chime rings, and the chime isn't left until long after: within a few frames,
    // however slowly the browser draws.
    const [chime] = await chimes(page)
    expect(chime.screenBrightness, 'brightest part of the 3D scene as the chime rings').toBeGreaterThan(20)
    const poweredOnAt = Number((await introScene(page)).litAt)
    expect(chime.time - poweredOnAt, 'milliseconds the chime rings after the screen is first seen lit').toBeLessThan(500)
  })
})

test.describe('Sound for a returning visitor', () => {
  test('who turned it on hears the chime with the Short Boot', async ({ page }) => {
    await turnSoundOnInIntro(page)

    await listenForChimes(page)
    await visitPortfolio(page)

    await expect(introSoundControl(page)).toHaveAttribute('aria-pressed', 'true')
    await waitForShortBootStartUp(page)
    await expect.poll(() => chimesHeard(page)).toBe(1)
  })

  test('whose browser withholds audio hears the chime as soon as they press during the Short Boot', async ({ page }) => {
    await turnSoundOnInIntro(page)

    await blockAutoplay(page)
    await listenForChimes(page)
    await visitPortfolio(page)
    await waitForShortBootStartUp(page)
    expect(await chimesHeard(page), 'withheld until the visitor interacts').toBe(0)

    await skipControl(page).click()

    await expect.poll(() => chimesHeard(page)).toBe(1)
  })

  test('who turned it off again hears nothing with the Short Boot', async ({ page }) => {
    await turnSoundOnInIntro(page)
    await menuBarSoundControl(page).click()
    await expect(menuBarSoundControl(page)).toHaveAttribute('aria-pressed', 'false')

    await listenForChimes(page)
    await visitPortfolio(page)

    await expect(introSoundControl(page)).toHaveAttribute('aria-pressed', 'false')
    await waitForShortBootStartUp(page)
    await skipControl(page).click()
    expect(await chimesHeard(page)).toBe(0)
  })
})

test.describe('Sound when browser storage is blocked', () => {
  test('starts off, and can still be turned on for this visit', async ({ page }) => {
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
    await listenForChimes(page)
    await openPortfolio(page)
    await expect(menuBarSoundControl(page)).toHaveAttribute('aria-pressed', 'false')

    await menuBarSoundControl(page).click()

    await expect(menuBarSoundControl(page)).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => chimesHeard(page)).toBe(1)
    expect(pageErrors).toEqual([])
  })
})
