import type { StorybookConfig } from "@storybook/nextjs-vite";
import { copyMapLibrary } from "../scripts/map-library";

// The Next.js framework loads next.config.ts, which validates the deployment
// settings (ADR 0012). Storybook is never deployed and reads no data, so it
// runs with the same sample settings as `npm run demo`, fixed for every run.
Object.assign(process.env, {
  SITE_DEMO_MODE: "true",
  SITE_DEMO_DATE: "2026-10-03T14:00:00Z",
  SITE_URL: "http://localhost:6006",
  CRON_SECRET: "off",
});

// The PinMap stories load the map library from public/maplibre (PR7): copy
// it before the static folder is served, also on a fresh clone and in CI.
copyMapLibrary();

/**
 * Storybook for the shared UI and chrome (design-foundation D-1, D-2):
 * `npm run storybook` locally, `npm run build-storybook` in CI. Free addons
 * only; output goes to the ignored storybook-static/ folder.
 */
const config: StorybookConfig = {
  framework: { name: "@storybook/nextjs-vite", options: {} },
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
  staticDirs: ["../public"],
  core: { disableTelemetry: true },
};

export default config;
