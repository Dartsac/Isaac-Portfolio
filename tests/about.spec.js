// @ts-check
const { test, expect } = require('@playwright/test')
const { section, group } = require('./support/portfolio')

test.describe('About Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('shows Isaac’s headshot', async ({ page }) => {
    const headshotLoaded = page.waitForResponse(
      (response) => response.request().resourceType() === 'image' && /headshot/.test(response.url()),
    )
    await page.reload()

    await expect(section(page, 'About').getByRole('img', { name: 'Isaac Dobson', exact: true })).toBeVisible()
    expect((await headshotLoaded).ok()).toBe(true)
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
