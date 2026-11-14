// @ts-check
const { test, expect } = require('@playwright/test')
const { LAYOUTS, useLayout, openPortfolio, menuBar, easterEggMenu, tabToNext, boxOf } = require('./support/portfolio')

/**
 * Finds the Easter Egg: the About This Mac window.
 * @param {import('@playwright/test').Page} page
 */
function easterEgg(page) {
  return page.getByRole('dialog', { name: 'About This Mac', exact: true })
}

test.describe('Easter Egg on desktop', () => {
  // From the shortest window that still draws the Macintosh up to a common laptop screen.
  for (const size of [
    { width: 641, height: 513 },
    { width: 800, height: 600 },
    { width: 1280, height: 560 },
    { width: 1280, height: 800 },
  ]) {
    test(`opens within the Macintosh screen of a ${size.width} × ${size.height} window`, async ({ page }) => {
      await page.setViewportSize(size)
      await openPortfolio(page)
      await easterEggMenu(page).click()

      // The Menu Bar spans the Macintosh screen, and the Mac Window ends near its bottom. The window's
      // drop shadow, a quarter of a rem, has to fit too.
      const shadow = 4
      const aboutThisMac = await boxOf(easterEgg(page))
      const menu = await boxOf(menuBar(page))
      const macWindow = await boxOf(page.getByRole('main'))
      expect(aboutThisMac.x, 'left edge').toBeGreaterThanOrEqual(menu.x)
      expect(aboutThisMac.x + aboutThisMac.width + shadow, 'right edge').toBeLessThanOrEqual(menu.x + menu.width)
      expect(aboutThisMac.y, 'top edge').toBeGreaterThanOrEqual(menu.y + menu.height)
      expect(aboutThisMac.y + aboutThisMac.height + shadow, 'bottom edge').toBeLessThanOrEqual(macWindow.y + macWindow.height)
      // Every spec shows at once, down to the last, without scrolling the window.
      const lastSpec = await boxOf(easterEgg(page).getByRole('definition').last())
      expect(lastSpec.y + lastSpec.height, 'last spec').toBeLessThanOrEqual(aboutThisMac.y + aboutThisMac.height)
    })
  }
})

test.describe('Easter Egg in a browser that cannot open it', () => {
  test('leaves the Menu Bar without it, and shows none of its window', async ({ page }) => {
    // Safari before 15.4 has no modal dialogs.
    await page.addInitScript(() => {
      Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { value: undefined })
    })
    await openPortfolio(page)

    await expect(menuBar(page).getByRole('link')).toHaveCount(4)
    await expect(easterEggMenu(page)).toHaveCount(0)
    await expect(page.getByText('Room for your team’s next project')).toBeHidden()
  })
})

for (const layout of LAYOUTS) {
  test.describe(`Easter Egg on ${layout.name}`, () => {
    useLayout(layout)

    test('opens from the Menu Bar by pointer and closes with its close box, back where the visitor was', async ({
      page,
    }) => {
      await openPortfolio(page)
      await expect(easterEgg(page)).toBeHidden()

      await easterEggMenu(page).click()

      await expect(easterEgg(page)).toBeVisible()
      await expect(easterEgg(page).getByRole('heading', { name: 'Isaac Dobson' })).toBeVisible()

      await easterEgg(page).getByRole('button', { name: 'Close' }).click()

      await expect(easterEgg(page)).toBeHidden()
      await expect(easterEggMenu(page)).toBeFocused()
    })

    test('describes Isaac with playful computer-style specs that screen readers can read', async ({ page }) => {
      await openPortfolio(page)
      await easterEggMenu(page).click()
      const aboutThisMac = easterEgg(page)

      await expect(aboutThisMac.getByRole('heading', { name: 'Isaac Dobson' })).toBeVisible()
      await expect(aboutThisMac).toContainText('Software Engineer — Data & Platform')
      // Each spec is a named term with its value, as a computer would list its processor or memory.
      const terms = aboutThisMac.getByRole('term')
      const definitions = aboutThisMac.getByRole('definition')
      await expect(terms).toContainText(['Processor', 'Memory'])
      const termCount = await terms.count()
      expect(termCount).toBeGreaterThanOrEqual(4)
      await expect(definitions).toHaveCount(termCount)
      await expect(definitions.filter({ hasText: 'Georgia Tech' })).toBeVisible()
      await expect(definitions.filter({ hasText: '4+ years' })).toBeVisible()
    })

    test('closes when the visitor clicks outside it, so it never blocks the portfolio', async ({ page }) => {
      await openPortfolio(page)
      await easterEggMenu(page).click()
      const aboutThisMacBox = await boxOf(easterEgg(page))

      await page.mouse.click(aboutThisMacBox.x / 2, aboutThisMacBox.y + aboutThisMacBox.height / 2)

      await expect(easterEgg(page)).toBeHidden()
      await expect(easterEggMenu(page)).toBeFocused()
    })

    test('stays open when the visitor selects text and lets go outside it', async ({ page }) => {
      await openPortfolio(page)
      await easterEggMenu(page).click()
      const name = await boxOf(easterEgg(page).getByRole('heading', { name: 'Isaac Dobson' }))
      const aboutThisMacBox = await boxOf(easterEgg(page))

      await page.mouse.move(name.x + 2, name.y + name.height / 2)
      await page.mouse.down()
      await page.mouse.move(aboutThisMacBox.x / 2, aboutThisMacBox.y + aboutThisMacBox.height / 2, { steps: 5 })
      await page.mouse.up()

      await expect(easterEgg(page)).toBeVisible()
    })

    test('opens by keyboard, taking focus inside, and closes with Escape, back where the visitor was', async ({
      page,
    }) => {
      await openPortfolio(page)
      await tabToNext(page)
      await expect(easterEggMenu(page)).toBeFocused()

      await page.keyboard.press('Enter')

      await expect(easterEgg(page)).toBeVisible()
      await expect(easterEgg(page).locator(':focus')).toHaveCount(1)

      await page.keyboard.press('Escape')

      await expect(easterEgg(page)).toBeHidden()
      await expect(easterEggMenu(page)).toBeFocused()
    })

    test('keeps keyboard focus out of the portfolio behind it while open', async ({ page }) => {
      await openPortfolio(page)
      await easterEggMenu(page).focus()
      await page.keyboard.press('Enter')
      await expect(easterEgg(page)).toBeVisible()

      for (let presses = 1; presses <= 4; presses++) {
        await tabToNext(page)
        await expect(menuBar(page).locator(':focus')).toHaveCount(0)
        await expect(page.getByRole('main').locator(':focus')).toHaveCount(0)
      }
    })

    test('closes with its close box by keyboard', async ({ page }) => {
      await openPortfolio(page)
      await easterEggMenu(page).focus()
      await page.keyboard.press('Space')
      const closeBox = easterEgg(page).getByRole('button', { name: 'Close' })
      await closeBox.focus()

      await page.keyboard.press('Space')

      await expect(easterEgg(page)).toBeHidden()
      await expect(easterEggMenu(page)).toBeFocused()
    })
  })
}
