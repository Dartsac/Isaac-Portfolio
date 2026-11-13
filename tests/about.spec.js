// @ts-check
const { test, expect } = require('@playwright/test')
const { openPortfolio, section, group, loadedImage } = require('./support/portfolio')

test.describe('About Section', () => {
  test.beforeEach(async ({ page }) => {
    await openPortfolio(page)
  })

  test('shows Isaac’s headshot', async ({ page }) => {
    const headshot = section(page, 'About').getByRole('img', { name: 'Isaac Dobson', exact: true })

    await expect(headshot).toBeVisible()
    await loadedImage(headshot)
    expect(await headshot.evaluate((img) => /** @type {HTMLImageElement} */ (img).currentSrc)).toMatch(
      /\/img\/headshot-1bit(@2x)?\.png$/,
    )
  })

  test('summarizes his AT&T data and platform focus', async ({ page }) => {
    const about = section(page, 'About')

    await expect(about).toContainText('Senior Software Engineer at AT&T')
    await expect(about).toContainText('4+ years')
    await expect(about).toContainText('data and platform')
  })

  test('presents his Georgia Tech education', async ({ page }) => {
    const education = group(section(page, 'About'), 'Education')

    await expect(education).toContainText('Georgia Institute of Technology')
    await expect(education).toContainText('B.S. in Computer Science with Honors')
    await expect(education).toContainText('Artificial Intelligence')
    await expect(education).toContainText('Human-Computer Interaction')
  })

  test('lists the languages he speaks', async ({ page }) => {
    const spoken = group(section(page, 'About'), 'Spoken languages')

    await expect(spoken.getByRole('listitem')).toHaveText(['Spanish (native)', 'English (fluent)'])
  })

  test('highlights leadership experience from the resume', async ({ page }) => {
    const roles = group(section(page, 'About'), 'Leadership').getByRole('listitem')

    await expect(roles).toHaveCount(3)
    await expect(roles.nth(0)).toContainText('NCAA Division I Student-Athlete')
    await expect(roles.nth(0)).toContainText('Georgia Tech Cheerleading')
    await expect(roles.nth(1)).toContainText('President')
    await expect(roles.nth(1)).toContainText('Pi Kappa Phi')
    await expect(roles.nth(2)).toContainText('Soil Engineer Leader')
    await expect(roles.nth(2)).toContainText('Dunda School Reconstruction')
  })
})
