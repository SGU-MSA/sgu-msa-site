import { defineConfig } from "@playwright/test";
import { createPlaywrightConfig } from "./tests/support/playwright-config";

/**
 * The cross-device layout gate (home-centering D-4): every public page on
 * every device size, light and dark. Run it in the official Playwright image
 * (`npm run test:layout`), so the screenshot baselines render the same
 * everywhere. A production build of the sample site, on a loopback port.
 */
const baseURL = "http://127.0.0.1:3218";
export const layoutSeed = "2026-10-14T12:00:00.000Z";

export default defineConfig({
  ...createPlaywrightConfig(baseURL),
  testMatch: "layout.spec.ts",
  outputDir: "./test-results-layout",
  use: {
    ...createPlaywrightConfig(baseURL).use,
    baseURL,
    reducedMotion: "reduce",
    locale: "en-US",
    timezoneId: "America/Grenada",
  },
  projects: [{ name: "layout" }],
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.002,
    },
  },
  webServer: {
    command: "node scripts/demo.mjs review --hostname 127.0.0.1 --port 3218",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 600_000,
    env: {
      SITE_URL: baseURL,
      SITE_DEMO_MODE: "true",
      SITE_DEMO_DATE: layoutSeed,
      CRON_SECRET: "off",
    },
  },
  workers: 2,
  retries: 0,
  reporter: "list",
});
