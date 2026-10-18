import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";

import { comingFriday } from "../../src/lib/prayer/congregation";
import {
  closePreview,
  expectAccessible,
  fillTime,
  openPreview,
  previewDialog,
  savedToast,
  signInToSandbox,
  submit,
  pageButton,
} from "./actions";

/**
 * PR5a PR-B (docs/contracts/pr5a-notices-events-continuity.md): the urgent
 * band, event status, the Edit | Preview tabs, the Jumu'ah question and the
 * Ramadan heading line, against the sandbox (`npm run demo`). The band
 * tests run first, while only the two sample urgent notices are current.
 */
test.describe.configure({ mode: "serial" });
test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");

const band = (page: Page) =>
  page.getByRole("region", { name: "Urgent notices" });
/** The notice the band shows now (named "1 of 2" for screen readers only). */
const shown = (page: Page) =>
  band(page).getByRole("group", { name: /^\d+ of \d+$/ });
const first = "Dhuhr is in Charter Hall today";
const second = "No water at the Musallah this week";

test("the urgent band shows under the menu on every public page, not on the dashboard", async ({
  page,
}) => {
  for (const path of ["/", "/faq", "/donate", "/calendar"]) {
    await page.goto(path);
    await expect(band(page), path).toBeVisible();
    await expect(band(page)).toContainText("Urgent");
  }
  await signInToSandbox(page);
  await expect(band(page)).toHaveCount(0);
});

test("two notices rotate newest first, with arrows and dots, no visible 1 of 2 and no pause button (D-30)", async ({
  page,
}) => {
  await page.goto("/faq");
  await expect(shown(page)).toHaveAccessibleName("1 of 2");
  await expect(shown(page)).toContainText(first);
  // Review fixes PR-1: the dots are enough; "1 of 2" is for screen readers only.
  await expect(band(page).getByText(/\bof 2$/)).toHaveCount(0);
  await expect(
    band(page).getByRole("button", { name: /pause|play/i }),
  ).toHaveCount(0);
  await expect(
    band(page).getByRole("button", { name: /^Show notice \d$/ }),
  ).toHaveCount(2);
  // Each notice links to its announcement.
  await expect(
    band(page).getByRole("link", {
      name: /^Details\s?: Dhuhr is in Charter Hall/,
    }),
  ).toHaveAttribute("href", /^\/community\/announcements\//);
  // It moves on by itself after 7 seconds.
  await expect(shown(page)).toContainText(second, { timeout: 9_000 });
});

test("after a tap on › the band stays where the visitor left it (D-30)", async ({
  page,
}) => {
  await page.goto("/faq");
  await band(page).getByRole("button", { name: "Next notice" }).click();
  await expect(shown(page)).toContainText(second);
  await page.mouse.move(5, 700);
  await page.waitForTimeout(8_000);
  await expect(shown(page)).toContainText(second);
  // A dot goes straight to its notice.
  await band(page).getByRole("button", { name: "Show notice 1" }).click();
  await expect(shown(page)).toContainText(first);
  await expect(
    band(page).getByRole("button", { name: "Show notice 1" }),
  ).toHaveAttribute("aria-current", "true");
});

test("hovering stops the band; leaving lets it move on again (D-30)", async ({
  page,
}) => {
  await page.goto("/faq");
  await shown(page).hover();
  await page.waitForTimeout(8_000);
  await expect(shown(page)).toContainText(first);
  await page.mouse.move(5, 700);
  await expect(shown(page)).toContainText(second, { timeout: 9_000 });
});

test("with reduced motion nothing moves by itself; arrows still work (D-30)", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/faq");
  await page.mouse.move(5, 700);
  await page.waitForTimeout(8_000);
  await expect(shown(page)).toContainText(first);
  // Never moving by itself, the band announces every change (W3C carousel),
  // even though the server could not know the setting (no hydration mismatch).
  const live = band(page).locator("[aria-live]");
  await expect(live).toHaveAttribute("aria-live", "polite");
  await band(page).getByRole("button", { name: "Next notice" }).click();
  await expect(shown(page)).toContainText(second);
  await page.mouse.move(5, 700);
  await expect(live).toHaveAttribute("aria-live", "polite");
});

