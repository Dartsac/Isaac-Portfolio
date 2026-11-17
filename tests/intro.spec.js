// @ts-check
const { test, expect } = require('@playwright/test')
const {
  PHONES,
  LAYOUTS,
  useLayout,
  visitPortfolio,
  section,
  menuTitle,
  easterEggMenu,
  tabToNext,
  swipeUp,
  skipControl,
  introSoundControl,
  largestColorDifference,
} = require('./support/portfolio')

const NAME = 'Isaac Dobson'
const HEADLINE = 'Software Engineer — Data & Platform'

/**
 * Expects the portfolio to be in its ready state: the Intro is gone, Isaac's name and Headline show in
 * the Mac Window, and the Menu Bar can be used.
 * @param {import('@playwright/test').Page} page
 * @param {{ timeout?: number }} [options] how long the Intro may take to get there
 */
async function expectReady(page, { timeout } = {}) {
  await expect(skipControl(page)).toBeHidden({ timeout })
  await expect(page.getByTestId('intro-macintosh')).toBeHidden()
  const macWindow = page.getByRole('main')
  await expect(macWindow.getByRole('heading', { level: 1, name: NAME, exact: true })).toBeVisible()
  await expect(macWindow.getByText(HEADLINE, { exact: true })).toBeVisible()
  await expect(menuTitle(page, 'About')).toBeVisible()
}

/**
 * @typedef {object} IntroRecording what a visitor saw of the Intro, sampled every animation frame
 * @property {{ line: 'name' | 'headline', text: string }[]} typed each change in the typed name or Headline, in order
 * @property {number[]} macintoshHeights the on-screen height of the Intro's Macintosh while it showed
 * @property {boolean} enteredScreen whether the Intro's Macintosh's screen has covered the whole browser window
 * @property {boolean[]} bootScreenCovered for each frame the Intro showed, whether the Short Boot's screen covered the whole browser window
 * @property {boolean} smiled whether the Intro has shown its smiling computer
 */

/**
 * Records, from the moment the page starts loading, what the Intro shows on each animation frame.
 * @param {import('@playwright/test').Page} page
 */
