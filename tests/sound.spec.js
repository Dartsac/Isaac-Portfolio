// @ts-check
const { test, expect } = require('@playwright/test')
const { menuBarSoundControl, introSoundControl, skipControl, openPortfolio, tabToNext } = require('./support/portfolio')

/**
 * Listens to the page from the moment it starts loading, noting each sound it makes. A chime is several
 * notes begun together, so sounds begun within a moment of each other count as one chime.
 * @param {import('@playwright/test').Page} page
 */
async function listenForChimes(page) {
  await page.addInitScript(() => {
    /** @type {number[]} when each audible sound began */
    const sounds = []
    Object.assign(window, { soundsHeard: sounds })
    const start = AudioScheduledSourceNode.prototype.start
    AudioScheduledSourceNode.prototype.start = function (...args) {
      // A suspended context makes no sound: the browser has not let the page play audio yet.
      if (this.context.state === 'running') sounds.push(performance.now())
      return start.apply(this, args)
    }
  })
}

/**
 * How many chimes the page has played so far.
 * @param {import('@playwright/test').Page} page
 */
async function chimesHeard(page) {
  const sounds = await page.evaluate(() => /** @type {{ soundsHeard: number[] }} */ (/** @type {unknown} */ (window)).soundsHeard)
  return sounds.filter((time, i) => i === 0 || time - sounds[i - 1] > 250).length
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
 * Waits until the Intro or Short Boot has started up the Macintosh, when its chime would sound.
 * @param {import('@playwright/test').Page} page
 */
async function waitForStartUp(page) {
  // Checked every animation frame: the Short Boot shows its smiling computer only briefly.
  await page.waitForFunction(
    () => document.querySelector('[data-testid="intro-happy-computer"]')?.checkVisibility({ opacityProperty: true }),
    undefined,
    { polling: 'raf', timeout: 10_000 },
  )
}

/**
 * Turns sound on during a first visit, from the Intro, and skips the rest of it.
 * @param {import('@playwright/test').Page} page
 */
async function turnSoundOnInIntro(page) {
  await page.goto('./')
  await introSoundControl(page).click()
  await expect(introSoundControl(page)).toHaveAttribute('aria-pressed', 'true')
  await skipControl(page).click()
}

test.describe('Sound for a first-time visitor', () => {
  test('is off by default, with each sound control showing that it is off', async ({ page }) => {
    await page.goto('./')

    await expect(introSoundControl(page)).toBeVisible()
    await expect(introSoundControl(page)).toHaveAttribute('aria-pressed', 'false')
    await skipControl(page).click()
    await expect(menuBarSoundControl(page)).toBeVisible()
    await expect(menuBarSoundControl(page)).toHaveAttribute('aria-pressed', 'false')
  })

  test('stays silent while the Intro starts up the Macintosh', async ({ page }) => {
    await listenForChimes(page)
    await page.goto('./')

    await waitForStartUp(page)
    await skipControl(page).click()

    expect(await chimesHeard(page)).toBe(0)
  })

  test('plays the chime once the visitor turns it on during the Intro, which plays on', async ({ page }) => {
    await listenForChimes(page)
    await page.goto('./')
    await waitForStartUp(page)

    await introSoundControl(page).click()

    await expect(introSoundControl(page)).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => chimesHeard(page)).toBe(1)
    await expect(skipControl(page)).toBeVisible()
  })

  test('can be turned on from the keyboard during the Intro', async ({ page }) => {
    await page.goto('./')
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

test.describe('Sound for a returning visitor', () => {
  test('who turned it on hears the chime with the Short Boot', async ({ page }) => {
    await turnSoundOnInIntro(page)

    await listenForChimes(page)
    await page.goto('./')

    await expect(introSoundControl(page)).toHaveAttribute('aria-pressed', 'true')
    await waitForStartUp(page)
    await expect.poll(() => chimesHeard(page)).toBe(1)
  })

  test('whose browser withholds audio hears the chime as soon as they press during the Short Boot', async ({ page }) => {
    await turnSoundOnInIntro(page)

    await blockAutoplay(page)
    await listenForChimes(page)
    await page.goto('./')
    await waitForStartUp(page)
    expect(await chimesHeard(page), 'withheld until the visitor interacts').toBe(0)

    await skipControl(page).click()

    await expect.poll(() => chimesHeard(page)).toBe(1)
  })

  test('who turned it off again hears nothing with the Short Boot', async ({ page }) => {
    await turnSoundOnInIntro(page)
    await menuBarSoundControl(page).click()
    await expect(menuBarSoundControl(page)).toHaveAttribute('aria-pressed', 'false')

    await listenForChimes(page)
    await page.goto('./')

    await expect(introSoundControl(page)).toHaveAttribute('aria-pressed', 'false')
    await waitForStartUp(page)
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
