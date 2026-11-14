// @ts-check
const { test, expect } = require('@playwright/test')
const {
  SECTIONS,
  LAYOUTS,
  useLayout,
  openPortfolio,
  sectionHeading,
  menuTitle,
  easterEggMenu,
  easterEgg,
} = require('./support/portfolio')

/** How browsers report a request they called off themselves, as when they choose another srcset image: not a missing file. */
const CANCELLED = /aborted|cancelled/i

for (const layout of LAYOUTS) {
  test.describe(`files a visit loads on ${layout.name}`, () => {
    useLayout(layout)

    test('are all served: for each Section, every Time Machine image in full color, and the Easter Egg', async ({
      page,
    }) => {
      /** @type {string[]} */
      const failedLoads = []
      page.on('requestfailed', (request) => {
        const error = request.failure()?.errorText ?? ''
        if (!CANCELLED.test(error)) failedLoads.push(`${request.url()} (${error})`)
      })
      page.on('response', (response) => {
        if (response.status() >= 400) failedLoads.push(`${response.url()} (${response.status()})`)
      })

      await openPortfolio(page)
      for (const name of SECTIONS) {
        await menuTitle(page, name).click()
        await expect(sectionHeading(page, name)).toBeInViewport()
      }
      for (const toggle of await page.getByRole('main').getByRole('button', { name: /^Full color / }).all()) {
        await toggle.click()
        await expect(toggle).toHaveAttribute('aria-pressed', 'true')
      }
      await easterEggMenu(page).click()
      await expect(easterEgg(page)).toBeVisible()
      await page.waitForLoadState('networkidle')

      expect(failedLoads).toEqual([])
    })
  })
}
