import { savedToast, submit } from "./actions";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const width of [320, 390, 768, 1440]) {
  test(`public pages reflow and accessibility at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
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
    ]) {
      await page.goto(path);
      await expect(page.locator("h1")).toHaveCount(1);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const scan = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        scan.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      ).toEqual([]);
    }
  });
}

test("mobile navigation contains focus and restores it", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const open = page.getByRole("button", { name: "Open menu" });
  await open.click();
  const dialog = page.getByRole("dialog", { name: "Navigation menu" });
  await expect(dialog).toBeVisible();
  for (let n = 0; n < 15; n++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(open).toBeFocused();
});

test("private routes redirect and donation does not invent checkout", async ({
  page,
}) => {
  await page.goto("/admin/content/events/new");
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/donate");
  // The sandbox lists its funds as slips; Give goes through the site's own
  // /donate/<slug>/give route, never a card form or a Go2Pay address here.
  await expect(
    page.getByText("The fund you choose is your intention."),
  ).toBeVisible();
  await expect(page.locator("main input")).toHaveCount(0);
  expect(await page.content()).not.toContain("go2pay.gd");
});

test("board login, draft, publish, edit, delete and logout", async ({
  page,
}) => {
  test.skip(!process.env.E2E_ADMIN_EMAIL, "Local test account required");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin");
  await page
    .getByLabel("Email", { exact: true })
    .fill(process.env.E2E_ADMIN_EMAIL!);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard/);
  await page.getByRole("link", { name: /^Announcements/ }).click();
  await page.getByRole("link", { name: "Create new" }).click();
  const title = `Browser test ${Date.now()}`;
  await page.getByLabel("Headline", { exact: true }).fill(title);
  await page
    .getByLabel("Full message", { exact: true })
    .fill("Confirmed community notice for local testing.");
  await submit(page, "Save");
  await expect(savedToast(page)).toContainText("Saved");
  await page.goto("/community");
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);
  await page.goto("/admin/content/announcements");
  await page.getByRole("link", { name: `Edit ${title}` }).click();
  await page.getByRole("radio", { name: "Everyone on the website" }).check();
  await submit(page, "Save");
  await expect(savedToast(page)).toContainText("Saved");
  await page.goto("/community");
  await expect(
    page.getByRole("link", { name: title, exact: true }),
  ).toBeVisible();
  await page.goto("/admin/content/announcements");
  await page.getByRole("link", { name: `Edit ${title}` }).click();
  // Archive first (ADR 0013); permanent delete is only offered from Archived.
  await page.locator("summary", { hasText: "Archive this item" }).click();
  await submit(page, "Archive");
  await expect(page.getByRole("status")).toContainText("Archived");
  await page.getByRole("link", { name: "Archived", exact: true }).click();
  await page.getByRole("link", { name: `View ${title}` }).click();
  await expect(page).toHaveURL(/\/admin\/content\/announcements\/[\w-]+$/);
  await page
    .locator("summary:visible", { hasText: "Delete permanently" })
    .click();
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await submit(page, "Delete permanently");
  await expect(page.getByRole("status")).toContainText("deleted");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/admin$/);
});
