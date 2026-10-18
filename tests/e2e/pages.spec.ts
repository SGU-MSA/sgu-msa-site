import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";
import {
  closePreview,
  expectAccessible,
  openPreview,
  savedToast,
  signInToSandbox,
  submit,
} from "./actions";

/**
 * PR5b WP3 (docs/contracts/pr5b-page-text-forms-reminders.md): the Pages
 * screens against the sandbox (`npm run demo`): edit a page and see the
 * public page follow without a deploy, refusals that keep the typed text,
 * History and Restore, a photo replaced, the sign-up forms list, and (PR-C)
 * the Qur'an verse chooser.
 */
test.describe.configure({ mode: "serial" });
test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");

const group = (page: Page, name: string) =>
  page.getByRole("group", { name, exact: true });

/**
 * One section of a page's list (review 3 B), its boxes opened with Edit
 * when they are folded away.
 */
async function section(page: Page, name: string) {
  const region = page.getByRole("region", { name, exact: true });
  const edit = page.getByRole("button", { name: `Edit ${name}`, exact: true });
  // Clicked again until the page's script has run and opened it.
  if (await edit.count())
    await expect(async () => {
      if (await edit.count()) await edit.click();
      await expect(
        page.getByRole("button", { name: `Close ${name}`, exact: true }),
      ).toBeVisible({ timeout: 1000 });
    }).toPass();
  return region;
}

async function openAbout(page: Page) {
  await signInToSandbox(page);
  await page.locator('a[href="/admin/pages"]').click();
  await expect(
    page.getByRole("heading", { name: "Pages", level: 1 }),
  ).toBeVisible();
  await page.locator('a[href="/admin/pages/about"]').click();
  await expect(
    page.getByRole("heading", { name: "About", level: 1 }),
  ).toBeVisible();
}

test("edit the About team heading and see /about change without a deploy", async ({
  page,
}) => {
  await openAbout(page);
  const heading = `Meet the board ${Date.now()}`;
  await (
    await section(page, "Our team")
  )
    .getByLabel("Heading", { exact: true })
    .fill(heading);
  await submit(page, "Save page");
  await expect(savedToast(page)).toContainText("Saved");
  await expect(
    (await section(page, "Our team")).getByLabel("Heading", { exact: true }),
  ).toHaveValue(heading);
  await page.goto("/about");
  await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  // The change is in History, named by its page.
  await page.goto("/admin/pages/about");
  await expect(
    page
      .getByRole("region", { name: "History" })
      .getByRole("heading", { name: "Edited page text: About" })
      .first(),
  ).toBeVisible();
});

