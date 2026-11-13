// @ts-check
const { test, expect } = require('@playwright/test')
const { openPortfolio, section, group, expectWebOptimized } = require('./support/portfolio')

/**
 * The five projects, in the order a reader meets them. Years and technologies come from the resume,
 * except tmux-pane-clarity, whose year and technologies come from its public repository.
 */
const PROJECTS = [
  {
    name: 'AT&T drift detection and auto-remediation',
    year: '2022–present',
    technologies: ['React', 'REST/JSON', 'ServiceNow Table/REST APIs'],
    links: [],
    visuals: [],
  },
  {
    name: 'Halee McCray portfolio',
    year: '2025',
    technologies: ['React', 'SCSS', 'GSAP', 'EmailJS', 'GitHub Pages'],
    links: [{ name: 'Visit haleemccray.com', href: 'https://haleemccray.com' }],
    visuals: [],
  },
  {
    name: 'Crystal Spirituality',
    year: '2020–2021',
    technologies: ['PHP', 'MySQL', 'JavaScript', 'HTML/CSS', 'React Native'],
    links: [
      { name: 'Crystal prototype on GitHub', href: 'https://github.com/Dartsac/CrystalPrototype' },
      { name: 'CC BY 4.0', href: 'https://creativecommons.org/licenses/by/4.0/' },
    ],
    visuals: [/^Crystal prototype home page/],
  },
  {
    name: 'TensorFlow CNN Art Generation',
    year: '2021',
    technologies: ['Python', 'TensorFlow', 'CNN'],
    links: [],
    visuals: [/^Content input: /, /^Style input: .*Great Wave/, /^Generated output: /],
  },
  {
    name: 'tmux-pane-clarity',
    year: '2024',
    technologies: ['tmux', 'Shell', 'Python', 'Rust'],
    links: [{ name: 'tmux-pane-clarity on GitHub', href: 'https://github.com/Dartsac/tmux-pane-clarity' }],
    visuals: [],
  },
]

/**
 * Finds one project in the Projects Section by its accessible name.
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 */
function project(page, name) {
  return section(page, 'Projects').getByRole('article', { name, exact: true })
}

test.describe('Projects Section', () => {
  test.beforeEach(async ({ page }) => {
    await openPortfolio(page)
  })

  test('presents the five selected projects in order', async ({ page }) => {
    const projects = section(page, 'Projects').getByRole('article')

    await expect(projects).toHaveCount(PROJECTS.length)
    for (const [index, { name }] of PROJECTS.entries()) {
      await expect(projects.nth(index)).toHaveAccessibleName(name)
      await expect(project(page, name).getByRole('heading', { level: 3, name, exact: true })).toBeVisible()
    }
  })

  test('gives every project a year and its technologies', async ({ page }) => {
    for (const { name, year, technologies } of PROJECTS) {
      const facts = project(page, name)
      await expect(facts.getByText(year, { exact: true }), name).toBeVisible()
      await expect(facts.getByRole('list', { name: 'Technologies', exact: true }).getByRole('listitem')).toHaveText(
        technologies,
      )
    }
  })

  test('links each project only to its public destinations', async ({ page }) => {
    for (const { name, links } of PROJECTS) {
      await expect(project(page, name).getByRole('link'), name).toHaveCount(links.length)
      for (const link of links) {
        const projectLink = project(page, name).getByRole('link', { name: link.name, exact: true })
        await expect(projectLink).toBeVisible()
        await expect(projectLink).toHaveAttribute('href', link.href)
      }
    }
  })

  test('shows web-optimized visuals with meaningful alternative text, and no placeholders', async ({ page }) => {
    for (const { name, visuals } of PROJECTS) {
      const images = project(page, name).getByRole('img')
      await expect(images, name).toHaveCount(visuals.length)
      for (const [index, alt] of visuals.entries()) {
        const image = images.nth(index)
        await image.scrollIntoViewIfNeeded()
        await expect(image).toBeVisible()
        await expect(image).toHaveAccessibleName(alt)
        await expectWebOptimized(page, image, 60_000)
      }
    }
  })

  test.describe('AT&T Case Study', () => {
    const CASE_STUDY = 'AT&T drift detection and auto-remediation'

    test('explains the drift between the documented model and the system schema', async ({ page }) => {
      const problem = group(project(page, CASE_STUDY), 'Problem')

      await expect(problem).toContainText('documented model')
      await expect(problem).toContainText('schema')
      await expect(problem).toContainText('drift')
    })

    test('walks through the architecture, from parsing to audit history', async ({ page }) => {
      const steps = group(project(page, CASE_STUDY), 'Architecture').getByRole('listitem')

      await expect(steps).toHaveCount(5)
      await expect(steps.nth(0)).toContainText('canonical JSON')
      await expect(steps.nth(1)).toContainText('structural diff')
      await expect(steps.nth(2)).toContainText('React')
      await expect(steps.nth(2)).toContainText('human approval')
      await expect(steps.nth(3)).toContainText('APIs')
      await expect(steps.nth(4)).toContainText('audit history')
    })

    test('reports both measured outcomes', async ({ page }) => {
      const outcomes = group(project(page, CASE_STUDY), 'Outcomes').getByRole('listitem')

      await expect(outcomes).toHaveCount(2)
      await expect(outcomes.nth(0)).toContainText('92%')
      await expect(outcomes.nth(0)).toContainText('37 hours to 3 hours')
      await expect(outcomes.nth(1)).toContainText('3–6 weeks to under one week')
    })

    test('shares no screenshots or internal links', async ({ page }) => {
      const caseStudy = project(page, CASE_STUDY)

      await expect(caseStudy).toContainText('Case Study')
      await expect(caseStudy.getByRole('img')).toHaveCount(0)
      await expect(caseStudy.getByRole('link')).toHaveCount(0)
    })
  })
})
