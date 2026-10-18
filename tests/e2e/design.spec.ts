import { viewportSize } from "../support/viewports";
import { test, expect } from "@playwright/test";

test("mobile visitor can reach walking directions without registration", async ({
  page,
}) => {
  await page.setViewportSize(viewportSize("390x844"));
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: /^Prayer & Musallah/ })
    .click();
  await expect(page).toHaveURL(/\/prayer$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // Home stays in the document, hidden, for going back: only the shown copy.
  await expect(
    page
      .getByText("Find us on campus", { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  await expect(page.locator('iframe[src*="google.com/maps"]')).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /sign up|register/i }),
  ).toHaveCount(0);
});

test("reduced motion keeps the hero static, the tasbih thread complete and photographs usable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toBeVisible();
  // Styling assertions are intentional here: this is a sensory-accessibility check.
  expect(
    await heading.evaluate(
      (el) => getComputedStyle(el.parentElement!).animationName,
    ),
  ).toBe("none");
  // The thread is drawn complete (all 99 beads filled) without scrolling.
  const thread = page.locator("[data-filled]");
  await expect(thread).toHaveAttribute("data-filled", "99");
  // No drift: the reminder keeps its place on the page while scrolling.
  const reminder = page.getByRole("figure", {
    name: "Remembrance for this time of day",
  });
  const top = () =>
    reminder.evaluate((el) => el.getBoundingClientRect().top + scrollY);
  const before = await top();
  await page.mouse.wheel(0, 800);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
  expect(await top()).toBe(before);
  await expect(thread).toHaveAttribute("data-filled", "99");
  for (const photo of await page.locator("img").all()) {
    await photo.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        photo.evaluate(
          (el) =>
            (el as HTMLImageElement).complete &&
            (el as HTMLImageElement).naturalWidth > 0,
        ),
      )
      .toBe(true);
  }
});