test("public pages with the band pass axe in light, dark and on a phone", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const [width, height] of [
    [1280, 800],
    [390, 844],
  ])
    for (const colorScheme of ["light", "dark"] as const) {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ colorScheme });
      for (const path of ["/", "/calendar"]) {
        await page.goto(path);
        await expect(band(page)).toBeVisible();
        await expectAccessible(page);
      }
    }
});

test("cancelled and postponed events say so on every view, and the calendar file is CANCELLED (D-20, review 2)", async ({
  page,
}) => {
  await page.goto("/calendar");
  const cancelled = page.locator("li").filter({ hasText: "Beach clean-up" });
  await expect(cancelled).toContainText(
    "Cancelled: Tropical storm warning, campus closed.",
  );
  // Struck through, and the words say it too (never colour alone).
  await expect(
    cancelled.getByRole("link", { name: "Beach clean-up", exact: true }),
  ).toHaveCSS("text-decoration-line", "line-through");
  await expect(
    page.locator("li").filter({ hasText: "Qur'an night" }),
  ).toContainText("Postponed: new date to be announced");
  // The event page's Status says the same, from the same rule (dashboard polish).
  for (const [name, line] of [
    ["Qur'an night", "Postponed: new date to be announced"],
    ["Beach clean-up", "Cancelled: Tropical storm warning, campus closed."],
    ["Night of prayer", "Scheduled"],
  ]) {
    await page.getByRole("link", { name, exact: true }).first().click();
    await expect(
      page
        .locator("dl > div")
        .filter({ has: page.getByText("Status", { exact: true }) })
        .locator("dd"),
    ).toHaveText(line);
    await page.goto("/calendar");
  }
  // Over two days, and all day over three days (review 2).
  await expect(
    page.locator("li").filter({ hasText: "Night of prayer" }),
  ).toContainText(/10:00\sPM – \w{3} \d{1,2} \w{3}, 3:00\sAM/);
  await expect(
    page.locator("li").filter({ hasText: "Islamic Awareness Week" }),
  ).toContainText(/Until \w{3} \d{1,2} \w{3}/);

  // A computer that is not a Mac chooses where to add it (review 2).
  await cancelled.getByRole("button", { name: /Add .*to Calendar/i }).click();
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem")).toHaveText([
    "Google Calendar",
    "Outlook",
    "Apple or other (file)",
  ]);
  const google = await menu
    .getByRole("menuitem", { name: "Google Calendar" })
    .getAttribute("href");
  expect(new URL(google!).searchParams.get("text")).toBe(
    "Cancelled: Beach clean-up",
  );
  const file = await menu
    .getByRole("menuitem", { name: "Apple or other (file)" })
    .getAttribute("href");
  const response = await page.request.get(file!);
  expect(response.headers()["content-type"]).toMatch(/^text\/calendar/);
  const ics = await response.text();
  expect(ics).toContain("STATUS:CANCELLED");
  expect(ics).toContain("SUMMARY:Cancelled: Beach clean-up");
  await page.keyboard.press("Escape");

  await cancelled
    .getByRole("link", { name: "Beach clean-up", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Beach clean-up",
  );
  // The calendar stays in the document, hidden: only the shown line under
  // the title, and the same words as its Status (dashboard polish).
  await expect(
    page.getByText(/^Cancelled: Tropical storm/).filter({ visible: true }),
  ).toHaveCount(2);
  // Home's week shows the line too.
  await page.goto("/");
  await expect(
    page
      .locator(`section[aria-labelledby="upcoming"]`)
      .getByText(/^Cancelled: Tropical storm/),
  ).toBeVisible();
});

