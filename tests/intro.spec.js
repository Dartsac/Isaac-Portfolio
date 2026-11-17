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
  THREE_JS,
  watchThreeJsRequests,
  watchIntroScene,
  introScene,
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
  // The 3D scene is gone, and released, so nothing of it keeps drawing.
  await expect(page.locator('canvas')).toHaveCount(0)
  const watchingScene = await page.evaluate(() => 'introSceneWatched' in window)
  if (watchingScene) {
    const { contextsMade, contextsReleased } = await introScene(page)
    expect(contextsReleased, 'WebGL contexts released').toBe(contextsMade)
  }
  const macWindow = page.getByRole('main')
  await expect(macWindow.getByRole('heading', { level: 1, name: NAME, exact: true })).toBeVisible()
  await expect(macWindow.getByText(HEADLINE, { exact: true })).toBeVisible()
  await expect(menuTitle(page, 'About')).toBeVisible()
}

/**
 * @typedef {object} IntroRecording what a visitor saw of the Intro, sampled every animation frame
 * @property {{ line: 'name' | 'headline', text: string }[]} typed each change in the typed name or Headline, in order
 * @property {boolean[]} bootScreenCovered for each frame the Intro showed, whether the Short Boot's screen covered the whole browser window
 * @property {boolean} smiled whether the Intro has shown its smiling computer
 */

/**
 * Records, from the moment the page starts loading, what the Intro shows on each animation frame, its
 * 3D scene included (see introScene).
 * @param {import('@playwright/test').Page} page
 */