test("a required box left empty turns red with its reason; the typed text stays (review 2)", async ({
  page,
}) => {
  await openAbout(page);
  const top = await section(page, "Top of the page");
  await top.getByLabel("Page title", { exact: true }).fill("");
  await (
    await section(page, "Our team")
  )
    .getByLabel("Heading", { exact: true })
    .fill("");
  const note = `Elected each spring ${Date.now()}`;
  await (
    await section(page, "Our team")
  )
    .getByLabel("Note under the heading (optional)")
    .fill(note);
  await page.getByRole("button", { name: "Save page" }).click();
  const alert = page.locator("form [role=alert]");
  await expect(alert).toHaveText("Some boxes need fixing.");
  await expect(top.getByLabel("Page title", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(top.getByLabel("Page title", { exact: true })).toBeFocused();
  await expect(
    (await section(page, "Our team")).getByLabel("Heading", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Fill in this box.")).toHaveCount(2);
  await expect(
    (await section(page, "Our team")).getByLabel(
      "Note under the heading (optional)",
    ),
  ).toHaveValue(note);
  // Nothing was saved.
  await page.goto("/about");
  await expect(page.getByText(note)).toHaveCount(0);
});

test("History: Restore asks first, shows the version, puts back the text before a change, and can be undone (review 3 D)", async ({
  page,
}) => {
  await openAbout(page);
  const team = (await section(page, "Our team")).getByLabel("Heading", {
    exact: true,
  });
  const before = await team.inputValue();
  const changed = `Board ${Date.now()}`;
  await team.fill(changed);
  await submit(page, "Save page");
  // The page after the save lists the change first.
  await expect(savedToast(page)).toContainText("Saved");
  const history = page.getByRole("region", { name: "History" });
  const restore = history
    .getByRole("button", { name: /^Restore the version before this change/ })
    .first();
  await restore.click();
  const confirm = page.getByRole("dialog", { name: "Restore this version?" });
  await expect(confirm).toBeVisible();
  await expect(
    confirm.getByText(
      /^This puts “About” back to how it was on .+\. The 1 change made to it after that will be replaced\. Nothing else on the website changes\. You can undo this from History\.$/,
    ),
  ).toBeVisible();
  // The version it brings back, drawn as the page.
  const version = confirm.getByRole("region", { name: "This version" });
  await expect(
    version.getByRole("heading", { name: before }).first(),
  ).toBeVisible();
  await expectAccessible(page);
  // Cancel changes nothing.
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(confirm).toBeHidden();
  await expect(team).toHaveValue(changed);

  await restore.click();
  await confirm.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(
    page.getByText(/The earlier text is back on the website/),
  ).toBeVisible();
  await expect(team).toHaveValue(before);
  await page.goto("/about");
  await expect(page.getByRole("heading", { name: before })).toBeVisible();

  // The restore is a new entry, named as one, in History and Recent changes.
  await page.goto("/admin/pages/about");
  const newest = history.getByRole("listitem").first();
  await expect(newest.getByRole("heading")).toHaveText(
    "Restored page text: About",
  );
  await expect(newest).toContainText(/Restored to the version of .+/);
  await page.goto("/admin/activity");
  const latest = page.locator(".activity-feed > li").first();
  await expect(latest.getByRole("heading")).toHaveText(
    "Restored page text: About",
  );
  await expect(latest).toContainText(/Restored to the version of .+/);

  // Undo the restore: restore the version from before it.
  await page.goto("/admin/pages/about");
  await newest
    .getByRole("button", { name: /^Restore the version before this change/ })
    .click();
  await confirm.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(team).toHaveValue(changed);
});

test("a page photo is replaced through the upload pipeline and shows on the page", async ({
  page,
}) => {
  await openAbout(page);
  const photo = (await section(page, "MSA at SGU"))
    .getByRole("group", { name: "Photo (optional)" })
    .first();
  const buffer = await sharp({
    create: {
      width: 1200,
      height: 800,
      channels: 3,
      background: { r: 20, g: 80, b: 60 },
    },
  })
    .jpeg()
    .toBuffer();
  await photo
    .getByLabel(/^Replace photo/)
    .setInputFiles({ name: "campus.jpg", mimeType: "image/jpeg", buffer });
  await photo.getByLabel("Describe the photo").fill("The campus from the hill");
  await expect(page.getByRole("button", { name: "Save page" })).toBeEnabled();
  await submit(page, "Save page");
  await expect(savedToast(page)).toContainText("Saved");
  await page.goto("/about");
  const image = page.getByRole("img", { name: "The campus from the hill" });
  await expect(image).toBeVisible();
  expect(await image.getAttribute("src")).toMatch(/media/);
});

test("sign-up forms: Google Forms links only; a form can be closed", async ({
  page,
}) => {
  await signInToSandbox(page);
  await page.goto("/admin/pages/forms");
  await expect(
    page.getByRole("heading", { name: "How to: a Google Form for an event" }),
  ).toBeVisible();
  const volunteer = group(page, "Volunteer");
  await volunteer
    .getByLabel("Link (optional)")
    .fill("https://sgu-msa-test.com/form");
  await page.getByRole("button", { name: "Save page" }).click();
  await expect(page.locator("form [role=alert]")).toContainText(
    "Some boxes need fixing.",
  );
  await expect(
    page.getByText(
      "Use a Google Forms link (docs.google.com/forms/… or forms.gle/…).",
    ),
  ).toBeVisible();
  await volunteer
    .getByLabel("Link (optional)")
    .fill("https://forms.gle/AbCdEf123");
  await volunteer.getByLabel("Open").check();
  await submit(page, "Save page");
  await expect(savedToast(page)).toContainText("Saved");
});

test("PR-B: Preview shows the page itself, or what a save would refuse (WP4)", async ({
  page,
}) => {
  await openAbout(page);
  const heading = `Our board ${Date.now()}`;
  await (
    await section(page, "Our team")
  )
    .getByLabel("Heading", { exact: true })
    .fill(heading);
  let preview = await openPreview(page);
  // The About page's own chapter, drawn from what was typed.
  await expect(
    preview.getByRole("heading", { name: heading }).first(),
  ).toBeVisible();
  await closePreview(page);
  await (
    await section(page, "Top of the page")
  )
    .getByLabel("Page title", { exact: true })
    .fill("");
  preview = await openPreview(page);
  await expect(preview).toContainText("Please fix 1 thing before saving:");
  await expect(preview).toContainText(
    "Top of the page · Page title: fill in this box.",
  );
  // Nothing was saved.
  await page.goto("/about");
  await expect(page.getByRole("heading", { name: heading })).toHaveCount(0);
});

test("PR-B: the Contact and Community words are page text (WP5)", async ({
  page,
}) => {
  await signInToSandbox(page);
  await page.goto("/admin/pages/contact");
  const title = `Come and visit ${Date.now()}`;
  await (
    await section(page, "Top of the page")
  )
    .getByLabel("Page title", { exact: true })
    .fill(title);
  await submit(page, "Save page");
  await expect(savedToast(page)).toContainText("Saved");
  await page.goto("/contact");
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  await page.goto("/admin/pages/community");
  const updates = `Notices and news ${Date.now()}`;
  await (
    await section(page, "Top of the page")
  )
    .getByLabel("Page title", { exact: true })
    .fill(updates);
  await submit(page, "Save page");
  await expect(savedToast(page)).toContainText("Saved");
  await page.goto("/community");
  await expect(page.getByRole("heading", { name: updates })).toBeVisible();
});

test('a closed sign-up form hides its button, with no "coming soon" line (review fixes P3)', async ({
  page,
}) => {
  await signInToSandbox(page);
  await page.goto("/admin/pages/forms");
  const helper = group(page, "Become a Musallah Helper");
  await expect(helper.getByLabel(/Text while closed/)).toHaveCount(0);
  await helper.getByLabel("Open").uncheck();
  await submit(page, "Save page");
  await expect(savedToast(page)).toContainText("Saved");
  await page.goto("/prayer");
  await expect(
    page.getByRole("link", { name: /Become a Musallah Helper/ }),
  ).toHaveCount(0);
  await expect(page.getByText(/coming soon/i)).toHaveCount(0);
});

test("Review 3 E: choose a place's verse from the fixed library and see it there; No verse removes it", async ({
  page,
}) => {
  await signInToSandbox(page);
  await page.goto("/admin/pages");
  await page.locator('a[href="/admin/pages/verses"]').click();
  await expect(
    page.getByRole("heading", { name: "Qur’an verses", level: 1 }),
  ).toBeVisible();
  const place = page.getByRole("group", {
    name: "Prayer & Musallah (optional)",
  });
  // The starter pick, shown whole with its name.
  await expect(place.getByText("Al-Muminoon 23:2")).toBeVisible();
  await place.getByRole("button", { name: "Change verse" }).click();
  const box = place.getByLabel("Find a verse in the library");
  await expect(box).toBeFocused();
  await box.fill("2:255");
  await expect(
    place.getByText(
      "2:255 is not in the library: it is too long for one line, or there is no such verse.",
    ),
  ).toBeVisible();
  await box.fill("200:1");
  await expect(
    place.getByText(
      "There is no verse 200:1. Check the surah and verse numbers.",
    ),
  ).toBeVisible();
  // Enter in the search box never saves the page.
  await box.press("Enter");
  await expect(page).not.toHaveURL(/saved/);
  await box.fill("صبر");
  await expect(place.getByText(/verses? found/)).toBeVisible();
  await box.fill("patience");
  await expect(place.getByText("2 verses found.")).toBeVisible();
  // The open search and its results pass axe.
  await expectAccessible(page);
  // The board picks; the only box on the screen is the search.
  await expect(place.locator("textarea, input:not([type=hidden])")).toHaveCount(
    1,
  );
  await place
    .getByRole("button", { name: "Use this verse Al-Ma'aarij 70:5" })
    .click();
  await expect(place.getByText("Al-Ma'aarij 70:5")).toBeVisible();
  await expect(
    place.getByRole("button", { name: "Change verse" }),
  ).toBeFocused();
  const preview = await openPreview(page);
  await expect(
    preview.getByRole("complementary", {
      name: "Reminder, Qur’an 70:5 (Al-Ma'aarij)",
    }),
  ).toBeVisible();
  await closePreview(page);
  await submit(page, "Save verse choices");
  await expect(savedToast(page)).toContainText("Saved");
  await page.goto("/prayer");
  const verse = page.getByRole("complementary", {
    name: "Reminder, Qur’an 70:5 (Al-Ma'aarij)",
  });
  await expect(verse).toBeVisible();
  await expect(verse.locator("[lang=ar]")).toContainText("جَمِيلًا");

  // No verse: the place is left empty.
  await page.goto("/admin/pages/verses");
  await place.getByRole("button", { name: "No verse", exact: true }).click();
  await expect(place.getByText("No verse on this page")).toBeVisible();
  // The button pressed goes away; the focus stays in the place.
  await expect(
    place.getByRole("button", { name: "Choose a verse" }),
  ).toBeFocused();
  await submit(page, "Save verse choices");
  await expect(savedToast(page)).toContainText("Saved");
  await page.goto("/prayer");
  await expect(verse).toHaveCount(0);
});

test("the Pages screens pass axe in light and dark, desktop and phone", async ({
  page,
}) => {
  await signInToSandbox(page);
  for (const width of [1280, 390])
    for (const colorScheme of ["light", "dark"] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      for (const path of [
        "/admin/pages",
        "/admin/pages/verses",
        "/admin/pages/about",
      ]) {
        await page.goto(path);
        await expect(page.locator("html")).toHaveAttribute(
          "data-theme",
          colorScheme,
        );
        await expectAccessible(page);
      }
      await openPreview(page);
      await expectAccessible(page);
    }
  await page.emulateMedia({ colorScheme: "light" });
});

test("review fixes PR-2: a page's list is put in order with the arrow keys on its handle, saved with Save page", async ({
  page,
}) => {
  await signInToSandbox(page);
  await page.goto("/admin/pages/faq");
  await section(page, "Questions");
  const questions = page.getByRole("list", { name: "Questions" });
  const first = questions.getByLabel("Question", { exact: true }).first();
  await expect(first).toBeVisible();
  const [one, two] = await questions
    .getByLabel("Question", { exact: true })
    .evaluateAll((boxes) =>
      boxes.slice(0, 2).map((box) => (box as HTMLInputElement).value),
    );
  await questions.getByRole("button", { name: "Move Question 1" }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(first).toHaveValue(two);
  await submit(page, "Save page");
  await page.goto("/faq");
  const order = await page
    .getByText(one)
    .first()
    .evaluate((node, other) => {
      const later = [...document.querySelectorAll("*")].find(
        (element) => element.textContent?.trim() === other,
      );
      return later ? node.compareDocumentPosition(later) : 0;
    }, two);
  // The second question now comes before the first.
  expect(order & 2).toBeTruthy(); // Node.DOCUMENT_POSITION_PRECEDING
  // Put it back.
  await page.goto("/admin/pages/faq");
  await section(page, "Questions");
  await questions.getByRole("button", { name: "Move Question 1" }).focus();
  await page.keyboard.press("ArrowDown");
  await submit(page, "Save page");
});
