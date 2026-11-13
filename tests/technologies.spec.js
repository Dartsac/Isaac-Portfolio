// @ts-check
const { test, expect } = require('@playwright/test')
const { openPortfolio, section, group } = require('./support/portfolio')

test.describe('Technologies Section', () => {
  test('groups the resume’s core skills by languages, data, and tools', async ({ page }) => {
    await openPortfolio(page)
    const technologies = section(page, 'Technologies')

    const expectedGroups = {
      Languages: ['Python', 'SQL', 'JavaScript', 'Java', 'C++', 'HTML/CSS', 'PHP'],
      'Data/ETL and databases': [
        'ServiceNow ETL',
        'Service Graph Connectors',
        'REST/JSON',
        'Oracle',
        'MySQL',
        'Schema design',
      ],
      'Frameworks and tools': ['React', 'ServiceNow Table/REST APIs', 'Git/GitHub administration', 'PlantUML'],
    }

    await expect(technologies.getByRole('group')).toHaveCount(Object.keys(expectedGroups).length)
    for (const [name, skills] of Object.entries(expectedGroups)) {
      const skillGroup = group(technologies, name)
      await expect(skillGroup.getByRole('heading', { name, exact: true })).toBeVisible()
      await expect(skillGroup.getByRole('listitem')).toHaveText(skills)
    }
  })
})