async function recordIntro(page) {
  await watchIntroScene(page)
  await page.addInitScript(() => {
    /** @type {IntroRecording} */
    const recording = { typed: [], bootScreenCovered: [], smiled: false }
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
 * Waits until the Short Boot greets the visitor with its smiling computer.
 * @param {import('@playwright/test').Page} page
 */
async function expectSmilingComputer(page) {
  await expect.poll(async () => (await introRecording(page)).smiled, 'the smiling computer shows').toBe(true)
}

/**
 * Expects the full Intro to be playing: its 3D Macintosh has powered on, lit by its screen in a dark room.
 * @param {import('@playwright/test').Page} page
 */
async function expectFullIntroStarted(page) {
  await expect
    .poll(async () => (await introScene(page)).showedLitMacintosh, { message: 'the 3D Macintosh powers on', timeout: 10_000 })
    .toBe(true)
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
 * first frame starts up with its smiling computer and goes straight to the ready state, with no 3D
 * Macintosh, no three.js, and nothing typed.
 * @param {import('@playwright/test').Page} page
 */
async function expectShortBoot(page) {
  await recordIntro(page)
  const threeJsRequests = watchThreeJsRequests(page)
  await visitPortfolio(page)

  await expect(skipControl(page)).toBeVisible()
  await expectSmilingComputer(page)
  await expectReady(page)

  const { typed, bootScreenCovered } = await introRecording(page)
  expect(bootScreenCovered.length, 'frames of the Short Boot').toBeGreaterThan(0)
  expect(bootScreenCovered, 'the screen covers the browser window in every frame').not.toContain(false)
  expect((await introScene(page)).contextsMade, 'WebGL contexts made').toBe(0)
  expect(threeJsRequests, 'three.js requests').toEqual([])
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
    await watchIntroScene(page)
    await visitPortfolio(page)

    await expect(skipControl(page)).toBeVisible()
    await expectFullIntroStarted(page)
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
    await watchIntroScene(page)
    await visitPortfolio(page)
    await expectFullIntroStarted(page)
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
    await watchIntroScene(page)
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
    await expectFullIntroStarted(page)
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

    test('boots the 3D Macintosh, enters its screen as it flares white, and types Isaac’s name and then the Headline', async ({
      page,
    }) => {
      await recordIntro(page)
      const threeJsRequests = watchThreeJsRequests(page)
      await visitPortfolio(page)

      // The Macintosh powers on in a dark room, lit by its screen.
      await expectFullIntroStarted(page)
      await expectReady(page, { timeout: 15_000 })

      const siteOrigin = new URL(page.url()).origin
      expect(threeJsRequests.length, 'three.js requests').toBeGreaterThan(0)
      for (const request of threeJsRequests) expect(new URL(request).origin, request).toBe(siteOrigin)
      const { screenCoveredWindow, flaredOverWindow } = await introScene(page)
      expect(screenCoveredWindow, 'the screen alone covers the whole browser window').toBe(true)
      expect(flaredOverWindow, 'then flares white over it').toBe(true)
      const { typed } = await introRecording(page)
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

/**
 * Ways a visitor ends the Intro before it has played out, while the Intro has focus or the pointer. (The
 * Menu Bar can't be pressed until the name is typed: until then the Intro's dark room covers it.)
 * @type {{ name: string, end: (page: import('@playwright/test').Page) => Promise<unknown> }[]}
 */
const EARLY_ENDINGS = [
  { name: 'skipping with the pointer', end: (page) => skipControl(page).click() },
  {
    name: 'skipping from the keyboard',
    end: async (page) => {
      await tabToNext(page)
      await page.keyboard.press('Enter')
    },
  },
  {
    name: 'tabbing past its controls',
    end: async (page) => {
      for (let i = 0; i < 3; i++) await tabToNext(page)
    },
  },
  { name: 'asking for reduced motion', end: (page) => page.emulateMedia({ reducedMotion: 'reduce' }) },
]

test.describe('Intro while three.js is still loading', () => {
  for (const { name, end } of EARLY_ENDINGS) {
    test(`ends at once on ${name}, and its 3D scene never shows once three.js arrives`, async ({ page }) => {
      await watchIntroScene(page)
      /** @type {() => void} */
      let deliverThreeJs = () => {}
      const delivered = new Promise((resolve) => (deliverThreeJs = () => resolve(undefined)))
      await page.route(THREE_JS, async (route) => {
        await delivered
        await route.continue()
      })
      const threeJsRequested = page.waitForRequest((request) => THREE_JS.test(request.url()))
      // WebKit may hold the page's load event for three.js, which is held back here.
      await visitPortfolio(page, '', { waitUntil: 'domcontentloaded' })
      await threeJsRequested

      // Ending while three.js is held back shows the Intro doesn't wait for it.
      await end(page)
      await expectReady(page)

      deliverThreeJs()
      await page.waitForLoadState('networkidle')
      await expect(page.locator('canvas')).toHaveCount(0)
      expect((await introScene(page)).contextsMade, 'WebGL contexts made').toBe(0)
    })
  }
})

test.describe('Intro whose 3D scene fails to load', () => {
  test('ends in the ready state', async ({ page }) => {
    await watchIntroScene(page)
    await page.route(THREE_JS, (route) => route.fulfill({ status: 404 }))
    await visitPortfolio(page)

    await expectReady(page)
    expect((await introScene(page)).contextsMade, 'WebGL contexts made').toBe(0)
  })
})

test.describe('Intro on a touch screen', () => {
  // Playwright can only swipe in Chromium, so on the Android phone.
  useLayout(/** @type {import('./support/portfolio').Layout} */ (PHONES.find(({ name }) => name === 'Pixel 7')))

  test('leaves the portfolio at its start when the visitor swipes during the Intro', async ({ page }) => {
    await recordIntro(page)
    await visitPortfolio(page)
    await expectFullIntroStarted(page)

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
    const threeJsRequests = watchThreeJsRequests(page)
    await visitPortfolio(page, '#projects', { waitUntil: 'domcontentloaded' })

    await expectReadyWithoutMotion(page)
    await expect(section(page, 'Projects')).toBeInViewport()
    await page.waitForLoadState('networkidle')
    expect(threeJsRequests, 'three.js requests').toEqual([])
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

  test('shows the ready state immediately on a first visit, without loading three.js', async ({ page }) => {
    const threeJsRequests = watchThreeJsRequests(page)
    await visitPortfolio(page, '', { waitUntil: 'domcontentloaded' })

    await expectReadyWithoutMotion(page)
    await page.waitForLoadState('networkidle')
    expect(threeJsRequests, 'three.js requests').toEqual([])
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
    await expectFullIntroStarted(page)

    await page.emulateMedia({ reducedMotion: 'reduce' })

    await expectReady(page, { timeout: 1_000 })
    expect(await page.evaluate(() => document.getAnimations().length), 'running animations').toBe(0)
  })
})
