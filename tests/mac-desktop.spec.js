// @ts-check
const { test, expect } = require('@playwright/test')
const { openPortfolio, menuBar, boxOf, macDesktopPatternAreas, lookAt } = require('./support/portfolio')

test.describe('Mac Desktop on desktop', () => {
  // From the shortest window that is still a desktop layout up to a full-HD screen.
  for (const size of [
    { width: 641, height: 513 },
    { width: 1280, height: 560 },
    { width: 1280, height: 800 },
    { width: 1920, height: 1080 },
  ]) {
    test.describe(`in a ${size.width} × ${size.height} window`, () => {
      test.use({ viewport: size })

      test('runs the Menu Bar along the whole top of the browser window, with no Macintosh around it', async ({
        page,
      }) => {
        await openPortfolio(page)

        expect(await boxOf(menuBar(page))).toMatchObject({ x: 0, y: 0, width: size.width })
      })

      test('shows the 1-bit pattern around the Mac Window, out to the edges of the browser window', async ({
        page,
      }) => {
        await openPortfolio(page)

        for (const { side, area } of await macDesktopPatternAreas(page)) {
          expect(area.width, `room ${side} the Mac Window`).toBeGreaterThanOrEqual(8)
          expect(area.height, `room ${side} the Mac Window`).toBeGreaterThanOrEqual(8)
          // A 50% black-and-white dither looks mid-gray from afar, everywhere: no white Macintosh case, chin,
          // or floppy slot.
          const { brightness } = await lookAt(page, area)
          for (const cell of brightness) {
            expect(cell, `brightness ${side} the Mac Window`).toBeGreaterThan(80)
            expect(cell, `brightness ${side} the Mac Window`).toBeLessThan(175)
          }
        }
      })
    })
  }
})