test("/ramadan's labels are Gregorian years, never a Hijri year (D-31)", async ({
  page,
}) => {
  await page.goto("/ramadan");
  await expect(page.getByText(/^Ramadan 20\d\d$/)).toBeVisible();
  expect(await page.locator("main").innerText()).not.toMatch(
    /\bAH\b|\b14\d\d\b/,
  );
});

/** A small JPEG photo for the picture box. */
async function photo() {
  return {
    name: "photo.jpg",
    mimeType: "image/jpeg",
    buffer: await sharp({
      create: {
        width: 64,
        height: 48,
        channels: 3,
        background: "#1f3d33",
      },
    })
      .jpeg()
      .toBuffer(),
  };
}

/** Archives an item from its edit page. */
async function archive(page: Page) {
  await page.getByText("Archive this item").click();
  await submit(page, "Archive");
  await expect(page.getByRole("status")).toContainText("Archived");
}

test("Preview: the full-page preview shows what was typed at each width; Close keeps the text and the chosen photo (review fixes P1, item 8)", async ({
  page,
}) => {
  await signInToSandbox(page);
  await page.goto("/admin/content/events/new");
  // Every box shows an example (D-26).
  await expect(page.getByLabel("Event name", { exact: true })).toHaveAttribute(
    "placeholder",
    "Iftar at the Musallah",
  );
  await expect(page.getByLabel("Place", { exact: true })).toHaveAttribute(
    "placeholder",
    "Musallah, Charter Hall",
  );
  const name = `Preview dinner ${Date.now()}`;
  await page.getByLabel("Event name", { exact: true }).fill(name);
  // 10 PM to 3 AM the next day (review 2: an end date).
  const start = await page.getByLabel("Start date").inputValue();
  const next = new Date(`${start}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  await fillTime(page, "Start time (optional)", "22:00");
  await page
    .getByLabel("End date (optional)")
    .fill(next.toISOString().slice(0, 10));
  await fillTime(page, "End time (optional)", "03:00");
  await page.getByLabel("Place", { exact: true }).fill("Charter Hall");
  await page.getByLabel("Picture (optional)").setInputFiles(await photo());
  await page.getByRole("radio", { name: "Cancelled" }).check();
  await page
    .getByLabel("Reason (required for Cancelled)")
    .fill("Speaker unwell");

  const preview = await openPreview(page);
  const dialog = previewDialog(page);
  await expect(preview).toContainText(name);
  await expect(preview).toContainText("Cancelled: Speaker unwell");
  // The event's own page, as its address shows it (`EventDetail`).
  await expect(preview).toContainText(
    /10:00\sPM – \w{3} \d{1,2} \w{3} \d{4}, 3:00\sAM/,
  );
  // Nothing in the preview can be used.
  await expect(preview).toHaveAttribute("inert", "");
  // Desktop, Tablet and Phone lay the page out at that width.
  const frameWidth = () =>
    dialog.locator("iframe").evaluate((frame) => frame.clientWidth);
  await expect(dialog.getByRole("button", { name: "Desktop" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await dialog.getByRole("button", { name: "Phone" }).click();
  await expect.poll(frameWidth).toBe(390);
  // The page scrolls from the keyboard: the frame itself takes focus.
  const frame = dialog.locator("iframe");
  await frame.focus();
  await page.keyboard.press("End");
  await expect
    .poll(() =>
      frame.evaluate(
        (element) => (element as HTMLIFrameElement).contentWindow?.scrollY,
      ),
    )
    .toBeGreaterThan(0);
  await dialog.getByRole("button", { name: "Tablet" }).click();
  await expect.poll(frameWidth).toBe(768);
  await expect(preview).toContainText(name);

  // Escape closes it; focus is back on the eye button.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Preview", exact: true }),
  ).toBeFocused();
  await expect(page.getByLabel("Event name", { exact: true })).toHaveValue(
    name,
  );
  await expect(page.getByLabel("Reason (required for Cancelled)")).toHaveValue(
    "Speaker unwell",
  );
  expect(
    await page
      .getByLabel("Picture (optional)")
      .evaluate((input) => (input as HTMLInputElement).files?.length),
  ).toBe(1);

  // axe on the form and the preview, light and dark, desktop and phone. Reload: a live
  // theme switch is scanned mid colour transition.
  for (const width of [1280, 390])
    for (const colorScheme of ["light", "dark"] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      await page.goto("/admin/content/announcements/new");
      await expect(page.locator("html")).toHaveAttribute(
        "data-theme",
        colorScheme,
      );
      await page.getByRole("radio", { name: "Urgent" }).check();
      await expectAccessible(page);
      await openPreview(page);
      await expectAccessible(page);
    }
  await page.emulateMedia({ colorScheme: "light" });
});

test("an urgent notice: refusals keep the typed text; saved, it shows in the band on Home (D-1, D-16)", async ({
  page,
}) => {
  await signInToSandbox(page);
  await page.goto("/admin/content/announcements");
  await expect(page.getByText(/^Urgent now: \d+$/)).toBeVisible();
  await page.goto("/admin/content/announcements/new");
  const today = await page.getByLabel("Show from").inputValue();
  const title = `Urgent test ${Date.now()}`;
  await page.getByLabel("Headline", { exact: true }).fill("x".repeat(81));
  await page.getByRole("radio", { name: "Urgent" }).check();
  await expect(page.getByLabel("Hide after (optional)")).toHaveCount(0);
  await expect(page.getByText(/^Urgent now: 2/)).toBeVisible();
  await page.getByLabel("Hide at (exact time)", { exact: true }).fill(today);
  await fillTime(page, "Hide at (exact time), time", "00:00");
  await page.getByRole("radio", { name: "Everyone on the website" }).check();
  // The browser stops the save; each box says why (review 2).
  await pageButton(page, "Save").click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Some boxes need fixing." }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Urgent notices fit 80 characters; put the rest in the details.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Choose a time later than now.")).toBeVisible();
  // The typed choice and text are kept.
  await expect(page.getByRole("radio", { name: "Urgent" })).toBeChecked();
  await expect(
    page.getByLabel("Hide at (exact time)", { exact: true }),
  ).toHaveValue(today);

  // The preview shows the band with this one notice.
  await page.getByLabel("Headline", { exact: true }).fill(title);
  await expect(
    (await openPreview(page)).getByText(title).first(),
  ).toBeVisible();
  await closePreview(page);
  await fillTime(page, "Hide at (exact time), time", "23:59");
  await submit(page, "Save");
  await expect(savedToast(page)).toContainText("Saved");
  await expect(page.getByText(/^Urgent now: 3$/)).toBeVisible();

  await page.goto("/");
  await expect(
    band(page).getByRole("button", { name: /^Show notice \d$/ }),
  ).toHaveCount(3);
  await expect(shown(page)).toHaveAccessibleName(/of 3$/);
  // Put it back: archive the test notice.
  await page.goto("/admin/content/announcements");
  await page.getByRole("link", { name: `Edit ${title}` }).click();
  await archive(page);
  await page.goto("/");
  await expect(shown(page)).toHaveAccessibleName(/of 2$/);
});

test("an archived event's link shows the signpost (D-20)", async ({ page }) => {
  await signInToSandbox(page);
  await page.goto("/admin/content/events/new");
  const name = `Signpost event ${Date.now()}`;
  await page.getByLabel("Event name", { exact: true }).fill(name);
  await fillTime(page, "Start time (optional)", "18:00");
  await page.getByLabel("Place", { exact: true }).fill("Charter Hall");
  await page.getByRole("radio", { name: "Everyone on the website" }).check();
  await submit(page, "Save");
  const edit = page.getByRole("link", { name: `Edit ${name}` });
  const id = (await edit.getAttribute("href"))!.split("/").at(-1);
  await edit.click();
  await archive(page);
  // The root loading state streams the page, so the status stays 200;
  // the signpost is what visitors see.
  await page.goto(`/calendar/${id}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "This event is no longer listed",
  );
  await expect(
    page.locator("main").getByRole("link", { name: "Events", exact: true }),
  ).toHaveAttribute("href", "/calendar");
});

