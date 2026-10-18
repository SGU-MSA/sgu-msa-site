import { test, expect, type Page } from "@playwright/test";
import {
  closePreview,
  expectAccessible,
  openPreview,
  previewDialog,
  savedToast,
  signInToSandbox,
  submit,
} from "./actions";

/**
 * Review 3 B (.plans/review3-plan.md; docs/contracts/pr5b-page-text-forms-reminders.md,
 * amendment 2026-10-06), against the sandbox (`npm run demo`): a page is a
 * list of its sections; the board hides and moves them and the public page
 * follows; Preview shows the whole page; only the Executive board edits
 * Pages.
 */
test.describe.configure({ mode: "serial" });
test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");

const saved = (page: Page) => expect(savedToast(page)).toContainText("Saved");
const shown = (page: Page, name: string) =>
  page
    .getByRole("region", { name, exact: true })
    .getByLabel(/^Show this section on the page/);

/** Headings of the public page, top to bottom. */
const headings = (page: Page) =>
  page
    .locator("main h2")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.textContent?.replace(/\s+/g, " ").trim() ?? ""),
    );

test("About: hide a section and move another to the top; /about follows, its words are kept", async ({
  page,
}) => {
  await signInToSandbox(page);
  await page.goto("/admin/pages/about");
  const list = page.getByRole("list", { name: "Sections of the page" });
  // Contact is a band: always last, outside the dragged list (review fixes P3).
  await expect(list.getByRole("listitem")).toHaveCount(4);
  await expect(list.getByRole("button", { name: "Move Contact" })).toHaveCount(
    0,
  );
  await expect(page.getByText("Always last on the page.")).toBeVisible();
  await shown(page, "What we do").uncheck();
  await expect(
    page.getByRole("region", { name: "What we do" }).getByText("Hidden"),
  ).toBeVisible();
  // "MSA at SGU" to the top, with the keyboard on its handle.
  await list.getByRole("button", { name: "Move MSA at SGU" }).focus();
  await page.keyboard.press("Home");
  await submit(page, "Save page");
  await saved(page);

  await page.goto("/about");
  await expect(
    page.getByRole("heading", { name: "Our Mission" }).first(),
  ).toBeVisible();
  await expect
    .poll(async () => (await headings(page)).slice(0, 2))
    .toEqual(["MSA at SGU", "Our Mission"]);
  await expect(page.getByRole("heading", { name: "What We Do" })).toHaveCount(
    0,
  );
  await expectAccessible(page);

  // Shown again, with its words as they were; then the starter order back.
  await page.goto("/admin/pages/about");
  await shown(page, "What we do").check();
  await list.getByRole("button", { name: "Move MSA at SGU" }).focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await submit(page, "Save page");
  await saved(page);
  await page.goto("/about");
  await expect(
    page.getByRole("heading", { name: "What We Do" }).first(),
  ).toBeVisible();
});

test("a hidden section may keep an empty required box; shown again, it asks for it", async ({
  page,
}) => {
  await signInToSandbox(page);
  await page.goto("/admin/pages/contact");
  await page.getByRole("button", { name: "Edit Find the Musallah" }).click();
  const visit = page.getByRole("region", { name: "Find the Musallah" });
  const heading = visit.getByLabel("Heading", { exact: true });
  const before = await heading.inputValue();
  await heading.fill("");
  await shown(page, "Find the Musallah").uncheck();
  await submit(page, "Save page");
  await saved(page);
  await page.goto("/contact");
  await expect(page.getByRole("link", { name: /View directions/ })).toHaveCount(
    0,
  );

  // Showing it again: the box is required, and its section opens to say so.
  await page.goto("/admin/pages/contact");
  await shown(page, "Find the Musallah").check();
  await page.getByRole("button", { name: "Save page" }).click();
  await expect(page.locator("form [role=alert]")).toHaveText(
    "Some boxes need fixing.",
  );
  await expect(visit.getByText("Needs fixing")).toBeVisible();
  await expect(heading).toBeFocused();
  await heading.fill(before);
  await submit(page, "Save page");
  await saved(page);
  await page.goto("/contact");
  await expect(page.getByRole("heading", { name: before })).toBeVisible();
});

