import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const browser = await chromium.launch();
const results = [];
await mkdir("artifacts/render-check", { recursive: true });
try {
  for (const route of ["/", "/prayer", "/calendar"]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 100000 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.addInitScript(() => {
      window.__metrics = { lcp: 0, cls: 0 };
      new PerformanceObserver(list => { for (const entry of list.getEntries()) window.__metrics.lcp = entry.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__metrics.cls += entry.value; }).observe({ type: "layout-shift", buffered: true });
    });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("http://localhost:3000" + route, { waitUntil: "networkidle" });
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType("navigation")[0];
      return { ...window.__metrics, fcp: performance.getEntriesByName("first-contentful-paint")[0]?.startTime, ttfb: navigation.responseStart - navigation.requestStart, transferBytes: performance.getEntriesByType("resource").reduce((sum, entry) => sum + entry.transferSize, 0) };
    });
    await revealImages(page);
    await page.screenshot({ path: `artifacts/render-check/${route === "/" ? "home" : route.slice(1)}-390.png`, fullPage: true });
    results.push({ route, viewport: "390x844", cpuSlowdown: 4, latencyMs: 150, downloadBytesPerSecond: 200000, ...metrics, errors });
    await page.close();
  }
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await desktop.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await revealImages(desktop);
  await desktop.screenshot({ path: "artifacts/render-check/home-1440.png", fullPage: true });
  if (process.env.E2E_ADMIN_EMAIL) {
    await desktop.goto("http://localhost:3000/admin");
    await desktop.getByLabel("Email", { exact: true }).fill(process.env.E2E_ADMIN_EMAIL);
    await desktop.getByLabel("Password", { exact: true }).fill(process.env.E2E_ADMIN_PASSWORD);
    await desktop.getByRole("button", { name: "Sign In", exact: true }).click();
    await desktop.waitForURL("**/admin/dashboard");
    await desktop.waitForLoadState("networkidle");
    await desktop.screenshot({ path: "artifacts/render-check/admin-1440.png", fullPage: true });
    await desktop.setViewportSize({ width: 390, height: 844 });
    await desktop.goto("http://localhost:3000/admin/prayer-times", { waitUntil: "networkidle" });
    await desktop.screenshot({ path: "artifacts/render-check/admin-prayer-390.png", fullPage: true });
    await desktop.getByRole("button", { name: "Sign out" }).click();
  }
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }

async function revealImages(page) {
  // Scroll after recording metrics so full-page evidence includes lazy images.
  for (let y = 0; y < await page.evaluate(() => document.body.scrollHeight); y += 700) {
    await page.evaluate(y => window.scrollTo(0, y), y);
    await page.waitForTimeout(150);
  }
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => window.scrollTo(0, 0));
}
