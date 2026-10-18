import { expect, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
/**
 * A button of the page itself, not the "Unsaved changes" bar's Save at the
 * bottom of the screen (review follow-ups, 2026-10-07), which has the same
 * name and saves the same form; `unsavedBar` reaches that one.
 */
export function pageButton(page: Page, name: string) {
  return page
    .getByRole("button", { name, exact: true })
    .and(
      page.locator(
        "xpath=//button[not(ancestor::*[contains(@class, 'unsaved-bar')])]",
      ),
    );
}
/** The "Unsaved changes" bar along the bottom of the screen. */
export const unsavedBar = (page: Page) =>
  page.getByRole("region", { name: "Unsaved changes" });
export async function submit(
  page: Page,
  name: string,
  activation: "click" | "keyboard" = "click",
) {
  const response = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/admin"),
  );
  const button = pageButton(page, name);
  if (activation === "keyboard") {
    await button.focus();
    await page.keyboard.press("Enter");
  } else {
    await button.click();
  }
  await response;
}
/**
 * Signs in to the sandbox's one board account (`npm run demo`); "board" is
 * the same account without "Manage money" (`sandboxNoMoneyCredentials`).
 */
export async function signInToSandbox(
  page: Page,
  as: "admin" | "board" = "admin",
) {
  await page.goto("/admin");
  await page.getByLabel("Username").fill(as);
  await page.getByLabel("Password", { exact: true }).fill(as);
  await submit(page, "Sign In");
  await expect(page).toHaveURL(/\/admin\/dashboard/);
}
/**
 * The page has loaded and its scripts have run (review fixes PR-C). Not
 * "networkidle": with Cache Components the dashboard prefetches the public
 * pages in its menu, and the browser keeps those reads open.
 */
export async function settled(page: Page) {
  await page.waitForLoadState("load");
  await page.waitForTimeout(750);
}

/** No sideways scrolling and no WCAG 2 A/AA violations on the current page. */
export async function expectAccessible(page: Page) {
  // After a save the page's <title> is put back with the refreshed page.
  await expect(page).toHaveTitle(/\S/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        // "Saved" fades out after a save: mid-fade its colours are see-through.
        .exclude(".saved-toast")
        .analyze()
    ).violations,
  ).toEqual([]);
}

/**
 * A small file that starts like an iPhone HEIC photo (an ISO "ftyp heic"
 * box) but holds no picture a browser can open. Chromium cannot open real
 * HEIC either, so the photo box behaves the same (PR5a D-29). Built here, so
 * no binary fixture is committed; whether Safari turns a real HEIC into
 * JPEG is checked by hand (the release checklist's device table).
 */
export function heicLikePhoto() {
  const ftyp = Buffer.alloc(24);
  ftyp.writeUInt32BE(24, 0);
  ftyp.write("ftypheic", 4, "latin1");
  ftyp.write("mif1heic", 16, "latin1");
  return Buffer.concat([ftyp, Buffer.alloc(2000, 3)]);
}

/**
 * A dashboard time box (`TimeField`, review fixes P1): Hour, Minutes and AM
 * or PM drop-downs in a group named by the box's label. `value` is 24-hour
 * `HH:MM`, as stored; "" empties the box.
 */
export function timeBox(scope: Page | Locator, name: string) {
  return scope.getByRole("group", { name, exact: true });
}

/** Chooses `value` (`HH:MM`, or "" to empty it) in the time box named `name`. */
export async function fillTime(
  scope: Page | Locator,
  name: string,
  value: string,
) {
  const box = timeBox(scope, name);
  if (!value) {
    await box.getByLabel("Hour", { exact: true }).selectOption("");
    return;
  }
  const [hours, minutes] = value.split(":").map(Number);
  await box
    .getByLabel("Hour", { exact: true })
    .selectOption(String(hours % 12 || 12));
  await box
    .getByLabel("Minutes", { exact: true })
    .selectOption(String(minutes).padStart(2, "0"));
  await box
    .getByLabel("AM or PM", { exact: true })
    .selectOption(hours < 12 ? "AM" : "PM");
}

/** What the time box named `name` posts (`HH:MM`, or ""). */
export function timeValue(scope: Page | Locator, name: string) {
  return timeBox(scope, name).locator('input[type="hidden"]');
}

/** The "Saved" toast every save shows for a few seconds (`SavedToast`). */
export function savedToast(page: Page) {
  return page.locator(".saved-toast");
}

/**
 * Opens an editor's full-page Preview (review fixes P1, item 8) and returns
 * the page drawn inside it. `previewDialog(page)` is the dialog around it
 * (width buttons, the Pages page switcher, Close).
 */
export async function openPreview(page: Page) {
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const dialog = previewDialog(page);
  await expect(dialog).toBeVisible();
  const shown = dialog.frameLocator("iframe").locator(".preview-frame-root");
  await expect(shown).toBeAttached();
  return shown;
}
export const previewDialog = (page: Page) =>
  page.getByRole("dialog", { name: "Preview (not saved)" });
/** Back to the form: everything typed is kept. */
export async function closePreview(page: Page) {
  await previewDialog(page).getByRole("button", { name: "Close" }).click();
  await expect(previewDialog(page)).toBeHidden();
}

/**
 * Opens the dashboard header's notifications bell (review fixes P1, item 5)
 * and returns its panel.
 */
export async function openNotifications(page: Page) {
  await page.getByRole("button", { name: /^Notifications/ }).click();
  const panel = page.getByRole("region", { name: "Notifications" });
  await expect(panel).toBeVisible();
  return panel;
}
