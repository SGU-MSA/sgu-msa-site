import { defineConfig } from "@playwright/test";
import { demoSeed } from "./tests/support/demo-seed";
import { viewportSize } from "./tests/support/viewports";
import { createPlaywrightConfig } from "./tests/support/playwright-config";

const baseURL = "http://127.0.0.1:3217";

export default defineConfig({
  ...createPlaywrightConfig(baseURL),
  testMatch: "admin-smoke.spec.ts",
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
        viewport: viewportSize("390x844"),
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
      SITE_DEMO_DATE: demoSeed,
      // The daily warning check is an external job and stays off in QA.
      CRON_SECRET: "off",
    },
  },
  workers: 1,
  retries: 0,
  reporter: "list",
});
