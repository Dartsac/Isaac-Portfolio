// @ts-check
const { test, expect } = require('@playwright/test')
const { PHONES, useLayout, openPortfolio, section, menuTitle, easterEggMenu } = require('./support/portfolio')

/** The classic arrow drawn for this portfolio, as a cursor image. */
const CLASSIC_POINTER = /url\(.*cursor-arrow\.svg.*\)/

/**
 * The cursor the browser shows over an element.
 * @param {import('@playwright/test').Locator} locator
 */
function cursorOver(locator) {
  return locator.evaluate((element) => getComputedStyle(element).cursor)
}

/**
 * Plain reading text, the Mac Window around it, and the desktop around the Macintosh.
 * @param {import('@playwright/test').Page} page
 */
function plainSurfaces(page) {
  return [
    page.locator('body'),
    page.getByRole('main'),
    section(page, 'About').getByText('Isaac is a Senior Software Engineer at AT&T'),
  ]
}

test.describe('Pointer on desktop', () => {
  test('is the classic arrow over the page and its text', async ({ page }) => {
    await openPortfolio(page)

    for (const surface of plainSurfaces(page)) expect(await cursorOver(surface)).toMatch(CLASSIC_POINTER)
  })

  test('still shows links and buttons as things to press', async ({ page }) => {
    await openPortfolio(page)

    for (const control of [
      menuTitle(page, 'About'),
      easterEggMenu(page),
      page.getByRole('link', { name: 'Download Public Resume (PDF)' }),
      page.getByRole('button', { name: 'Full color headshot' }),
    ]) {
      expect(await cursorOver(control)).toBe('pointer')
    }
  })

  for (const { name, media } of [
    { name: 'forced colors', media: { forcedColors: /** @type {const} */ ('active') } },
    { name: 'more contrast', media: { contrast: /** @type {const} */ ('more') } },
  ]) {
    test(`leaves the visitor’s own pointer alone when they ask for ${name}`, async ({ page }) => {
      await page.emulateMedia(media)
      await openPortfolio(page)

      for (const surface of plainSurfaces(page)) expect(await cursorOver(surface)).not.toMatch(CLASSIC_POINTER)
    })
  }
})

for (const phone of PHONES) {
  test.describe(`Pointer on ${phone.name}`, () => {
    useLayout(phone)

    test('is left to the phone, which has no pointer to draw', async ({ page }) => {
      await openPortfolio(page)

      for (const surface of plainSurfaces(page)) expect(await cursorOver(surface)).not.toMatch(CLASSIC_POINTER)
    })
  })
}
