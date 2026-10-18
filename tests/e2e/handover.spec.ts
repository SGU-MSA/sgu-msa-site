import { viewportSize } from "../support/viewports";
import { test, expect, type Page } from "@playwright/test";
import {
  expectAccessible,
  openNotifications,
  savedToast,
  signInToSandbox,
  submit,
  unsavedBar,
} from "./actions";

/**
 * PR5a PR-C WP7 (docs/contracts/pr5a-notices-events-continuity.md): the New
 * board term screen, the Recent changes filters and Remove login, against
 * the sandbox (`npm run demo`). The sandbox has one board account, which
 * can manage people, so the manager warning is in the notifications.
 */
test.describe.configure({ mode: "serial" });
test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");

const progress = (page: Page) => page.getByText(/^\d+ of \d+ done$/);
const tick = (page: Page, step: string) =>
  page.getByRole("checkbox", { name: step, exact: true });

test("New board term: the dashboard card, the manager warning and ticking a step", async ({
  page,
}) => {
  await signInToSandbox(page);
  const warning =
    "Only 1 active person can manage people. Give a second person Manage people.";
  await expect(
    (await openNotifications(page)).getByText(warning),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: /^New board term/ }).click();
  await expect(
    page.getByRole("heading", { name: "New board term", level: 1 }),
  ).toBeVisible();
  // The same bell, with the same line, on every dashboard page.
  await expect(
    (await openNotifications(page))
      .getByText(warning)
      .filter({ visible: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(progress(page)).toHaveText("2 of 6 done");

  const step = "Update the team list";
  await tick(page, step).check();
  await expect(progress(page)).toHaveText("3 of 6 done");
  // Focus stays on the box that was ticked.
  await expect(tick(page, step)).toBeFocused();
  await page.reload();
  await expect(tick(page, step)).toBeChecked();
  await expect(
    page.getByRole("listitem").filter({ hasText: step }),
  ).toContainText(/Done \d+ \w{3}/);
  await tick(page, step).uncheck();
  await expect(progress(page)).toHaveText("2 of 6 done");
  await expectAccessible(page);
});

test("New board term: Start a new term clears every tick and keeps the steps", async ({
  page,
}) => {
  await signInToSandbox(page);
  await page.goto("/admin/handover");
  await page.locator("summary", { hasText: "Start a new term…" }).click();
  await submit(page, "Start a new term");
  await expect(page.getByRole("status")).toContainText("New term started");
  await expect(progress(page)).toHaveText("0 of 6 done");
  await expect(tick(page, "Invite the new board")).not.toBeChecked();
});

test("Edit the steps: add, reword, move (arrow key on the handle and Save order), archive and restore a step", async ({
  page,
}) => {
  await signInToSandbox(page);
  await page.goto("/admin/handover");
  await page.getByRole("link", { name: "Edit the steps" }).click();
  const add = page.getByRole("region", { name: "Add a step" });
  await add.getByLabel("Step", { exact: true }).fill("Hand over the key");
  await add
    .getByRole("combobox", { name: "Dashboard page (optional)" })
    .selectOption("People");
  await submit(page, "Add step");
  await expect(savedToast(page)).toContainText("Saved");
  const titles = page.locator("[data-sortable-item] h2");
  await expect(titles.last()).toHaveText("Hand over the key");

  // Reword it.
  const card = page.getByRole("region", { name: "Hand over the key" });
  await card
    .getByLabel("Step", { exact: true })
    .fill("Hand over the Musallah key");
  await card.getByRole("button", { name: "Save", exact: true }).click();
  await expect(titles.last()).toHaveText("Hand over the Musallah key");

  // Move it up one place with the arrow key on its handle, then Save order
  // (review fixes PR-2; review 2).
  await page
    .getByRole("button", { name: "Move Hand over the Musallah key" })
    .focus();
  await page.keyboard.press("ArrowUp");
  await expect(titles.last()).toHaveText(
    "Tell the site owner who the new board is",
  );
  await submit(page, "Save order");
  await expect(savedToast(page)).toContainText("Order saved.");
  await page.reload();
  await expect(titles.nth(-2)).toHaveText("Hand over the Musallah key");
  await expect(titles.last()).toHaveText(
    "Tell the site owner who the new board is",
  );

  // The checklist shows it in its new place, with its page link.
  await page.goto("/admin/handover");
  await expect(progress(page)).toHaveText("0 of 7 done");
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: "Hand over the Musallah key" }),
  ).toContainText("Open People →");

  // Archive, then restore.
  await page.goto("/admin/handover/steps");
  const moved = page.getByRole("region", {
    name: "Hand over the Musallah key",
  });
  await moved.locator("summary", { hasText: "Archive this step" }).click();
  await moved.getByRole("button", { name: /^Archive step/ }).click();
  await expect(page.getByRole("status")).toContainText("Step archived");
  const archived = page.getByRole("region", { name: "Archived steps" });
  await expect(archived).toContainText("Hand over the Musallah key");
  await archived
    .getByRole("button", { name: "Restore Hand over the Musallah key" })
    .click();
  await expect(page.getByRole("status")).toHaveText("Step restored.");
  await expect(titles.nth(-2)).toHaveText("Hand over the Musallah key");
  await expectAccessible(page);
});

