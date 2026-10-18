import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/** Quiet Paper light and dark (design-foundation contract, ADR 0018). */

const html = (page: Page) => page.locator("html");

async function axe(page: Page) {
  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  return scan.violations.map((v) => ({
    id: v.id,
    nodes: v.nodes.map((n) => n.target),
  }));
}

test("the theme follows the device until the switch is tapped", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(html(page)).toHaveAttribute("data-theme", "dark");
  await expect(html(page)).toHaveAttribute("data-theme-choice", "system");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(html(page)).toHaveAttribute("data-theme", "light");
});

test("the switch is remembered across pages and reloads", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/");
  await expect(html(page)).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(html(page)).toHaveAttribute("data-theme", "dark");
  await expect(html(page)).toHaveAttribute("data-theme-choice", "dark");

  await page.goto("/prayer");
  await expect(html(page)).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(html(page)).toHaveAttribute("data-theme", "dark");

  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(html(page)).toHaveAttribute("data-theme", "light");
  await page.goto("/calendar");
  await expect(html(page)).toHaveAttribute("data-theme", "light");
});

test("the remembered theme is on <html> before the body is parsed (no flash)", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => {
    localStorage.setItem("msa-theme", "dark");
    const seen: (string | null)[] = [];
    (window as unknown as { __themeAtBody: typeof seen }).__themeAtBody = seen;
    new MutationObserver((records, observer) => {
      for (const record of records)
        for (const node of record.addedNodes)
          if (node.nodeName === "BODY") {
            seen.push(document.documentElement.getAttribute("data-theme"));
            observer.disconnect();
          }
    }).observe(document, { childList: true, subtree: true });
  });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => (window as unknown as { __themeAtBody: string[] }).__themeAtBody,
    ),
  ).toEqual(["dark"]);
});

test("the meaning tip opens from the keyboard and Escape closes it", async ({
  page,
}) => {
  await page.goto("/");
  const trigger = page
    .getByRole("button", { name: "Show the meaning" })
    .first();
  await trigger.focus();
  await page.keyboard.press("Enter");
  const tip = page.getByRole("dialog");
  await expect(tip).toBeVisible();
  await expect(tip.locator("p[lang=en]")).not.toBeEmpty();
  // Meaning and reference only; the source stays in content (PR8 D-6).
  await expect(tip.locator("p")).toHaveCount(2);
  await page.keyboard.press("Escape");
  await expect(tip).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
});

// Every public page keeps WCAG AA in both themes through the token aliases.
const publicPages = [
  "/",
  "/prayer",
  "/calendar",
  "/community",
  "/resources",
  "/donate",
  "/contact",
  "/admin",
  "/about",
  "/get-involved",
  "/ramadan",
  "/merch",
  "/faq",
  "/privacy",
];

for (const theme of ["light", "dark"] as const)
  for (const width of [390, 1440])
    test(`axe passes in ${theme} at ${width}px`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      for (const path of publicPages) {
        await page.goto(path);
        await expect(html(page)).toHaveAttribute("data-theme", theme);
        expect(await axe(page), `${path} ${theme} ${width}`).toEqual([]);
      }
    });
