// @ts-check
const { test, expect } = require('@playwright/test')
const {
  PHONES,
  LAYOUTS,
  useLayout,
  openPortfolio,
  section,
  sectionHeading,
  menuBar,
  menuTitle,
  easterEggMenu,
  tabToNext,
  expectWhollyOnScreen,
  boxOf,
} = require('./support/portfolio')

const SECTIONS = ['About', 'Projects', 'Technologies', 'Contact']

/**
 * Expects a visitor to be reading a Section: its heading is fully on screen, nothing such as the
 * Menu Bar or the Mac Window's title bar covers it, and it sits near the top of the part of the Mac
 * Window the visitor can see, where reading starts.
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 */
async function expectShowing(page, name) {
  const heading = sectionHeading(page, name)
  await expect(heading).toBeInViewport({ ratio: 1 })
  await expect
    .poll(async () => {
      const titleBar = await boxOf(page.getByTestId('mac-window-title-bar'))
      const top = titleBar.y + titleBar.height
      const content = await boxOf(page.getByRole('main'))
      const bottom = Math.min(content.y + content.height, page.viewportSize()?.height ?? Infinity)
      return ((await boxOf(heading)).y - top) / (bottom - top)
    }, 'how far down the visible Mac Window the heading sits')
    .toBeLessThan(0.2)
  await expect
    .poll(() =>
      heading.evaluate((element) => {
        const box = element.getBoundingClientRect()
        const corners = [
          [box.left + 1, box.top + 1],
          [box.right - 1, box.bottom - 1],
        ]
        return corners.every(([x, y]) => element.contains(document.elementFromPoint(x, y)))
      }),
    )
    .toBe(true)
}

/**
 * Expects the Menu Bar to mark exactly one Section as the one being read.
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 */
async function expectCurrent(page, name) {
  await expect(menuTitle(page, name)).toHaveAttribute('aria-current', 'location')
  await expect(menuBar(page).locator('[aria-current]')).toHaveText([name])
}

/**
 * Scrolls the way a visitor reading on would, until a Section's heading reaches the top of the Mac Window.
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 */
async function scrollTo(page, name) {
  await sectionHeading(page, name).evaluate((heading) => heading.scrollIntoView({ block: 'start', behavior: 'instant' }))
}

/**
 * @typedef {object} Recording what a visitor saw happen, from when recording started
 * @property {(string | null)[]} marked each change of the menu title marked current, starting with the one marked then
 * @property {number[]} scrolls the position after each scroll step of the Mac Window or, on phones, the page
 */

/**
 * Records, from the moment the page starts loading, what the Menu Bar marks and how the Mac Window scrolls.
 * @param {import('@playwright/test').Page} page
 */
async function recordMenuBarAndScrolling(page) {
  await page.addInitScript(() => {
    /** @type {Recording} */
    const recording = { marked: [null], scrolls: [] }
    Object.assign(window, { recording })
    new MutationObserver((changes) => {
      for (const { target } of changes) {
        const name = target instanceof Element && target.hasAttribute('aria-current') ? target.textContent : null
        if (name && recording.marked[recording.marked.length - 1] !== name) recording.marked.push(name)
      }
    }).observe(document, { subtree: true, attributeFilter: ['aria-current'] })
    document.addEventListener(
      'scroll',
      ({ target }) => {
        const scroller = target instanceof Element ? target : document.scrollingElement
        if (scroller) recording.scrolls.push(scroller.scrollTop)
      },
      { capture: true, passive: true },
    )
  })
}

/**
 * Starts the recording again from what the visitor sees now.
 * @param {import('@playwright/test').Page} page
 */
async function startRecordingAfresh(page) {
  await page.evaluate(() => {
    const { recording } = /** @type {{ recording: Recording }} */ (/** @type {unknown} */ (window))
    recording.marked = [document.querySelector('[aria-current]')?.textContent ?? null]
    recording.scrolls = []
  })
}

/**
 * What has been recorded since recording started, leaving out a first "nothing marked yet".
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<Recording>}
 */
async function recording(page) {
  return page.evaluate(() => {
    const { recording } = /** @type {{ recording: Recording }} */ (/** @type {unknown} */ (window))
    return { ...recording, marked: recording.marked.filter((name) => name !== null) }
  })
}

/**
 * Scrolls a visitor to the very end of the portfolio, whichever layout is scrolling.
 * @param {import('@playwright/test').Page} page
 */
async function scrollToEnd(page) {
  await page.getByRole('main').evaluate((main) => main.scrollBy({ top: main.scrollHeight, behavior: 'instant' }))
  await page.evaluate(() => window.scrollBy({ top: document.documentElement.scrollHeight, behavior: 'instant' }))
}