test("Shared logins: add an account with holders from People, archive and restore it", async ({
  page,
}) => {
  await signInToSandbox(page);
  await page.goto("/admin/handover");
  await page.getByRole("link", { name: "+ Add an account" }).click();
  // No box takes a password; every text box says so.
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(
    page.getByText("Never write passwords or codes here."),
  ).toHaveCount(2);
  await page.getByLabel(/^Account/).fill("Go2Pay (club account)");
  await page
    .getByRole("combobox", { name: "Holder", exact: true })
    .selectOption("Omar Haddad");
  await page
    .getByRole("combobox", { name: "2-step phone" })
    .selectOption("Karim Mansour");
  // Once something is changed, the bar along the bottom says so, with Save
  // (review follow-ups, 2026-10-07).
  await expect(unsavedBar(page)).toContainText("Unsaved changes");
  // "Last changed" offers no later day than today, and a later day typed
  // in anyway is refused under the box.
  const lastChanged = page.getByLabel(/^Last changed/);
  await expect(lastChanged).toHaveAttribute("max", /^\d{4}-\d{2}-\d{2}$/);
  await lastChanged.fill("2999-01-01");
  await lastChanged.blur();
  await expect(page.getByText("Choose today or an earlier day.")).toBeVisible();
  await lastChanged.fill("2026-09-01");
  await expect(page.getByText("Choose today or an earlier day.")).toHaveCount(
    0,
  );
  await expectAccessible(page);
  // The bar's Save saves the form as its own Save does; then the bar goes.
  await unsavedBar(page).getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/admin\/handover#logins$/);
  await expect(savedToast(page)).toContainText("Saved");
  await expect(unsavedBar(page)).toHaveCount(0);
  const row = page.getByRole("row", { name: /Go2Pay \(club account\)/ });
  await expect(row).toContainText("Omar Haddad");
  await expect(row).toContainText("Karim Mansour");
  await expect(row).toContainText("1 Sept 2026");

  await row.getByRole("link", { name: /Go2Pay \(club account\)/ }).click();
  await page.locator("summary", { hasText: "Archive this account" }).click();
  await submit(page, "Archive account");
  await expect(page.getByRole("status")).toContainText("Account archived");
  await expect(page.getByRole("row", { name: /Go2Pay/ })).toHaveCount(0);
  await page.locator("summary", { hasText: "Archived accounts" }).click();
  await page
    .getByRole("button", { name: "Restore Go2Pay (club account)" })
    .click();
  await expect(page.getByRole("status")).toHaveText("Account restored.");
  await expect(page.getByRole("row", { name: /Go2Pay/ })).toHaveCount(1);
});

test("New board term in dark mode and on a phone", async ({ page }) => {
  await signInToSandbox(page);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/admin/handover");
  await expectAccessible(page);
  await page.setViewportSize(viewportSize("390x844"));
  await page.reload();
  await expectAccessible(page);
});

