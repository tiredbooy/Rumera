import { defineConfig, devices } from "@playwright/test";

/**
 * Task 062 — accessibility, keyboard, responsive, and storefront lifecycle e2e.
 *
 * Default base URL is the local Next storefront. Override with PLAYWRIGHT_BASE_URL.
 * Age gate is cleared via storageState fixture in e2e/fixtures.
 */
// Prefer localhost — Next 16 dev may block 127.0.0.1 as cross-origin for HMR/RSC.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["github"], ["list"]]
    : [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
    locale: "fa-IR",
    // Age-verified so storefront is not blocked by the 18+ dialog.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: baseURL,
          localStorage: [{ name: "rumera:age-verified", value: "true" }],
        },
      ],
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Assume app is already running (docker or next dev). Set PLAYWRIGHT_WEB_SERVER=1
  // to boot Next for local one-shot runs without docker.
  webServer: process.env.PLAYWRIGHT_WEB_SERVER
    ? {
        command: "npm run dev -- --hostname 127.0.0.1 --port 3000",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
});