test("Preview shows the whole page without the hidden sections, at the section being edited", async ({
  page,
}) => {
  await signInToSandbox(page);
  await page.goto("/admin/pages/home");
  await shown(page, "Community updates").uncheck();
  await page.getByRole("button", { name: "Edit Feature cards" }).click();
  const preview = await openPreview(page);
  // The whole page: the server's parts (the first-visit box) too.
  await expect(preview.getByText("Your first visit")).toBeVisible();
  await expect(
    preview.getByRole("heading", { name: "Community updates" }),
  ).toHaveCount(0);
  // Scrolled to the feature cards.
  await expect(
    preview.locator('[data-page-section~="features"] > *').first(),
  ).toBeInViewport();
  // Nothing was saved.
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Community updates" }),
  ).toBeVisible();
});

test("a section of another page text is edited in place on the page that shows it; its words stay in one place", async ({
  page,
}) => {
  await signInToSandbox(page);
  await page.goto("/admin/pages/prayer");
  await expect(page.getByText(/Its words are edited on/)).toHaveCount(0);
  const info = page.getByRole("region", { name: "Musallah information" });
  await info.getByRole("button", { name: "Edit Musallah information" }).click();
  const heading = info.getByLabel("Heading", { exact: true });
  const before = await heading.inputValue();
  // The shared field check: the box says why, the top only that some need fixing.
  await heading.fill("");
  await page.getByRole("button", { name: "Save page" }).click();
  await expect(page.locator("form [role=alert]")).toHaveText(
    "Some boxes need fixing.",
  );
  await expect(info.getByText("Needs fixing")).toBeVisible();
  await expect(heading).toBeFocused();
  await heading.fill("Inside the Musallah");
  // Preview draws the shared words as typed.
  await expect(
    (await openPreview(page)).getByRole("heading", {
      name: "Inside the Musallah",
    }),
  ).toBeVisible();
  await closePreview(page);
  await submit(page, "Save page");
  await saved(page);
  // Restore on this page leaves those words alone: their History is with Musallah directions.
  await expect(
    page.getByRole("link", { name: "History of Musallah directions" }),
  ).toBeVisible();
  await page.goto("/prayer");
  await expect(
    page.getByRole("heading", { name: "Inside the Musallah" }),
  ).toBeVisible();

  // Stored once: Musallah directions has no editor of its own any more
  // (shared text, option A); its screen says where it is edited and keeps
  // its History, which has the change.
  await page.goto("/admin/pages/musallah");
  await expect(
    page.getByText("Its words are edited on the page that shows them:"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Save page" })).toHaveCount(0);
  await expect(
    page
      .locator("#page-history")
      .locator("..")
      .getByText("Inside the Musallah"),
  ).not.toHaveCount(0);
  await page
    .locator("#main-content")
    .getByRole("link", { name: "Prayer & Musallah" })
    .click();
  await expect(page).toHaveURL(/\/admin\/pages\/prayer\?section=directions/);
  await page
    .getByRole("region", { name: "Musallah information" })
    .getByRole("button", { name: "Edit Musallah information" })
    .click();
  await info.getByLabel("Heading", { exact: true }).fill(before);
  await submit(page, "Save page");
  await saved(page);
});

test("shared words show on every page that uses them, labelled, and Preview can show each page (option A)", async ({
  page,
}) => {
  await signInToSandbox(page);
  // The Pages list: words shown only inside other pages are edited there.
  await page.goto("/admin/pages");
  for (const gone of ["Jumu’ah", "Musallah directions", "Newsletter archive"])
    await expect(
      page.getByRole("heading", { name: gone, exact: true }),
    ).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "FAQ" })).toBeVisible();

  // On Home: the Jumu'ah heading and Common questions, each labelled.
  await page.goto("/admin/pages/home");
  await expect(
    page
      .getByRole("region", { name: "Jumu’ah", exact: true })
      .getByText("Shared · also on Prayer & Musallah"),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Common questions" })
      .getByText("Shared · also on FAQ"),
  ).toBeVisible();

  // On the FAQ page the questions say Home shows them too; a question typed
  // here shows in Home's Preview, before any save.
  await page.goto("/admin/pages/faq");
  const questions = page.getByRole("region", { name: "Questions" });
  await expect(questions.getByText("Shared · also on Home")).toBeVisible();
  await questions.getByRole("button", { name: "Edit Questions" }).click();
  const typed = `Shared question ${Date.now()}?`;
  await questions.getByLabel("Question", { exact: true }).first().fill(typed);
  const preview = await openPreview(page);
  const pages = previewDialog(page).getByRole("group", {
    name: "Preview the page",
  });
  await expect(pages.getByRole("button", { name: "FAQ" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(preview.getByText(typed)).toBeVisible();
  await pages.getByRole("button", { name: "Home" }).click();
  await expect(pages.getByRole("button", { name: "Home" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(preview.getByText(typed)).toBeVisible();
  await expect(
    preview.getByRole("heading", { name: "Common Questions" }),
  ).toBeVisible();
  await expectAccessible(page);
  // Nothing was saved.
  await page.goto("/");
  await expect(page.getByText(typed)).toHaveCount(0);
});

test("only a manager moves people into or out of the Executive board; the last one stays in it (2026-10-06)", async ({
  page,
}) => {
  await signInToSandbox(page);
  // The sandbox account is the President and the only one who can manage
  // people: moving itself to the General board is refused, and nothing changes.
  await page.goto("/admin/people/00000000-0000-4000-8000-00000000a001");
  const group = page.getByRole("combobox", { name: "Group", exact: true });
  await group.selectOption({ label: "General board" });
  const selfRefusal =
    "You cannot move yourself out of the Executive board while you can manage people. Ask another person who can manage people.";
  // The line under Group already gives the reason, not "turns off".
  await expect(page.getByRole("status").getByText(selfRefusal)).toBeVisible();
  await expect(
    page.getByText(
      "Moving them out of the Executive board turns off their Manage people and Manage money.",
    ),
  ).toHaveCount(0);
  await page.locator('input[name="role_title"]').fill("Musallah coordinator");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("alert").getByText(selfRefusal)).toBeVisible();
  await page.goto("/admin/dashboard");
  await expect(
    page.getByText("Nobody can edit pages: add an executive"),
  ).toHaveCount(0);
  await expect(page.locator('a[href="/admin/pages"]')).toHaveCount(1);

  // Outside the Executive board, the two permissions cannot be given.
  await page.goto("/admin/people/00000000-0000-4000-8000-00000000a004");
  const access = page.getByRole("region", { name: "Dashboard login" });
  for (const permission of ["Manage people", "Manage money"])
    await expect(access.getByLabel(permission)).toBeDisabled();
  // Said once, under Permissions (each box keeps its own description).
  await expect(
    access.getByText(
      "Only Executive board members can have Manage people or Manage money.",
    ),
  ).toHaveCount(1);
  await expectAccessible(page);
});

test("the sections list passes axe in light and dark, desktop and phone", async ({
  page,
}) => {
  await signInToSandbox(page);
  for (const width of [1280, 390])
    for (const colorScheme of ["light", "dark"] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      for (const path of [
        "/admin/pages/home",
        "/admin/pages/musallah",
        "/admin/pages/prayer",
      ]) {
        await page.goto(path);
        await expectAccessible(page);
      }
      await page.getByRole("button", { name: "Edit Directions" }).click();
      await expectAccessible(page);
    }
  await page.emulateMedia({ colorScheme: "light" });
});
