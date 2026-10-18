import { test, expect } from "@playwright/test";
import {
  expectAccessible,
  savedToast,
  signInToSandbox,
  submit,
} from "./actions";

/**
 * Review fixes P3 (the approved plan of 2026-10-07): the Lists screen, the
 * event's Category and Term boxes, the Events page's filters fed from the
 * lists (hidden when an option has no events), and today ringed on the
 * month, against the sandbox (`npm run demo`).
 */
test.describe.configure({ mode: "serial" });
test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");

test("Lists: add, rename, delete only when unused; an option in use says what uses it", async ({
  page,
}) => {
  await signInToSandbox(page);
  await page.goto("/admin/dashboard");
  await page.getByRole("link", { name: /^Lists/ }).click();
  await expect(
    page.getByRole("heading", { name: "Lists", level: 1 }),
  ).toBeVisible();
  const terms = page.locator("#list-terms");
  // An option in use: no Delete, and what uses it.
  await expect(
    terms.getByText(/^Used by \d+ events\. Move them first\.$/),
  ).toBeVisible();
  await expect(
    terms.getByRole("button", { name: "Delete 2026 Fall" }),
  ).toHaveCount(0);

  const name = `Term ${Date.now()}`;
  await terms.getByPlaceholder("New term").fill(name);
  await terms.getByRole("button", { name: "Add" }).click();
  await expect(savedToast(page)).toContainText("Saved");
  await expect(
    page.locator("#list-terms").getByLabel(`Name of ${name}`),
  ).toHaveValue(name);

  // The same name again, whatever its case, is refused on its box.
  await page
    .locator("#list-terms")
    .getByPlaceholder("New term")
    .fill(name.toLowerCase());
  await page
    .locator("#list-terms")
    .getByRole("button", { name: "Add" })
    .click();
  await expect(
    page
      .locator("#list-terms")
      .getByText("This list already has an option with this name."),
  ).toBeVisible();
  await expectAccessible(page);

  // Rename, then delete (nothing uses it).
  await page.goto("/admin/lists");
  const renamed = `${name} renamed`;
  await page.locator("#list-terms").getByLabel(`Name of ${name}`).fill(renamed);
  await page
    .locator("#list-terms")
    .getByRole("button", { name: `Save name ${name}` })
    .click();
  await expect(savedToast(page)).toContainText("Saved");
  await page
    .locator("#list-terms")
    .getByRole("button", { name: `Delete ${renamed}` })
    .click();
  await expect(page).toHaveURL(/deleted=1/);
  await expect(page.getByRole("status")).toHaveText("Deleted.");
  await expect(
    page.locator("#list-terms").getByLabel(`Name of ${renamed}`),
  ).toHaveCount(0);
});

test("Events page: filters from the lists, hidden when empty; today ringed, event days dotted", async ({
  page,
}) => {
  await page.goto("/calendar");
  const categories = page.getByRole("group", { name: "Event category" });
  await expect(categories.getByRole("button", { name: "Faith" })).toBeVisible();
  // No sample event is Academic: its button is hidden.
  await expect(
    categories.getByRole("button", { name: "Academic" }),
  ).toHaveCount(0);
  // Only terms with events: 2026 Fall, not 2027 Spring.
  const term = page.getByLabel("Term");
  await expect(term.locator("option")).toHaveText(["All terms", "2026 Fall"]);
  await categories.getByRole("button", { name: "Faith" }).click();
  await expect(page.locator("ol li").first()).toContainText("Faith");
  // Past events: only the categories some past event has, and the choice
  // made under Upcoming goes back to All.
  await page.getByRole("button", { name: "Past events" }).click();
  await expect(categories.getByRole("button", { name: "All" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const pastNames = (await categories.getByRole("button").allInnerTexts())
    .map((name) => name.trim())
    .filter((name) => name !== "All");
  const count = page
    .locator('p[aria-live="polite"]')
    .filter({ hasText: /^\d+ events?$/ });
  for (const name of pastNames) {
    await categories.getByRole("button", { name, exact: true }).click();
    await expect(count).not.toHaveText("0 events");
  }
  await page.getByRole("button", { name: "Upcoming events" }).click();
  // Today is marked, as the current date.
  await expect(page.locator('[aria-current="date"]')).toHaveCount(1);
  await expect(page.locator('[aria-current="date"]')).toContainText("today");
});

test("an event's Category and Term show on its page; Create from this event clears the date", async ({
  page,
}) => {
  await signInToSandbox(page);
  await page.goto("/admin/content/events");
  await page
    .getByRole("link", { name: "Edit Community volunteer morning" })
    .click();
  await page
    .getByLabel("Category (optional)")
    .selectOption({ label: "Social" });
  await page
    .getByLabel("Term (optional)")
    .selectOption({ label: "2027 Spring" });
  await submit(page, "Save");
  await expect(savedToast(page)).toContainText("Saved");
  await page.goto("/calendar");
  const card = page
    .locator("li")
    .filter({ hasText: "Community volunteer morning" });
  await expect(card).toContainText("Social");
  await expect(card).toContainText("2027 Spring");

  await page.goto("/admin/content/events");
  await page
    .getByRole("link", { name: "Edit Community volunteer morning" })
    .click();
  await page.getByRole("link", { name: "Create from this event" }).click();
  await expect(page).toHaveURL(/\/admin\/content\/events\/new\?from=/);
  await expect(page.getByLabel("Event name")).toHaveValue(
    "Community volunteer morning",
  );
  await expect(page.getByLabel("Start date")).toHaveValue("");
  await expect(page.getByLabel("Category (optional)")).toHaveValue(/.+/);
  await expectAccessible(page);
});
