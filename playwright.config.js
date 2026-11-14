// @ts-check
const { defineConfig, devices } = require('@playwright/test')

const port = 4173
// GitHub Pages serves the portfolio below this path, so the local server does too: a link or asset
// that only works from a server's root fails here as it would on the public site.
const basePath = '/Isaac-Portfolio/'
// PORTFOLIO_URL runs the suite against a deployed portfolio, such as the public GitHub Pages site,
// instead of a local server. Tests open pages by relative URL, so it must end in a slash.
const deployedURL = process.env.PORTFOLIO_URL
if (deployedURL && !deployedURL.endsWith('/')) throw new Error(`PORTFOLIO_URL must end in a slash: ${deployedURL}`)
const baseURL = deployedURL ?? `http://localhost:${port}${basePath}`

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  // Chromium for Chrome and Edge, and WebKit for Safari, which every iPhone visitor uses.
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: deployedURL
    ? undefined
    : {
        command: 'node scripts/serve.mjs',
        url: baseURL,
        env: { PORT: String(port), BASE_PATH: basePath },
        reuseExistingServer: !process.env.CI,
      },
})
