// @ts-check
// Shared helpers for browser tests of the portfolio.
const { expect } = require('@playwright/test')

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

/** @typedef {{ x: number, y: number, width: number, height: number }} ScreenArea area in page coordinates */

/**
 * Looks at an area of the screen as a visitor would see it.
 * @param {import('@playwright/test').Page} page
 * @param {ScreenArea} clip
 * @returns {Promise<{ colorfulness: number, brightness: number[] }>}
 *   colorfulness: the fraction of pixels, from 0 to 1, showing color rather than black, white, or gray;
 *   brightness: the average brightness of each cell in a 12 × 12 grid, a coarse picture of the area.
 */
async function lookAt(page, clip) {
  const screenshot = await page.screenshot({ clip })
  return page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
    const { width, height } = bitmap
    const context = /** @type {OffscreenCanvasRenderingContext2D} */ (new OffscreenCanvas(width, height).getContext('2d'))
    context.drawImage(bitmap, 0, 0)
    const pixels = context.getImageData(0, 0, width, height).data

    const grid = 12
    const sums = new Array(grid * grid).fill(0)
    const counts = new Array(grid * grid).fill(0)
    let colored = 0
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4
        const red = pixels[i]
        const green = pixels[i + 1]
        const blue = pixels[i + 2]
        if (Math.max(red, green, blue) - Math.min(red, green, blue) > 24) colored++
        const cell = Math.floor((y * grid) / height) * grid + Math.floor((x * grid) / width)
        sums[cell] += (red + green + blue) / 3
        counts[cell]++
      }
    }
    return { colorfulness: colored / (width * height), brightness: sums.map((sum, cell) => sum / counts[cell]) }
  }, screenshot.toString('base64'))
}

/**
 * Measures how much of an area of the screen shows color rather than black, white, or gray.
 * @param {import('@playwright/test').Page} page
 * @param {ScreenArea} clip
 */
async function colorfulness(page, clip) {
  return (await lookAt(page, clip)).colorfulness
}

/**
 * How closely two coarse pictures share the same composition, from -1 to 1 (Pearson correlation).
 * Returns 0 when either picture is one flat brightness: a flat area has no composition to share.
 * @param {number[]} a
 * @param {number[]} b
 */
function similarity(a, b) {
  const mean = (/** @type {number[]} */ values) => values.reduce((sum, v) => sum + v, 0) / values.length
  const [meanA, meanB] = [mean(a), mean(b)]
  let covariance = 0
  let varianceA = 0
  let varianceB = 0
  for (let i = 0; i < a.length; i++) {
    covariance += (a[i] - meanA) * (b[i] - meanB)
    varianceA += (a[i] - meanA) ** 2
    varianceB += (b[i] - meanB) ** 2
  }
  if (varianceA === 0 || varianceB === 0) return 0
  return covariance / Math.sqrt(varianceA * varianceB)
}

/**
 * Waits until an image has loaded, and returns it.
 * @param {import('@playwright/test').Locator} image
 */
async function loadedImage(image) {
  await expect.poll(() => image.evaluate((img) => /** @type {HTMLImageElement} */ (img).naturalWidth)).toBeGreaterThan(0)
  return image
}

/**
 * Expects every file an image can show (its src and each srcset candidate, whatever the screen's
 * pixel density) to download successfully and weigh less than a budget.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} image
 * @param {number} maxBytes
 */
async function expectWebOptimized(page, image, maxBytes) {
  const sources = await (await loadedImage(image)).evaluate((img) => {
    const { src, srcset } = /** @type {HTMLImageElement} */ (img)
    const candidates = srcset
      .split(',')
      .map((candidate) => candidate.trim().split(/\s+/)[0])
      .filter(Boolean)
      .map((url) => new URL(url, document.baseURI).href)
    return [...new Set([src, ...candidates].filter(Boolean))]
  })
  expect(sources.length, 'the image has a file to show').toBeGreaterThan(0)
  for (const source of sources) {
    const response = await page.request.get(source)
    expect(response.ok(), source).toBe(true)
    expect((await response.body()).length, `${source} is under ${maxBytes} bytes`).toBeLessThan(maxBytes)
  }
}

module.exports = {
  PHONE_NUMBER,
  section,
  group,
  pdfText,
  lookAt,
  colorfulness,
  similarity,
  loadedImage,
  expectWebOptimized,
}