test("a cancelled Friday asks for an urgent notice; Yes shows it in the band; an unchanged re-save asks nothing (D-3, D-19)", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await signInToSandbox(page);
  await page.goto("/admin/prayer-times");
  const today = await page.getByLabel("Times start on").inputValue();
  const friday = comingFriday(today);
  await page.getByRole("button", { name: "+ Add a date" }).click();
  const change = page.getByRole("group", { name: /^Change \d+$/ }).last();
  await change.getByLabel("Date", { exact: true }).fill(friday);
  await change.getByLabel("Reason (shown to visitors)").fill("Exams");
  const question = change.getByRole("group", {
    name: "Also show an urgent notice on every page?",
  });
  await expect(question).toHaveCount(0);
  await change.getByLabel("No Jumu’ah this week").check();
  await expect(question).toBeVisible();
  await question.getByRole("radio", { name: "Yes", exact: true }).check();
  const text = question.getByLabel("Notice text (you can change it)");
  await expect(text).toHaveValue(
    /^No Jumu’ah at the Musallah this Friday \(\d{1,2} \w{3}\)$/,
  );
  const notice = `No Jumu’ah test ${Date.now()}`;
  await text.fill(notice);
  await expect(
    question.getByLabel("Hide at (exact time)", { exact: true }),
  ).toHaveValue(friday);
  await expectAccessible(page);
  await submit(page, "Save prayer settings");
  await expect(savedToast(page)).toContainText("Saved");

  await page.goto("/");
  await band(page)
    .getByRole("button", { name: /^Show notice \d$/ })
    .first()
    .waitFor();
  const titles = await band(page)
    .getByRole("button", { name: /^Show notice \d$/ })
    .count();
  expect(titles).toBe(3);

  // Saving again without changing the Friday asks nothing and posts nothing more.
  await page.goto("/admin/prayer-times");
  await expect(
    page.getByRole("group", {
      name: "Also show an urgent notice on every page?",
    }),
  ).toHaveCount(0);
  await submit(page, "Save prayer settings");
  await expect(savedToast(page)).toContainText("Saved");
  await page.goto("/admin/content/announcements");
  await expect(page.getByRole("link", { name: `Edit ${notice}` })).toHaveCount(
    1,
  );
  await expect(page.getByText(/^Urgent now: 3$/)).toBeVisible();

  // Put everything back: archive the notice, remove the date.
  await page.getByRole("link", { name: `Edit ${notice}` }).click();
  await archive(page);
  await page.goto("/admin/prayer-times");
  const saved = page
    .getByRole("group", { name: /^Change \d+$/ })
    .filter({ has: page.locator(`input[value="${friday}"]`) });
  await saved.getByRole("button", { name: "Remove this date" }).click();
  await submit(page, "Save prayer settings");
  await expect(savedToast(page)).toContainText("Saved");
});

