// @ts-check
const { test, expect } = require('@playwright/test')
const { PHONES, useLayout, openPortfolio, section, menuTitle, easterEggMenu, easterEgg } = require('./support/portfolio')

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
 * The desktop around the Macintosh, the Menu Bar, and the Mac Window around its text.
 * @param {import('@playwright/test').Page} page
 */
function plainSurfaces(page) {
  return [page.locator('body'), page.getByRole('navigation', { name: 'Menu Bar' }), page.getByRole('main')]
}

/**
 * Reading text: a paragraph and a Section heading.
 * @param {import('@playwright/test').Page} page
 */
function readingText(page) {
  return [
    section(page, 'About').getByText('Isaac is a Senior Software Engineer at AT&T'),
    section(page, 'About').getByRole('heading', { level: 2, name: 'About' }),
  ]
}

test.describe('Pointer on desktop', () => {
  test('is the classic arrow over the page around its text', async ({ page }) => {
    await openPortfolio(page)

    for (const surface of plainSurfaces(page)) expect(await cursorOver(surface)).toMatch(CLASSIC_POINTER)
  })

  test('is the I-beam over reading text, which can still be selected', async ({ page }) => {
    await openPortfolio(page)

    for (const text of readingText(page)) expect(await cursorOver(text)).toBe('text')
    await easterEggMenu(page).click()
    const spec = easterEgg(page).getByRole('definition').first()
    expect(await cursorOver(spec)).toBe('text')
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

      for (const surface of [...plainSurfaces(page), ...readingText(page)]) {
        expect(await cursorOver(surface)).not.toMatch(CLASSIC_POINTER)
      }
    })
  }
})

for (const phone of PHONES) {
  test.describe(`Pointer on ${phone.name}`, () => {
    useLayout(phone)

    test('is left to the phone, which has no pointer to draw', async ({ page }) => {
      await openPortfolio(page)

      for (const surface of [...plainSurfaces(page), ...readingText(page)]) {
        expect(await cursorOver(surface)).not.toMatch(CLASSIC_POINTER)
      }
    })
  })
}
