import { createPlaywrightConfig } from "./tests/support/playwright-config";

const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";
export default createPlaywrightConfig(baseURL);