test("a cancelled Friday answered No posts no notice (D-3, D-19)", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await signInToSandbox(page);
  await page.goto("/admin/prayer-times");
  const today = await page.getByLabel("Times start on").inputValue();
  const friday = comingFriday(today);
  await page.getByRole("button", { name: "+ Add a date" }).click();
  const change = page.getByRole("group", { name: /^Change \d+$/ }).last();
  await change.getByLabel("Date", { exact: true }).fill(friday);
  await change.getByLabel("Reason (shown to visitors)").fill("Exams");
  await change.getByLabel("No Jumu’ah this week").check();
  await change
    .getByRole("group", { name: "Also show an urgent notice on every page?" })
    .getByRole("radio", { name: "No", exact: true })
    .check();
  await submit(page, "Save prayer settings");
  await expect(savedToast(page)).toContainText("Saved");
  await page.goto("/admin/content/announcements");
  await expect(page.getByText(/^Urgent now: 2$/)).toBeVisible();

  // Put it back: remove the date.
  await page.goto("/admin/prayer-times");
  await page
    .getByRole("group", { name: /^Change \d+$/ })
    .filter({ has: page.locator(`input[value="${friday}"]`) })
    .getByRole("button", { name: "Remove this date" })
    .click();
  await submit(page, "Save prayer settings");
  await expect(savedToast(page)).toContainText("Saved");
});

