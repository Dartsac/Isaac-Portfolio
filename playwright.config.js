// @ts-check
const { defineConfig, devices } = require('@playwright/test')

const port = 4173
const baseURL = `http://localhost:${port}`

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
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node scripts/serve.mjs',
    url: baseURL,
    env: { PORT: String(port) },
    reuseExistingServer: !process.env.CI,
  },
})
