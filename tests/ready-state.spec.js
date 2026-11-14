// @ts-check
const { test, expect } = require('@playwright/test')
const { openPortfolio, section } = require('./support/portfolio')

const HEADLINE = 'Software Engineer — Data & Platform'

test.describe('ready state', () => {
  test('shows the Mac Window with Isaac’s name and Headline as accessible text', async ({ page }) => {
    await openPortfolio(page)

    const macWindow = page.getByRole('main')
    await expect(macWindow.getByRole('heading', { level: 1, name: 'Isaac Dobson' })).toBeVisible()
    await expect(macWindow.getByText(HEADLINE, { exact: true })).toBeVisible()
  })

  test('presents the About, Projects, Technologies, and Contact Sections in reading order', async ({ page }) => {
    await openPortfolio(page)

    const sections = [
      { name: 'About', id: 'about' },
      { name: 'Projects', id: 'projects' },
      { name: 'Technologies', id: 'technologies' },
      { name: 'Contact', id: 'contact' },
    ]
    const macWindow = page.getByRole('main')
    for (const { name, id } of sections) {
      const region = section(page, name)
      await expect(region).toHaveAttribute('id', id)
      await expect(region.getByRole('heading', { level: 2, name, exact: true })).toBeVisible()
    }

    const sectionIdsInOrder = await macWindow
      .getByRole('region')
      .evaluateAll((regions) => regions.map((region) => region.id))
    expect(sectionIdsInOrder).toEqual(sections.map(({ id }) => id))
  })
})

test.describe('animation runtime', () => {
  test('loads no Lottie, Bodymovin, or other remote animation runtime', async ({ page }) => {
    const requests = []
    page.on('request', (request) => requests.push(request))

    await openPortfolio(page, '', { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { level: 1, name: 'Isaac Dobson' })).toBeVisible()

    const siteOrigin = new URL(page.url()).origin
    const remoteCode = requests
      .filter((request) => ['script', 'fetch', 'xhr'].includes(request.resourceType()))
      .filter((request) => new URL(request.url()).origin !== siteOrigin)
      .map((request) => request.url())
    expect(remoteCode).toEqual([])

    const animationRequests = requests
      .map((request) => request.url())
      .filter((url) => /lottie|bodymovin/i.test(url))
    expect(animationRequests).toEqual([])

    await expect(page.locator('lottie-player')).toHaveCount(0)
    expect(await page.evaluate(() => 'lottie' in window || 'bodymovin' in window)).toBe(false)
  })
})

test.describe('metadata', () => {
  const TITLE = `Isaac Dobson | ${HEADLINE}`
  const DESCRIPTION =
    'Isaac Dobson is a software engineer focused on data and platform work. Explore his projects, technologies, and contact details.'
  const PUBLIC_URL = 'https://dartsac.github.io/Isaac-Portfolio/'

  test('describes the portfolio accurately for browsers and search', async ({ page }) => {
    await openPortfolio(page)

    await expect(page).toHaveTitle(TITLE)
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', DESCRIPTION)
    await expect(page.locator('meta[name="keywords"]')).toHaveCount(0)
  })

  test('names the public GitHub Pages address as the portfolio’s own, for search and sharing', async ({ page }) => {
    await openPortfolio(page)

    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', PUBLIC_URL)
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', PUBLIC_URL)
  })

  test('provides social sharing metadata', async ({ page }) => {
    await openPortfolio(page)

    const expected = {
      'meta[property="og:type"]': 'website',
      'meta[property="og:title"]': TITLE,
      'meta[property="og:description"]': DESCRIPTION,
      'meta[property="og:site_name"]': 'Isaac Dobson',
      'meta[name="twitter:card"]': 'summary',
      'meta[name="twitter:title"]': TITLE,
      'meta[name="twitter:description"]': DESCRIPTION,
    }
    for (const [selector, content] of Object.entries(expected)) {
      await expect(page.locator(selector), selector).toHaveAttribute('content', content)
    }
  })
})