test("a Jumu'ah notice that could not be posted says so after the save (D-19)", async ({
  page,
}) => {
  await signInToSandbox(page);
  // The address a save gives when a notice fails (unit-tested in
  // tests/jumuah-notices.test.ts).
  await page.goto("/admin/prayer-times?notice=failed");
  await expect(
    page.getByRole("alert").filter({ hasText: "urgent notice could not" }),
  ).toHaveText(
    "The Jumu’ah change is saved, but the urgent notice could not be posted. Post it from Announcements.",
  );
});

test("a published event with a new date asks to post an announcement; Yes shows it in the band (review 2)", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const notices = band(page).getByRole("button", { name: /^Show notice \d$/ });
  await page.goto("/");
  await notices.first().waitFor();
  const before = await notices.count();
  await signInToSandbox(page);
  await page.goto("/admin/content/events/new");
  const name = `Moved event ${Date.now()}`;
  await page.getByLabel("Event name", { exact: true }).fill(name);
  const start = await page.getByLabel("Start date").inputValue();
  await page.getByLabel("Place", { exact: true }).fill("Charter Hall");
  await page.getByRole("radio", { name: "Everyone on the website" }).check();
  // A new event asks nothing.
  const question = page.getByRole("group", {
    name: "Also post an announcement?",
  });
  await expect(question).toHaveCount(0);
  await submit(page, "Save");
  await page.getByRole("link", { name: `Edit ${name}` }).click();

  // A new date: the question, required, with the text prefilled.
  const later = new Date(`${start}T12:00:00Z`);
  later.setUTCDate(later.getUTCDate() + 7);
  // The new-event form stays in the document, hidden: fill the shown one.
  await page
    .getByLabel("Start date", { exact: true })
    .filter({ visible: true })
    .fill(later.toISOString().slice(0, 10));
  await expect(question).toBeVisible();
  await pageButton(page, "Save").click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Some boxes need fixing." }),
  ).toBeVisible();
  await expect(question.getByText("Choose Yes or No.")).toBeVisible();
  await question.getByRole("radio", { name: "Yes", exact: true }).check();
  await expect(
    question.getByLabel("Announcement text (you can change it)"),
  ).toHaveValue(new RegExp(`^${name} moves to \\w{3} \\d{1,2} \\w{3}$`));
  await expect(
    question.getByLabel("Hide at (exact time)", { exact: true }),
  ).toHaveValue(start);
  await expectAccessible(page);
  await submit(page, "Save");
  await expect(savedToast(page)).toContainText("Saved");

  // It takes turns in the band with the other urgent notices.
  await page.goto("/");
  await expect(notices).toHaveCount(before + 1);
  // Put it back: archive the notice and the event.
  await page.goto("/admin/content/announcements");
  await page
    .getByRole("link", { name: new RegExp(`^Edit ${name} moves to`) })
    .click();
  await archive(page);
  await page.goto("/admin/content/events");
  await page.getByRole("link", { name: `Edit ${name}` }).click();
  await archive(page);
});
