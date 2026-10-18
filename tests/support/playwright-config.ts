import { defineConfig } from "@playwright/test";
import { tourSeenKey } from "../../src/features/admin/tour/seen";

/** Shared browser defaults; callers choose a safe, explicit local base URL. */
export function createPlaywrightConfig(baseURL: string) {
  return defineConfig({
    testDir: "./tests/e2e",
    use: {
      baseURL,
      // Every test starts after the first-visit tour so it does not cover the
      // page; tour tests start with an empty browser instead.
      storageState: {
        cookies: [],
        origins: [
          {
            origin: new URL(baseURL).origin,
            localStorage: [{ name: tourSeenKey("dashboard"), value: "seen" }],
          },
        ],
      },
      screenshot: "only-on-failure",
      trace: "retain-on-failure",
    },
    workers: 1,
    retries: 0,
    reporter: "list",
  });
}