async function recordIntro(page) {
  await page.addInitScript(() => {
    /** @type {IntroRecording} */
    const recording = { typed: [], macintoshHeights: [], enteredScreen: false, bootScreenCovered: [], smiled: false }
    Object.assign(window, { introRecording: recording })
    /** @type {Record<string, string | null>} */
    const last = {}
    /**
     * Whether what's inside an element's border covers the whole browser window, however it's scaled.
     * @param {Element | null | undefined} element
     */
    const coversWindow = (element) => {
      if (!(element instanceof HTMLElement)) return false
      const box = element.getBoundingClientRect()
      const scale = box.width / element.offsetWidth
      const [left, top] = [box.left + element.clientLeft * scale, box.top + element.clientTop * scale]
      const [right, bottom] = [left + element.clientWidth * scale, top + element.clientHeight * scale]
      return left <= 0 && top <= 0 && right >= innerWidth && bottom >= innerHeight
    }
    /** @param {Element | null | undefined} element */
    const shows = (element) => Boolean(element?.checkVisibility({ opacityProperty: true }))
    const sample = () => {
      for (const line of /** @type {const} */ (['name', 'headline'])) {
        const text = document.querySelector(`[data-testid="typed-${line}"]`)?.textContent ?? null
        if (text !== null && text !== last[line]) recording.typed.push({ line, text })
        last[line] = text
      }
      const macintosh = document.querySelector('[data-testid="intro-macintosh"]')
      if (macintosh && shows(macintosh)) {
        recording.macintoshHeights.push(macintosh.getBoundingClientRect().height)
        if (coversWindow(macintosh.querySelector('[data-testid="intro-screen"]'))) recording.enteredScreen = true
      }
      if (shows(document.querySelector('.intro__stage'))) {
        recording.bootScreenCovered.push(coversWindow(document.querySelector('[data-testid="intro-boot-screen"]')))
      }
      if ([...document.querySelectorAll('[data-testid="intro-happy-computer"]')].some(shows)) recording.smiled = true
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
}

/**
 * What has been recorded of the Intro so far.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<IntroRecording>}
 */
async function introRecording(page) {
  return page.evaluate(() => /** @type {{ introRecording: IntroRecording }} */ (/** @type {unknown} */ (window)).introRecording)
}

/**
 * Waits until the Intro or Short Boot greets the visitor with its smiling computer.
 * @param {import('@playwright/test').Page} page
 */
async function expectSmilingComputer(page) {
  await expect.poll(async () => (await introRecording(page)).smiled, 'the smiling computer shows').toBe(true)
}

/**
 * Expects the full Intro to be playing: its Macintosh appeared in the distance and is starting up.
 * @param {import('@playwright/test').Page} page
 */
async function expectFullIntroStarted(page) {
  await expectSmilingComputer(page)
  const { macintoshHeights } = await introRecording(page)
  expect(macintoshHeights[0], 'the Macintosh starts in the distance').toBeLessThan((page.viewportSize()?.height ?? 0) * 0.6)
}

/**
 * Expects a line to have been typed out one character at a time, from its first letters to the whole line.
 * @param {IntroRecording['typed']} typed
 * @param {'name' | 'headline'} line
 * @param {string} text
 */
function expectTypedOut(typed, line, text) {
  const steps = typed.filter((change) => change.line === line).map((change) => change.text)
  expect(steps.at(-1), `the whole ${line} is typed`).toBe(text)
  expect(steps[0].length, `the ${line} starts from its first letters`).toBeLessThanOrEqual(2)
  for (let i = 1; i < steps.length; i++) {
    expect(text.startsWith(steps[i]) && steps[i].length > steps[i - 1].length, `"${steps[i]}" follows "${steps[i - 1]}"`).toBe(true)
  }
  // Sampling once a frame may miss a letter now and then, but most appear one by one.
  expect(steps.length, `steps typing the ${line}`).toBeGreaterThan(text.length / 2)
}

/**
 * Opens the portfolio and expects the Short Boot: a screen covering the whole browser window from the
 * first frame starts up with its smiling computer and goes straight to the ready state, with no Macintosh
 * shown and nothing typed.
 * @param {import('@playwright/test').Page} page
 */
async function expectShortBoot(page) {
  await recordIntro(page)
  await visitPortfolio(page)

  await expect(skipControl(page)).toBeVisible()
  await expectSmilingComputer(page)
  await expectReady(page)

  const { typed, macintoshHeights, bootScreenCovered } = await introRecording(page)
  expect(bootScreenCovered.length, 'frames of the Short Boot').toBeGreaterThan(0)
  expect(bootScreenCovered, 'the screen covers the browser window in every frame').not.toContain(false)
  expect(macintoshHeights, 'frames showing a Macintosh').toEqual([])
  expect(typed, 'nothing typed').toEqual([])
}

/**
 * Expects the page to show its ready state the moment it loads, with no Intro playing. (The CRT effects'
 * grain and flicker loop forever, unless the visitor prefers reduced motion: the Intro's motions all end.)
 * @param {import('@playwright/test').Page} page
 */
async function expectReadyWithoutMotion(page) {
  // Checked once, straight away: nothing has to finish first.
  expect(await skipControl(page).isVisible(), 'skip control shown').toBe(false)
  expect(await page.getByTestId('intro-macintosh').isVisible(), 'Intro Macintosh shown').toBe(false)
  await expectReady(page)
  const introAnimations = await page.evaluate(
    () => document.getAnimations().filter((animation) => animation.effect?.getTiming().iterations !== Infinity).length,
  )
  expect(introAnimations, 'running Intro animations').toBe(0)
}

/**
 * Skips the Intro or Short Boot from the keyboard, as the first stop on the page, and expects the
 * ready state with focus where a keyboard visitor carries on from: the Menu Bar is the next stop.
 * @param {import('@playwright/test').Page} page
 * @param {string} key
 */
async function expectKeyboardSkip(page, key) {
  await tabToNext(page)
  await expect(skipControl(page)).toBeFocused()
  await page.keyboard.press(key)

  await expectReady(page)
  await tabToNext(page)
  await expect(easterEggMenu(page)).toBeFocused()
}

/**
 * Waits until the Intro has typed at least the start of Isaac's name, and is still typing the rest,
 * checking every animation frame. Each letter shows only briefly, and a busy browser may paint less often
 * than letters are typed, so the wait doesn't depend on catching one exact letter.
 * @param {import('@playwright/test').Page} page
 * @param {string} typed
 */
async function waitWhileNameTyped(page, typed) {
  await page.waitForFunction(
    ([typed, name]) => {
      const text = document.querySelector('[data-testid="typed-name"]')?.textContent ?? ''
      return text.startsWith(typed) && text !== name
    },
    [typed, NAME],
    { polling: 'raf', timeout: 10_000 },
  )
}

test.describe('Intro for a first-time visitor', () => {
  test('can be skipped with the pointer, reaching the ready state', async ({ page }) => {
    await visitPortfolio(page)

    await expect(skipControl(page)).toBeVisible()
    await expect(page.getByTestId('intro-macintosh')).toBeVisible()
    await skipControl(page).click()

    await expectReady(page)
  })

  for (const key of ['Enter', 'Space']) {
    test(`can be skipped from the keyboard with ${key}, leaving focus ready to carry on`, async ({ page }) => {
      await visitPortfolio(page)
      await expect(skipControl(page)).toBeVisible()

      await expectKeyboardSkip(page, key)
    })
  }

  test('ends when a keyboard visitor moves on past its controls, so focus is never hidden', async ({ page }) => {
    await visitPortfolio(page)
    await tabToNext(page)
    await expect(skipControl(page)).toBeFocused()
    await tabToNext(page)
    await expect(introSoundControl(page)).toBeFocused()
    await expect(skipControl(page)).toBeVisible()

    await tabToNext(page)

    await expectReady(page)
    await expect(easterEggMenu(page)).toBeFocused()
  })

  test('ends when the visitor chooses a Section while the name is typed', async ({ page }) => {
    await visitPortfolio(page)
    await waitWhileNameTyped(page, 'I')

    await menuTitle(page, 'Contact').click()

    // Straight away, well before the Intro would have finished typing the Headline.
    await expectReady(page, { timeout: 1_000 })
    await expect(section(page, 'Contact')).toBeInViewport()
  })

  test('keeps Isaac’s name and Headline available as text throughout, even while they are typed', async ({ page }) => {
    // Read once, at that moment: a retrying assertion could pass only after the Intro had ended.
    const expectNameAndHeadlineAsText = async () => {
      const lines = (await page.getByRole('main').ariaSnapshot()).split('\n').map((line) => line.trim())
      expect(lines).toContain(`- heading "${NAME}" [level=1]`)
      expect(lines).toContain(`- paragraph: ${HEADLINE}`)
    }
    await recordIntro(page)
    await visitPortfolio(page)

    // While the Macintosh boots…
    await expectSmilingComputer(page)
    await expectNameAndHeadlineAsText()

    // …and halfway through typing the name.
    await waitWhileNameTyped(page, 'Isaac')
    await expectNameAndHeadlineAsText()
    expect(await page.getByTestId('typed-name').textContent(), 'still typing').not.toBe(NAME)
  })
})

for (const layout of LAYOUTS) {
  test.describe(`Intro for a first-time visitor on ${layout.name}`, () => {
    useLayout(layout)

    test('boots the Macintosh, zooms until its screen is the whole screen, and types Isaac’s name and then the Headline', async ({
      page,
    }) => {
      await recordIntro(page)
      await visitPortfolio(page)

      // The Macintosh boots in the distance, greeting the visitor with a smiling computer.
      await expectFullIntroStarted(page)
      await expectReady(page, { timeout: 15_000 })

      const { typed, enteredScreen } = await introRecording(page)
      expect(enteredScreen, 'the Macintosh’s screen covers the whole browser window').toBe(true)
      expectTypedOut(typed, 'name', NAME)
      expectTypedOut(typed, 'headline', HEADLINE)
      const nameDone = typed.findIndex(({ line, text }) => line === 'name' && text === NAME)
      const headlineStarts = typed.findIndex(({ line, text }) => line === 'headline' && text.length > 0)
      expect(headlineStarts, 'the Headline is typed after the name').toBeGreaterThan(nameDone)
    })

    test('ends exactly where skipping it does', async ({ page }) => {
      await visitPortfolio(page)
      await expectReady(page, { timeout: 15_000 })
      await page.mouse.move(0, 0)
      // The CRT effects' grain and flicker never stop moving: compared at rest.
      const playedOut = await page.screenshot({ animations: 'disabled' })

      await page.evaluate(() => localStorage.clear())
      await visitPortfolio(page)
      await skipControl(page).click()
      await expectReady(page)
      await page.mouse.move(0, 0)

      // For a moment after skipping, Chromium may still shade a few antialiased pixels of the screen's rounded
      // corners differently as it settles how to composite the screen, so the comparison waits for that.
      await expect
        .poll(
          async () => largestColorDifference(page, await page.screenshot({ animations: 'disabled' }), playedOut),
          'how far the two ready states differ',
        )
        .toBeLessThanOrEqual(2)
    })
  })
}

test.describe('Intro on a touch screen', () => {
  // Playwright can only swipe in Chromium, so on the Android phone.
  useLayout(/** @type {import('./support/portfolio').Layout} */ (PHONES.find(({ name }) => name === 'Pixel 7')))

  test('leaves the portfolio at its start when the visitor swipes during the Intro', async ({ page }) => {
    await recordIntro(page)
    await visitPortfolio(page)
    await expectSmilingComputer(page)

    // A real touch swipe up the screen, as if to read on.
    await swipeUp(page)
    await skipControl(page).click()

    await expectReady(page)
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
  })
})

test.describe('Short Boot for a returning visitor', () => {
  test('follows a first visit whose Intro was skipped', async ({ page }) => {
    await visitPortfolio(page)
    await skipControl(page).click()
    await expectReady(page)

    await expectShortBoot(page)
  })

  test('follows a first visit whose Intro played to the end', async ({ page }) => {
    await visitPortfolio(page)
    await expectReady(page, { timeout: 15_000 })

    await expectShortBoot(page)
  })

  test('can be skipped with the pointer', async ({ page }) => {
    await visitPortfolio(page)
    await skipControl(page).click()
    await expectReady(page)

    await visitPortfolio(page)
    await expect(skipControl(page)).toBeVisible()
    await skipControl(page).click()

    await expectReady(page)
  })

  test('can be skipped from the keyboard', async ({ page }) => {
    await visitPortfolio(page)
    await skipControl(page).click()
    await expectReady(page)

    await visitPortfolio(page)

    await expectKeyboardSkip(page, 'Enter')
  })
})

test.describe('Intro for a visitor following a link to a Section', () => {
  test('steps aside, opening right at the Section', async ({ page }) => {
    await visitPortfolio(page, '#projects', { waitUntil: 'domcontentloaded' })

    await expectReadyWithoutMotion(page)
    await expect(section(page, 'Projects')).toBeInViewport()
  })

  test('still plays in full on the visitor’s next visit to the portfolio itself', async ({ page }) => {
    await visitPortfolio(page, '#projects')
    await expectReady(page)

    await recordIntro(page)
    await visitPortfolio(page)

    await expectFullIntroStarted(page)
  })

  for (const { fragment, names } of [
    { fragment: '#nowhere', names: 'nothing' },
    { fragment: '#education-title', names: 'something other than a Section' },
  ]) {
    test(`plays as usual when the link names ${names}`, async ({ page }) => {
      await recordIntro(page)
      await visitPortfolio(page, fragment)

      await expect(skipControl(page)).toBeVisible()
      await expectFullIntroStarted(page)
    })
  }
})

/**
 * Ways a browser can withhold storage: blocked outright, as when a visitor blocks site data, or missing.
 * @type {{ name: string, storage: 'blocked' | 'missing' }[]}
 */
const WITHHELD_STORAGE = [
  { name: 'blocked', storage: 'blocked' },
  { name: 'unavailable', storage: 'missing' },
]

for (const { name, storage } of WITHHELD_STORAGE) {
  test.describe(`Intro when browser storage is ${name}`, () => {
    /** @type {Error[]} */
    let pageErrors

    test.beforeEach(async ({ page }) => {
      pageErrors = []
      page.on('pageerror', (error) => pageErrors.push(error))
      await page.addInitScript((storage) => {
        const withheld =
          storage === 'blocked'
            ? () => {
                throw new DOMException('Access is denied for this document.', 'SecurityError')
              }
            : () => undefined
        for (const property of ['localStorage', 'sessionStorage']) {
          Object.defineProperty(window, property, { get: withheld, configurable: true })
        }
      }, storage)
    })

    test('plays the full Intro through to the ready state', async ({ page }) => {
      await recordIntro(page)
      await visitPortfolio(page)

      await expectReady(page, { timeout: 15_000 })
      expectTypedOut((await introRecording(page)).typed, 'name', NAME)
      expect(pageErrors).toEqual([])
    })

    test('treats a return visit as a first visit', async ({ page }) => {
      await visitPortfolio(page)
      await skipControl(page).click()
      await expectReady(page)

      await recordIntro(page)
      await visitPortfolio(page)
      await expect(skipControl(page)).toBeVisible()
      await expectFullIntroStarted(page)

      await skipControl(page).click()
      await expectReady(page)
      expect(pageErrors).toEqual([])
    })
  })
}

test.describe('Intro for a visitor who prefers reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('shows the ready state immediately on a first visit', async ({ page }) => {
    await visitPortfolio(page, '', { waitUntil: 'domcontentloaded' })

    await expectReadyWithoutMotion(page)
  })

  test('shows the ready state immediately on a return visit, rather than the Short Boot', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await visitPortfolio(page)
    await skipControl(page).click()
    await expectReady(page)

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await visitPortfolio(page, '', { waitUntil: 'domcontentloaded' })

    await expectReadyWithoutMotion(page)
  })

  test('ends a playing Intro as soon as the visitor asks for reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await recordIntro(page)
    await visitPortfolio(page)
    await expectSmilingComputer(page)

    await page.emulateMedia({ reducedMotion: 'reduce' })

    await expectReady(page, { timeout: 1_000 })
    expect(await page.evaluate(() => document.getAnimations().length), 'running animations').toBe(0)
  })
})
