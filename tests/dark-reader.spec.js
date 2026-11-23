// @ts-check
const { test, expect } = require('@playwright/test')
const { openPortfolio, easterEggMenu, easterEgg, largestColorDifference } = require('./support/portfolio')

/**
 * Runs Dark Reader, the popular browser extension that darkens every site it can, in the page from now on,
 * as the extension would once the page has loaded. Its library shares the extension's code, so it leaves
 * alone a site that asks it to, as the extension does.
 * @param {import('@playwright/test').Page} page
 */
async function useDarkReader(page) {
  await page.addInitScript({ path: require.resolve('darkreader') })
  await page.addInitScript(() => {
    const { DarkReader } = /** @type {any} */ (window)
    DarkReader.setFetchMethod(window.fetch)
    document.addEventListener('DOMContentLoaded', () => DarkReader.enable())
  })
}

/**
 * Opens About This Mac, the Easter Egg, and takes a picture of it as the visitor sees it.
 * @param {import('@playwright/test').Page} page
 */
async function pictureOfAboutThisMac(page) {
  await openPortfolio(page)
  await easterEggMenu(page).click()
  await expect(easterEgg(page)).toBeVisible()
  return easterEgg(page).screenshot({ animations: 'disabled' })
}

test.describe('Portfolio with Dark Reader on', () => {
  test('shows About This Mac and its smiling computer in black and white, as drawn', async ({ page, browser }) => {
    const plainPage = await browser.newPage({ viewport: page.viewportSize() })
    const drawn = await pictureOfAboutThisMac(plainPage)
    await plainPage.close()

    await useDarkReader(page)
    const seen = await pictureOfAboutThisMac(page)

    // Dark Reader would recolor the window dark gray and its ink light, inverting the smiling computer or hiding its face.
    expect(await largestColorDifference(page, drawn, seen)).toBeLessThanOrEqual(2)
  })
})
