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
  lookAt,
  similarity,
  menuBar,
  boxOf,
  THREE_JS,
  watchThreeJsRequests,
  watchIntroScene,
  introScene,
  lookAtScreenLanding,
  lookAtScreenLandingRows,
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
 * @property {{ line: 'name' | 'headline', text: string, time: number }[]} typed each change in the typed name or Headline,
 *   in order, and when it showed, by the page's clock
 * @property {number | undefined} shownAt when the Intro first showed, by the page's clock (performance.now())
 * @property {{ time: number, covered: boolean }[]} bootScreen for each frame the Short Boot's screen showed: when, by
 *   the page's clock, and whether it covered the whole browser window
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
    const recording = { typed: [], shownAt: undefined, bootScreen: [], smiled: false }
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
        if (text !== null && text !== last[line]) recording.typed.push({ line, text, time: performance.now() })
        last[line] = text
      }
      if (shows(document.querySelector('.intro__stage'))) {
        const time = performance.now()
        recording.shownAt ??= time
        const bootScreen = document.querySelector('[data-testid="intro-boot-screen"]')
        if (bootScreen?.checkVisibility()) recording.bootScreen.push({ time, covered: coversWindow(bootScreen) })
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
 * Waits until the Short Boot starts, its dark screen covering the browser window, and skips it at once. It
 * plays for little more than a second and a half, and a busy browser may take a while to press the skip control.
 * @param {import('@playwright/test').Page} page
 */
async function skipShortBootAsItStarts(page) {
  await page.getByTestId('intro-boot-screen').waitFor()
  await skipControl(page).click()
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
 * Expects the full Intro's 3D scene never to have shown: it was never drawn, and nothing of it is left, with
 * every WebGL context the page made released. (Checking whether the browser can draw the scene may make one.)
 * @param {import('@playwright/test').Page} page
 */
async function expectSceneNeverShown(page) {
  await expect(page.locator('canvas')).toHaveCount(0)
  const { drawn, contextsMade, contextsReleased } = await introScene(page)
  expect(drawn, 'the 3D scene drawn').toBe(false)
  expect(contextsReleased, 'WebGL contexts released').toBe(contextsMade)
}

/**
 * Expects the 3D screen, as the view landed on it, to have been drawn crisp, in pure black and white: all but a
 * few of its pixels, where the edges of the screen's triangles are smoothed, as the screen's 1-bit picture shows.
 * A picture drawn smaller than the window shows it, and so smoothed, leaves gray along every line and letter.
 * @param {number} grayShare the share of the window's pixels, from 0 to 1, neither pure black nor pure white
 */
function expectCrisp(grayShare) {
  expect(grayShare, 'share of the screen neither pure black nor pure white').toBeLessThan(0.001)
}

/**
 * Expects the view to have landed on the 3D screen with nothing drawn on it but the Mac Desktop's 1-bit
 * pattern: crisp, and the same even gray all over, as a phone's screen shows once the smiling computer has gone.
 * @param {import('@playwright/test').Page} page
 */
async function expectLandedOnPatternOnly(page) {
  const screenAsLanded = await lookAtScreenLanding(page)
  expect(screenAsLanded, 'the screen alone covers the whole browser window').toBeDefined()
  const { brightness, grayShare } = /** @type {{ brightness: number[], grayShare: number }} */ (screenAsLanded)
  expectCrisp(grayShare)
  const mean = brightness.reduce((sum, cell) => sum + cell, 0) / brightness.length
  expect(mean, 'a 50% pattern, on average').toBeGreaterThan(100)
  expect(mean, 'a 50% pattern, on average').toBeLessThan(160)
  for (const cell of brightness) expect(Math.abs(cell - mean), 'the same gray all over').toBeLessThan(12)
}

/**
 * Expects the view to have landed on the 3D screen's Menu Bar reaching both ends of the browser window, from
 * its first menu to its sound control, as the live one does: in the upper half of the live Menu Bar, at each
 * end of the window, something is drawn, a cell darker than plain white, both on the live page and on the 3D
 * screen as the view landed on it.
 * @param {import('@playwright/test').Page} page
 */
async function expectLandedOnWholeMenuBar(page) {
  const bar = await boxOf(menuBar(page))
  const end = { y: 0, width: bar.width * 0.1, height: bar.height / 2 }
  for (const { name, area } of [
    { name: 'left', area: { x: 0, ...end } },
    { name: 'right', area: { x: bar.width * 0.9, ...end } },
  ]) {
    const live = await lookAt(page, area, { style: '.crt { display: none; }' })
    expect(Math.min(...live.brightness), `something drawn at the live Menu Bar’s ${name} end`).toBeLessThan(250)
    const landed = /** @type {{ brightness: number[] }} */ (await lookAtScreenLanding(page, area))
    expect(Math.min(...landed.brightness), `something drawn at the 3D Menu Bar’s ${name} end`).toBeLessThan(250)
  }
}

/**
 * Expects the view to have landed square to the 3D screen, with nothing left of its swing round to face it: at
 * each end of the browser window, the 3D Menu Bar's rule is where the live one's is, so it runs level, as the
 * live one does. A view left at an angle, tilted, or rolled would show it slanting, or higher or lower.
 * @param {import('@playwright/test').Page} page
 */
async function expectLandedSquare(page) {
  const liveRule = await menuBar(page).evaluate(
    (bar) => bar.getBoundingClientRect().bottom - parseFloat(getComputedStyle(bar).borderBottomWidth),
  )
  const { width } = /** @type {{ width: number }} */ (page.viewportSize())
  // Narrow strips at the window's ends, clear of the Menu Bar's menus: white down to the rule.
  const strip = 8
  /** @type {number[]} */
  const rules = []
  for (const { name, x } of [
    { name: 'left', x: 2 },
    { name: 'right', x: width - 2 - strip },
  ]) {
    const rows = await lookAtScreenLandingRows(page, { x, y: 0, width: strip, height: liveRule + 12 })
    expect(rows, 'the screen alone covers the whole browser window').toBeDefined()
    const found = /** @type {{ y: number, brightness: number }[]} */ (rows).find(({ brightness }) => brightness < 64)
    expect(found, `the 3D Menu Bar’s rule at the window’s ${name} end`).toBeDefined()
    const rule = /** @type {{ y: number }} */ (found).y
    expect(Math.abs(rule - liveRule), `CSS pixels from the live rule at the window’s ${name} end`).toBeLessThanOrEqual(1.5)
    rules.push(rule)
  }
  expect(Math.abs(rules[0] - rules[1]), 'CSS pixels between the 3D rule’s ends: level').toBeLessThanOrEqual(1)
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
 * Expects the Short Boot to play through, as recordIntro records it: a screen covering the whole browser
 * window in every frame it shows starts up with its smiling computer and goes straight to the ready state,
 * with no 3D Macintosh and nothing typed.
 * @param {import('@playwright/test').Page} page
 */
async function expectShortBootPlays(page) {
  await expect(skipControl(page)).toBeVisible()
  await expectSmilingComputer(page)
  await expectReady(page)

  const { typed, bootScreen } = await introRecording(page)
  expect(bootScreen.length, 'frames of the Short Boot').toBeGreaterThan(0)
  expect(
    bootScreen.map(({ covered }) => covered),
    'the screen covers the browser window in every frame',
  ).not.toContain(false)
  await expectSceneNeverShown(page)
  expect(typed, 'nothing typed').toEqual([])
}

/**
 * Opens the portfolio and expects the Short Boot, without three.js or any WebGL.
 * @param {import('@playwright/test').Page} page
 */
async function expectShortBoot(page) {
  await recordIntro(page)
  const threeJsRequests = watchThreeJsRequests(page)
  await visitPortfolio(page)

  await expectShortBootPlays(page)
  expect((await introScene(page)).contextsMade, 'WebGL contexts made').toBe(0)
  expect(threeJsRequests, 'three.js requests').toEqual([])
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

  test('downloads nothing for its 3D scene but three.js and the script that builds it', async ({ page, browser, baseURL }) => {
    /**
     * The address of each file a page downloads from now on.
     * @param {import('@playwright/test').Page} page
     */
    const watchDownloads = (page) => {
      /** @type {Set<string>} */
      const downloads = new Set()
      page.on('request', (request) => {
        if (/^https?:/.test(request.url())) downloads.add(request.url())
      })
      return downloads
    }
    const introDownloads = watchDownloads(page)
    await visitPortfolio(page)
    await expectReady(page, { timeout: 15_000 })
    await page.waitForLoadState('networkidle')

    // The same portfolio without any Intro, for a visitor who prefers reduced motion.
    const withoutIntro = await browser.newPage({ baseURL, reducedMotion: 'reduce' })
    const readyStateDownloads = watchDownloads(withoutIntro)
    await visitPortfolio(withoutIntro)
    await withoutIntro.waitForLoadState('networkidle')
    await withoutIntro.close()

    const forTheScene = [...introDownloads].filter((url) => !readyStateDownloads.has(url))
    expect(forTheScene.length, 'downloads for the 3D scene').toBeGreaterThan(0)
    for (const url of forTheScene) expect(url, 'downloaded for the 3D scene').toMatch(new RegExp(`${THREE_JS.source}|${INTRO_SCENE.source}`))
  })

  test('shows the live caret where the name will be typed from the moment the screen crossfades into the page', async ({ page }) => {
    await visitPortfolio(page)

    // Read as the handoff begins, in the frame the Mac Window opens for typing, before any letter is typed.
    const atHandoff = await page.waitForFunction(
      () => {
        if (document.documentElement.dataset.introPhase !== 'typing') return false
        const caret = document.querySelector('.ready-title__name .intro-typing__caret')
        return {
          caretShown: caret instanceof HTMLElement && caret.checkVisibility(),
          typed: document.querySelector('[data-testid="typed-name"]')?.textContent ?? '',
        }
      },
      undefined,
      { polling: 'raf', timeout: 15_000 },
    )

    expect(await atHandoff.jsonValue()).toEqual({ caretShown: true, typed: '' })
  })

  test('lands on its screen about 4 seconds in, a second of power-on and three of moving in, and types Isaac’s name straight after', async ({
    page,
  }) => {
    await recordIntro(page)
    await visitPortfolio(page)
    await expectReady(page, { timeout: 15_000 })

    // Timed from the screen lighting, a moment after the dark scene first appears. How long that first dark
    // frame takes to draw is up to the graphics, so the moment after it is not timed.
    const { litAt, landedAt } = await introScene(page)
    const { typed } = await introRecording(page)
    expect(litAt, 'the screen lights').toBeDefined()
    expect(landedAt, 'the view lands on the screen').toBeDefined()
    const landing = /** @type {number} */ (landedAt) - /** @type {number} */ (litAt)
    expect(landing, 'milliseconds from the screen lighting to the landing').toBeGreaterThan(3_400)
    expect(landing, 'milliseconds from the screen lighting to the landing').toBeLessThan(4_400)
    const typingStarts = typed[0].time - /** @type {number} */ (landedAt)
    expect(typingStarts, 'milliseconds from the landing to the first letter typed').toBeLessThan(800)
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

    const phone = layout.name !== 'desktop'

    test('boots the 3D Macintosh, lands on its screen, crossfades into the page without flaring, and types Isaac’s name and then the Headline', async ({
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
      expect(flaredOverWindow, 'then flares white over it').toBe(false)
      const { typed } = await introRecording(page)
      expectTypedOut(typed, 'name', NAME)
      expectTypedOut(typed, 'headline', HEADLINE)
      const nameDone = typed.findIndex(({ line, text }) => line === 'name' && text === NAME)
      const headlineStarts = typed.findIndex(({ line, text }) => line === 'headline' && text.length > 0)
      expect(headlineStarts, 'the Headline is typed after the name').toBeGreaterThan(nameDone)
    })

    if (phone) {
      test('lands on its screen with nothing drawn on it but the pattern', async ({ page }) => {
        await watchIntroScene(page)
        await visitPortfolio(page)
        await expectReady(page, { timeout: 15_000 })

        await expectLandedOnPatternOnly(page)
      })
    }

    // A phone's screen shows no Mac Desktop: see above.
    if (!phone) {
      test('shows on its screen the Mac Desktop the view then lands on: the Menu Bar and an empty Mac Window', async ({
        page,
      }) => {
        await watchIntroScene(page)
        await visitPortfolio(page)

        // The Mac Desktop the visitor lands on, as typing starts, seen without the Intro fading over it.
        await page.waitForFunction(() => document.documentElement.dataset.introPhase === 'typing', undefined, {
          polling: 'raf',
          timeout: 15_000,
        })
        const screen = /** @type {{ width: number, height: number }} */ (page.viewportSize())
        const landedOn = await lookAt(page, { x: 0, y: 0, ...screen }, { style: '.intro { visibility: hidden !important; }' })
        await expectReady(page, { timeout: 15_000 })

        const screenAsLanded = await lookAtScreenLanding(page)
        expect(screenAsLanded, 'the screen alone covers the whole browser window').toBeDefined()
        const { brightness, grayShare } = /** @type {{ brightness: number[], grayShare: number }} */ (screenAsLanded)
        expect(similarity(brightness, landedOn.brightness), 'how alike the screen and the Mac Desktop look').toBeGreaterThan(0.7)
        expectCrisp(grayShare)
      })

      test('lands square on its screen’s Menu Bar, reaching both ends of the window from the first menu to the sound control, as the live one does', async ({
        page,
      }) => {
        await watchIntroScene(page)
        await visitPortfolio(page)
        await expectReady(page, { timeout: 15_000 })

        await expectLandedSquare(page)
        await expectLandedOnWholeMenuBar(page)
      })
    }

    test('is dark until its screen powers on, then lit by the screen’s glow with the whole Macintosh in view, in shades of gray', async ({
      page,
    }) => {
      await watchIntroScene(page)
      await visitPortfolio(page)

      await expectFullIntroStarted(page)
      await expectReady(page, { timeout: 15_000 })

      const { framesBeforePowerOn, darkUntilPowerOn, litBelowScreen, framedByDarkRoom, gray } = await introScene(page)
      expect(framesBeforePowerOn, 'frames drawn before the screen powers on').toBeGreaterThan(0)
      expect(darkUntilPowerOn, 'nothing shows until the screen powers on').toBe(true)
      expect(litBelowScreen, 'the screen lights the keyboard and desk below it as it powers on').toBe(true)
      expect(framedByDarkRoom, 'the whole Macintosh in view, nothing lit cut off at the window’s top or sides').toBe(true)
      expect(gray, 'every frame drawn is in shades of gray').toBe(true)
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

test.describe('Intro for a first-time visitor on a narrow window drawn at one device pixel to a CSS pixel', () => {
  // A desktop browser window narrower than the 4:3 screen, still in the desktop layout, with fewer device pixels
  // than a phone's screen.
  test.use({ viewport: { width: 700, height: 1000 }, deviceScaleFactor: 1 })

  test('lands square on its screen, crisp, in pure black and white, with its whole Menu Bar', async ({ page }) => {
    await watchIntroScene(page)
    await visitPortfolio(page)
    await expectReady(page, { timeout: 15_000 })

    const screenAsLanded = await lookAtScreenLanding(page)
    expect(screenAsLanded, 'the screen alone covers the whole browser window').toBeDefined()
    expectCrisp(/** @type {{ grayShare: number }} */ (screenAsLanded).grayShare)
    await expectLandedSquare(page)
    await expectLandedOnWholeMenuBar(page)
  })
})

test.describe('Intro for a first-time visitor whose window changes shape as it plays', () => {
  test.use({ viewport: { width: 1280, height: 720 } })

  test('lands square on its screen’s Menu Bar drawn for the window’s new shape', async ({ page }) => {
    await watchIntroScene(page)
    await visitPortfolio(page)
    await expectFullIntroStarted(page)

    // Narrower than the screen, but still the desktop layout, well before the view lands.
    await page.setViewportSize({ width: 700, height: 1000 })

    await expectReady(page, { timeout: 15_000 })
    await expectLandedSquare(page)
    await expectLandedOnWholeMenuBar(page)
  })

  test('lands on its screen with nothing drawn on it but the pattern once the window takes a phone’s shape', async ({ page }) => {
    await watchIntroScene(page)
    await visitPortfolio(page)
    await expectFullIntroStarted(page)

    await page.setViewportSize({ width: 412, height: 839 })

    await expectReady(page, { timeout: 15_000 })
    await expectLandedOnPatternOnly(page)
  })
})

test.describe('Intro for a first-time visitor on a window far wider than tall', () => {
  // Wide enough that an edge left uncovered is more than the sampling of the scene's drawing can miss.
  test.use({ viewport: { width: 2600, height: 400 } })

  test('enters the screen until it alone covers the whole window, and crossfades into the page without flaring', async ({ page }) => {
    await watchIntroScene(page)
    await visitPortfolio(page)

    await expectReady(page, { timeout: 15_000 })
    const { screenCoveredWindow, flaredOverWindow } = await introScene(page)
    expect(screenCoveredWindow, 'the screen alone covers the whole browser window').toBe(true)
    expect(flaredOverWindow, 'then flares white over it').toBe(false)
  })
})

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

/**
 * Opens the portfolio with three.js held back, as a very slow connection would, and waits until the page
 * asks for it.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<() => void>} a function that delivers three.js
 */
async function visitWithThreeJsHeldBack(page) {
  /** @type {() => void} */
  let deliver = () => {}
  const delivered = new Promise((resolve) => (deliver = () => resolve(undefined)))
  await page.route(THREE_JS, async (route) => {
    await delivered
    await route.continue()
  })
  const requested = page.waitForRequest((request) => THREE_JS.test(request.url()))
  // WebKit may hold the page's load event for three.js, which is held back here.
  await visitPortfolio(page, '', { waitUntil: 'domcontentloaded' })
  await requested
  return deliver
}

test.describe('Intro while three.js is still loading', () => {
  for (const { name, end } of EARLY_ENDINGS) {
    test(`ends at once on ${name}, and its 3D scene never shows once three.js arrives`, async ({ page }) => {
      await watchIntroScene(page)
      const deliverThreeJs = await visitWithThreeJsHeldBack(page)

      // Ending while three.js is held back shows the Intro doesn't wait for it: not even for the Short Boot
      // that would play once the visitor had waited long enough.
      await end(page)
      await expectReady(page, { timeout: 1_000 })

      deliverThreeJs()
      await page.waitForLoadState('networkidle')
      await expectSceneNeverShown(page)
    })
  }
})

/**
 * Takes WebGL away from the page before it loads, as in a browser with WebGL turned off or graphics that
 * can't run it: a canvas asked for a WebGL context gives none.
 * @param {import('@playwright/test').Page} page
 */
async function withoutWebGL(page) {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext
    /** @this {HTMLCanvasElement} @param {string} type @param {any[]} rest */
    function noWebGL(type, ...rest) {
      return /webgl/.test(type) ? null : getContext.call(this, type, ...rest)
    }
    HTMLCanvasElement.prototype.getContext = /** @type {any} */ (noWebGL)
  })
}

/** Matches the address of the script that builds the full Intro's 3D scene, and loads three.js for it. */
const INTRO_SCENE = /\/intro-scene\.js$/

/**
 * Ways the full Intro's 3D scene can fail to load: three.js, or the scene's own script, missing or out of reach.
 * @type {{ name: string, url: RegExp, fail: (route: import('@playwright/test').Route) => Promise<void> }[]}
 */
const SCENE_LOAD_FAILURES = [
  { name: 'three.js is missing', url: THREE_JS, fail: (route) => route.fulfill({ status: 404 }) },
  { name: 'three.js can’t be reached', url: THREE_JS, fail: (route) => route.abort() },
  { name: 'the scene’s own script is missing', url: INTRO_SCENE, fail: (route) => route.fulfill({ status: 404 }) },
]

test.describe('Intro for a first-time visitor whose browser can’t show it in 3D', () => {
  /** @type {Error[]} */
  let pageErrors

  test.beforeEach(({ page }) => {
    pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(error))
  })

  test.afterEach(() => {
    expect(pageErrors, 'uncaught page errors').toEqual([])
  })

  test('plays the Short Boot instead when the browser has no WebGL, without loading three.js', async ({ page }) => {
    await withoutWebGL(page)

    await expectShortBoot(page)
  })

  for (const { name, url, fail } of SCENE_LOAD_FAILURES) {
    test(`plays the Short Boot instead when ${name}`, async ({ page }) => {
      await page.route(url, fail)
      await recordIntro(page)
      await visitPortfolio(page)

      await expectShortBootPlays(page)
    })
  }

  test('waits about 2 seconds in the dark for a slow 3D scene, then plays the Short Boot, and the scene never shows once it arrives', async ({
    page,
  }) => {
    await recordIntro(page)
    const deliverThreeJs = await visitWithThreeJsHeldBack(page)

    // three.js arrives while the Short Boot plays.
    await page.getByTestId('intro-boot-screen').waitFor()
    deliverThreeJs()
    await expectShortBootPlays(page)

    const { shownAt, bootScreen } = await introRecording(page)
    const waited = bootScreen[0].time - (shownAt ?? 0)
    expect(waited, 'milliseconds waited in the dark').toBeGreaterThan(1_500)
    expect(waited, 'milliseconds waited in the dark').toBeLessThan(3_000)
    await page.waitForLoadState('networkidle')
    await expectSceneNeverShown(page)
  })

  test('can be skipped during the Short Boot that follows the wait for a slow 3D scene', async ({ page }) => {
    await recordIntro(page)
    await visitWithThreeJsHeldBack(page)

    await skipShortBootAsItStarts(page)

    await expectReady(page, { timeout: 1_000 })
  })

  for (const skipped of [false, true]) {
    test(`tries the full Intro again on the next visit, after the Short Boot in its place ${skipped ? 'was skipped' : 'played out'}`, async ({
      page,
    }) => {
      const [missing] = SCENE_LOAD_FAILURES
      await page.route(missing.url, missing.fail)
      await recordIntro(page)
      await visitPortfolio(page)
      if (skipped) await skipShortBootAsItStarts(page)
      else await expectSmilingComputer(page)
      await expectReady(page)

      await page.unrouteAll()
      await visitPortfolio(page)

      await expectFullIntroStarted(page)
    })
  }
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