test("Recent changes: filters by kind, person and dates, kept by Older changes (D-10)", async ({
  page,
}) => {
  await signInToSandbox(page);
  // Enough New board term changes for a second page.
  await page.goto("/admin/handover");
  const step = tick(page, "Check content");
  for (let round = 0; round < 13; round++) {
    await step.check();
    await expect(progress(page)).toHaveText("1 of 7 done");
    await step.uncheck();
    await expect(progress(page)).toHaveText("0 of 7 done");
  }

  await page.goto("/admin/activity");
  await page
    .getByRole("combobox", { name: "What" })
    .selectOption("New board term");
  await page.getByRole("button", { name: "Show", exact: true }).click();
  await expect(page).toHaveURL(/what=handover/);
  await expect(
    page.getByText(/^Showing changes to New board term/),
  ).toBeVisible();
  const headings = page.locator(".activity-feed h2");
  await expect(headings.first()).toBeVisible();
  for (const text of await headings.allTextContents())
    expect(text).toMatch(/New board term step|shared login/);

  // Older changes keeps the filter.
  await page.getByRole("link", { name: "Older changes" }).click();
  await expect(page).toHaveURL(/what=handover/);
  await expect(page).toHaveURL(/before=\d+/);
  await expect(page.getByRole("combobox", { name: "What" })).toHaveValue(
    "handover",
  );
  for (const text of await headings.allTextContents())
    expect(text).toMatch(/New board term step|shared login/);
  await page.getByRole("link", { name: "Newest changes" }).click();
  await expect(page).toHaveURL(/what=handover/);
  await expect(page).not.toHaveURL(/before=/);

  // By person: the sandbox board member made them; the site owner none.
  await page.getByRole("combobox", { name: "Who" }).selectOption("Omar Haddad");
  await page.getByRole("button", { name: "Show", exact: true }).click();
  await expect(headings.first()).toBeVisible();
  await page.getByRole("combobox", { name: "Who" }).selectOption("Site owner");
  await page.getByRole("button", { name: "Show", exact: true }).click();
  await expect(page.getByText("No changes match these filters.")).toBeVisible();

  // Days: nothing before 2020, and Clear filters shows everything again.
  await page.getByRole("combobox", { name: "Who" }).selectOption("Everyone");
  await page.getByLabel("From").fill("2019-01-01");
  await page.getByLabel("Until").fill("2019-12-31");
  await page.getByRole("button", { name: "Show", exact: true }).click();
  await expect(page.getByText("No changes match these filters.")).toBeVisible();
  await expectAccessible(page);
  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/admin\/activity$/);
  await expect(headings.first()).toBeVisible();
});

test("Remove login: only for a deactivated login, after typing the person's name (D-27 e)", async ({
  page,
}) => {
  await signInToSandbox(page);
  await page.goto("/admin/people/00000000-0000-4000-8000-00000000a003");
  const login = page.getByRole("region", { name: "Dashboard login" });
  await login
    .getByLabel("Email for the invite")
    .fill(`advisor-${Date.now()}@sgu-msa.invalid`);
  await login.getByRole("button", { name: "Send invite" }).click();
  await expect(login.getByRole("status")).toContainText("Invite email sent");
  // Still on: no Remove login yet.
  await expect(
    login.locator("summary", { hasText: "Remove login" }),
  ).toHaveCount(0);
  await login.locator("summary", { hasText: "Deactivate login" }).click();
  await login.getByRole("button", { name: "Deactivate login" }).click();
  await expect(login.getByRole("status")).toContainText("Login deactivated");

  await login.locator("summary", { hasText: "Remove login" }).click();
  const confirm = login.getByLabel("Type “Karim Mansour” to confirm");
  await confirm.fill("Someone else");
  await login.getByRole("button", { name: "Remove login" }).click();
  await expect(login.getByRole("alert")).toHaveText(
    "Type their name exactly as shown to confirm.",
  );
  await confirm.fill("Karim Mansour");
  await login.getByRole("button", { name: "Remove login" }).click();
  await expect(page.getByRole("status").first()).toHaveText(
    "Login removed. Their People entry and their history stay.",
  );
  await expect(
    page.getByRole("region", { name: "Dashboard login" }),
  ).toContainText("has no login");
  await expectAccessible(page);

  // Recent changes keeps the record.
  await page.goto("/admin/activity?what=people");
  await expect(
    page
      .getByRole("heading", {
        name: /^Permanently deleted dashboard access/,
      })
      .first(),
  ).toBeVisible();
  // They had a login, so "Who" still lists them.
  await expect(
    page
      .getByRole("combobox", { name: "Who" })
      .locator("option", { hasText: "Karim Mansour" }),
  ).toHaveCount(1);
});
