import { defineConfig } from "@playwright/test";
import { createPlaywrightConfig } from "./tests/support/playwright-config";

const baseURL = "http://127.0.0.1:3217";

export default defineConfig({
  ...createPlaywrightConfig(baseURL),
  testMatch: ["admin-smoke.spec.ts", "site-essentials.spec.ts"],
  use: {
    ...createPlaywrightConfig(baseURL).use,
    baseURL,
  },
  projects: [
    {
      name: "desktop-light",
      use: {
        viewport: { width: 1280, height: 800 },
        colorScheme: "light",
      },
    },
    {
      name: "phone-dark",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        colorScheme: "dark",
      },
    },
  ],
  webServer: {
    command: "node scripts/demo.mjs dev --hostname 127.0.0.1 --port 3217",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      SITE_URL: baseURL,
      SITE_DEMO_MODE: "true",
      SITE_DEMO_DATE: "2026-10-14T12:00:00.000Z",
      // The daily warning check is an external job and stays off in QA.
      CRON_SECRET: "off",
    },
  },
  workers: 1,
  retries: 0,
  reporter: "list",
});
