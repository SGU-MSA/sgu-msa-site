import { test, expect } from "@playwright/test";

test("public navigation finishes rendering without browser errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const path of [
    "/",
    "/about",
    "/prayer",
    "/calendar",
    "/community",
    "/resources",
    "/ramadan",
    "/contact",
    "/donate",
  ]) {
    const response = await page.goto(path);
    await expect(page.locator("h1")).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByText("Loading the latest information…", { exact: true }),
    ).toHaveCount(0);
    const csp = response?.headers()["content-security-policy"] ?? "";
    expect(csp).toContain("frame-ancestors 'none'");
    if (process.env.E2E_SERVER_MODE === "development")
      expect(csp).toContain("'unsafe-eval'");
    if (process.env.E2E_SERVER_MODE === "production")
      expect(csp).not.toContain("'unsafe-eval'");
  }
  expect(errors).toEqual([]);
});