/**
 * Expects the Menu Bar to show every menu title whole, and the Easter Egg's menu: on screen, and not
 * cut off by the Menu Bar's edges.
 * @param {import('@playwright/test').Page} page
 */
async function expectMenuTitlesFit(page) {
  await expectWhollyOnScreen(page, menuBar(page))
  const menus = [
    { name: 'About This Mac', locator: easterEggMenu(page) },
    ...SECTIONS.map((name) => ({ name, locator: menuTitle(page, name) })),
  ]
  for (const { name, locator } of menus) {
    await expect
      .poll(async () => {
        const bar = await boxOf(menuBar(page))
        const title = await boxOf(locator)
        return title.x >= bar.x && title.x + title.width <= bar.x + bar.width
      }, `the ${name} menu is inside the Menu Bar`)
      .toBe(true)
  }
}

/**
 * The Section to start from so that moving to a Section is a real move: the far end of the portfolio.
 * @param {string} name
 */
function farFrom(name) {
  return name === 'Contact' ? 'About' : 'Contact'
}

for (const layout of LAYOUTS) {
  test.describe(`Menu Bar on ${layout.name}`, () => {
    useLayout(layout)

    test('offers About, Projects, Technologies, and Contact wherever the visitor has scrolled', async ({ page }) => {
      await openPortfolio(page)

      await expect(menuBar(page).getByRole('link')).toHaveText(SECTIONS)
      await expectWhollyOnScreen(page, menuBar(page))

      await scrollToEnd(page)
      await expectWhollyOnScreen(page, menuBar(page))
      await menuTitle(page, 'About').click()
      await expectShowing(page, 'About')
    })

    test('shows which Section is being read as visitors scroll', async ({ page }) => {
      await openPortfolio(page)
      await expectCurrent(page, 'About')

      for (const name of ['Projects', 'Technologies', 'Projects', 'About']) {
        await scrollTo(page, name)
        await expectCurrent(page, name)
      }

      // Contact ends the portfolio, so reading on to the end shows it.
      await scrollToEnd(page)
      await expectCurrent(page, 'Contact')
    })

    for (const name of [...SECTIONS].reverse()) {
      test(`moves to the ${name} Section when its menu title is clicked`, async ({ page }) => {
        await openPortfolio(page)
        await menuTitle(page, farFrom(name)).click()

        await menuTitle(page, name).click()

        await expectShowing(page, name)
        await expectCurrent(page, name)
      })
    }

    test('glides to the chosen Section, marking only it on the way past the others', async ({ page }) => {
      await recordMenuBarAndScrolling(page)
      await openPortfolio(page)
      await menuTitle(page, 'Contact').click()
      await expectShowing(page, 'Contact')
      await expectCurrent(page, 'Contact')

      await startRecordingAfresh(page)
      await menuTitle(page, 'About').click()
      await expectShowing(page, 'About')

      const { marked, scrolls } = await recording(page)
      expect(marked).toEqual(['Contact', 'About'])
      expect(scrolls.length, 'scroll steps on the way').toBeGreaterThan(3)
    })

    test('opens a link to a Section right at that Section, without gliding through the others', async ({ page }) => {
      await recordMenuBarAndScrolling(page)

      await page.goto('/#contact')

      await expectShowing(page, 'Contact')
      await expectCurrent(page, 'Contact')
      const { marked, scrolls } = await recording(page)
      expect(marked).toEqual(['Contact'])
      expect(scrolls.length, 'scroll steps on the way').toBeLessThanOrEqual(2)
    })

    test('keeps following the reading when opened from a mistyped link', async ({ page }) => {
      // A truncated percent escape, as a mangled share link might carry.
      await openPortfolio(page, '/#%E0')
      await expectCurrent(page, 'About')

      await scrollTo(page, 'Technologies')
      await expectCurrent(page, 'Technologies')
    })

    test('is the first stop for keyboard visitors', async ({ page }) => {
      await openPortfolio(page)

      // As on a classic Macintosh, the first menu is the computer's own: here, the Easter Egg.
      await tabToNext(page)
      await expect(easterEggMenu(page)).toBeFocused()
      for (const name of SECTIONS) {
        await tabToNext(page)
        await expect(menuTitle(page, name)).toBeFocused()
      }
    })

    for (const name of SECTIONS) {
      test(`moves to the ${name} Section, and focus into it, when its menu title is chosen by keyboard`, async ({
        page,
      }) => {
        await openPortfolio(page)
        await menuTitle(page, farFrom(name)).click()

        await menuTitle(page, name).focus()
        await page.keyboard.press('Enter')

        await expectShowing(page, name)
        await expectCurrent(page, name)
        // Keyboard and screen-reader visitors carry on reading from the Section they chose.
        await expect(section(page, name)).toBeFocused()
      })
    }

    test('lets keyboard visitors tab on through the Section they chose', async ({ page }) => {
      await openPortfolio(page)
      await menuTitle(page, 'Projects').focus()
      await page.keyboard.press('Enter')

      await tabToNext(page)
      await expect(section(page, 'Projects').getByRole('link', { name: 'Visit haleemccray.com' })).toBeFocused()
    })
  })
}

