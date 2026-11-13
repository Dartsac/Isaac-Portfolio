// @ts-check
// Shared helpers for browser tests of the portfolio.

/** Matches a North American phone number such as (555) 555-5555 or 555.555.5555. */
const PHONE_NUMBER = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/

/**
 * Finds one of the portfolio's Sections in the Mac Window by its accessible name.
 * @param {import('@playwright/test').Page} page
 * @param {string} name About, Projects, Technologies, or Contact
 */
function section(page, name) {
  return page.getByRole('main').getByRole('region', { name, exact: true })
}

/**
 * Finds a labelled group (such as Education or Languages) inside a Section.
 * @param {import('@playwright/test').Locator} container
 * @param {string} name
 */
function group(container, name) {
  return container.getByRole('group', { name, exact: true })
}

/**
 * Extracts the text a reader of a PDF would see, page by page.
 * @param {Uint8Array} data
 */
async function pdfText(data) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const pdf = await pdfjs.getDocument({ data, verbosity: 0 }).promise
  const pages = []
  for (let number = 1; number <= pdf.numPages; number++) {
    const content = await (await pdf.getPage(number)).getTextContent()
    pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(''))
  }
  return pages.join('\n')
}

module.exports = { PHONE_NUMBER, section, group, pdfText }
