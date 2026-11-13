// @ts-check
const { test, expect } = require('@playwright/test')
const { openPortfolio, PHONE_NUMBER, section, pdfText, tabToNext } = require('./support/portfolio')

const PUBLIC_RESUME = {
  linkName: 'Download Public Resume (PDF)',
  href: 'resume/Isaac-Dobson-Resume.pdf',
  filename: 'Isaac-Dobson-Resume.pdf',
}

/** Contact links in the order a reader, and the Tab key, meets them. */
const CONTACT_LINKS = [
  { name: 'Email isaacdobson@me.com', href: 'mailto:isaacdobson@me.com' },
  { name: 'LinkedIn', href: 'https://www.linkedin.com/in/isaac-dobson-6aa924217/' },
  { name: 'GitHub', href: 'https://github.com/Dartsac' },
  { name: 'Twitter/X', href: 'https://x.com/IsaacDobson' },
]

test.describe('Contact Section', () => {
  test.beforeEach(async ({ page }) => {
    await openPortfolio(page)
  })

  test('links to Isaac’s email and public profiles by accessible name', async ({ page }) => {
    const contact = section(page, 'Contact')

    for (const { name, href } of CONTACT_LINKS) {
      const link = contact.getByRole('link', { name, exact: true })
      await expect(link).toBeVisible()
      await expect(link).toHaveAttribute('href', href)
    }
  })

  test('reaches every contact link by keyboard, in reading order', async ({ page }) => {
    const contact = section(page, 'Contact')
    const [first, ...rest] = [...CONTACT_LINKS.map(({ name }) => name), PUBLIC_RESUME.linkName]

    await contact.getByRole('link', { name: first, exact: true }).focus()
    for (const name of rest) {
      await tabToNext(page)
      await expect(contact.getByRole('link', { name, exact: true })).toBeFocused()
    }
  })

  test('offers the Public Resume as a PDF download', async ({ page }) => {
    const resumeLink = section(page, 'Contact').getByRole('link', { name: PUBLIC_RESUME.linkName, exact: true })
    await expect(resumeLink).toHaveAttribute('href', PUBLIC_RESUME.href)

    const [download] = await Promise.all([page.waitForEvent('download'), resumeLink.click()])
    expect(download.suggestedFilename()).toBe(PUBLIC_RESUME.filename)

    const response = await page.request.get(PUBLIC_RESUME.href)
    expect(response.ok()).toBe(true)
    expect(response.headers()['content-type']).toBe('application/pdf')
  })

  test('publishes no phone number on the page', async ({ page }) => {
    await expect(page.locator('body')).not.toContainText(PHONE_NUMBER)
    await expect(page.locator('a[href^="tel:"]')).toHaveCount(0)
  })

  test('publishes no phone number in the Public Resume', async ({ page }) => {
    const response = await page.request.get(PUBLIC_RESUME.href)
    const text = await pdfText(new Uint8Array(await response.body()))

    expect(text).toContain('Isaac C. Dobson')
    expect(text).toContain('isaacdobson@me.com')
    expect(text).not.toMatch(PHONE_NUMBER)
  })
})
