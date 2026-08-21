import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

/**
 * Playwright Configuration
 *
 * Updated to support the Realtime Chat E2E tests which require
 * multiple isolated browser contexts running simultaneously.
 */

// Load environment variables from .env.local for Supabase credentials
dotenv.config({ path: ".env.local" });

export default defineConfig({
  testDir: "./e2e",
  /* Run tests in files in parallel to speed up execution */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only to handle flaky network conditions */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI to prevent database connection exhaustion */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: "html",

  /* Shared settings for all the projects below. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5173",

    /* Collect trace when retrying the failed test. */
    trace: "on-first-retry",

    /* Default timeout for actions like click, fill, etc. */
    actionTimeout: 10000,

    /* Default timeout for navigation */
    navigationTimeout: 15000,

    /* Prevent Service Workers from intercepting network requests during E2E */
    serviceWorkers: "block",
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },

    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },

    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },

    /* Test against mobile viewports. */
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "Mobile Safari",
      use: { ...devices["iPhone 12"] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