test.describe('Mac Window on desktop', () => {
  test('scrolls inside the Macintosh screen exactly as far as the visitor asks', async ({ page }) => {
    await openPortfolio(page)
    const macWindow = page.getByRole('main')
    const menuBarBefore = await boxOf(menuBar(page))
    const box = await boxOf(macWindow)

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    for (let turns = 1; turns <= 3; turns++) {
      await page.mouse.wheel(0, 120)
      // Each turn of the wheel scrolls a fixed distance: no snapping to Sections, no extra momentum.
      await expect.poll(() => macWindow.evaluate((main) => main.scrollTop)).toBe(120 * turns)
    }

    // The Macintosh and its Menu Bar stay put around the scrolling Mac Window.
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
    expect(await boxOf(menuBar(page))).toEqual(menuBarBefore)
  })

  test('keeps marking the Section being read when a menu title is opened in a new tab', async ({ page, context }) => {
    await recordMenuBarAndScrolling(page)
    await openPortfolio(page)
    await expectCurrent(page, 'About')

    const [newTab] = await Promise.all([
      context.waitForEvent('page'),
      menuTitle(page, 'Contact').click({ modifiers: ['ControlOrMeta'] }),
    ])
    await newTab.waitForLoadState()

    expect((await recording(page)).marked).toEqual(['About'])
    await expectCurrent(page, 'About')
  })

  // The Macintosh shrinks with the window's height, down to the shortest window that still shows it.
  for (const size of [
    { width: 1366, height: 650 },
    { width: 1280, height: 560 },
    { width: 641, height: 513 },
  ]) {
    test(`fits every menu title in the Menu Bar of a ${size.width} × ${size.height} window`, async ({ page }) => {
      await page.setViewportSize(size)
      await openPortfolio(page)

      await expectMenuTitlesFit(page)
    })
  }
})

for (const phone of PHONES) {
  test.describe(`Mac Window on ${phone.name}`, () => {
    useLayout(phone)

    test('fills the screen below the Menu Bar, keeping its classic title bar', async ({ page }) => {
      await openPortfolio(page)
      const screen = page.viewportSize()
      if (!screen) throw new Error('No viewport')
      const menu = await boxOf(menuBar(page))
      const titleBar = await boxOf(page.getByTestId('mac-window-title-bar'))
      const content = await boxOf(page.getByRole('main'))

      expect(menu).toMatchObject({ x: 0, y: 0, width: screen.width })
      expect(titleBar).toMatchObject({ x: 0, width: screen.width })
      expect(titleBar.y).toBeCloseTo(menu.y + menu.height, 0)
      expect(content).toMatchObject({ x: 0, width: screen.width })
      expect(content.y).toBeCloseTo(titleBar.y + titleBar.height, 0)
      expect(content.y + content.height).toBeGreaterThanOrEqual(screen.height)
    })

    test('fits every menu title across even a small phone', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 })
      await openPortfolio(page)

      await expectMenuTitlesFit(page)
    })

    test('scrolls naturally as the visitor reads on, keeping the Menu Bar and title bar in view', async ({
      page,
      browserName,
    }) => {
      await openPortfolio(page)
      const titleBar = page.getByTestId('mac-window-title-bar')
      const before = { menu: await boxOf(menuBar(page)), titleBar: await boxOf(titleBar) }

      if (browserName === 'chromium') {
        // A real touch swipe up the screen, as a phone visitor reads on.
        const cdp = await page.context().newCDPSession(page)
        await cdp.send('Input.synthesizeScrollGesture', {
          x: 200,
          y: 600,
          yDistance: -400,
          gestureSourceType: 'touch',
          speed: 800,
        })
      } else {
        // Playwright can only swipe in Chromium, and mobile WebKit takes no scroll wheel either. Scrolling
        // the page directly still shows the page is what scrolls, with nothing trapped in the Mac Window.
        await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'instant' }))
      }

      // The page follows the finger: no snapping to Sections and no scroll trapped inside the Mac Window.
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(350)
      expect(await page.evaluate(() => window.scrollY)).toBeLessThan(450)
      expect(await boxOf(menuBar(page))).toEqual(before.menu)
      expect(await boxOf(titleBar)).toEqual(before.titleBar)
    })
  })
}
