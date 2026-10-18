import { test, expect, type Page } from "@playwright/test";
import {
  closePreview,
  expectAccessible,
  openPreview,
  savedToast,
  signInToSandbox,
  submit,
  pageButton,
} from "./actions";

/**
 * PR6 PR-B (docs/contracts/pr6-go2pay-payments.md, WP-5, WP-6, WP-7): the
 * Funds, Tickets, Seasons and Payments screens against the sandbox
 * (`npm run demo`), whose one board account can manage money. Names and
 * Go2Pay numbers are new on every run, so the tests repeat against one
 * running sandbox.
 */
test.describe.configure({ mode: "serial" });
test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");

const run = Date.now();
/** A Go2Pay product number no sample item uses. */
const product = (n: number) => `go2pay.gd/${(run % 1_000_000) * 10 + n}`;
/** A refused save or action (not Next's route announcer). */
const refusal = (page: Page) => page.locator(".form-error[role='alert']");
/** The answer after a save, archive or restore. */
const notice = (page: Page) => page.locator(".success-message[role='status']");
/** Back to the form from the full-page Preview. */
const backToEdit = closePreview;

test("Funds: add a Sadaqah fund with its Go2Pay link, then a heading", async ({
  page,
}) => {
  await signInToSandbox(page);
  await page.getByRole("link", { name: /^Payments/ }).click();
  await expect(
    page.getByRole("heading", { name: "Payments", level: 1 }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Funds", exact: true }).click();
  await page.getByRole("link", { name: "Add a fund" }).click();

  const name = `Test sadaqah ${run}`;
  await page.getByLabel(/^Name/).fill(name);
  await page.getByRole("radio", { name: "Sadaqah" }).check();
  await page.getByLabel(/^About this fund/).fill("Test.");
  // The copy box follows the form.
  await expect(page.getByText(`Sadaqah. Test.`).first()).toBeVisible();

  // A typo, then a page another fund uses, are refused.
  const link = page.getByLabel(/^Go2Pay page link/);
  await link.fill("go2pay.gd/1234x");
  await expect(
    page.getByText("Paste the Go2Pay page link, for example go2pay.gd/557."),
  ).toBeVisible();
  await page.getByLabel("Show on the Donate page").check();
  // The browser stops the save; the link box says why (review 2).
  await pageButton(page, "Save").click();
  await expect(refusal(page)).toContainText("Some boxes need fixing.");
  await expect(link).toHaveAttribute("aria-invalid", "true");
  await expect(link).toBeFocused();
  await page.getByLabel(/^Go2Pay page link/).fill("go2pay.gd/9001");
  await submit(page, "Save");
  // Only the server knows this one; it shows on the same box.
  await expect(refusal(page)).toContainText("Some boxes need fixing.");
  await expect(
    page.getByText("This Go2Pay page is already used by MSA & Musallah."),
  ).toBeVisible();

  await page.getByLabel(/^Go2Pay page link/).fill(`https://${product(1)}`);
  await expect(page.getByText(`✓ Opens ${product(1)}`)).toBeVisible();
  // Preview draws the Donate page with this fund among today's funds.
  const donate = await openPreview(page);
  await expect(donate).toContainText("Choose where your gift goes");
  await expect(donate.locator("li").filter({ hasText: name })).toContainText(
    "Sadaqah",
  );
  // No heading by default (D-77 a).
  const headedGroup = (shown: typeof donate) =>
    shown.locator("div:has(> h3)").filter({ hasText: name });
  await expect(headedGroup(donate)).toHaveCount(0);
  await backToEdit(page);
  await submit(page, "Save");
  await expect(savedToast(page)).toContainText("Saved");
  const row = page.getByRole("listitem").filter({ hasText: name });
  await expect(row).toContainText("On the Donate page now");
  await expect(row).toContainText(`Opens ${product(1)}`);
  await expect(row).toContainText(/Locked since/);

  // A heading shows in the preview; the category is now locked.
  await row.getByRole("link", { name: `Edit ${name}` }).click();
  for (const category of ["Zakat al-Fitr", "Zakat al-Mal", "General"])
    await expect(page.getByRole("radio", { name: category })).toBeDisabled();
  await expect(page.getByText(/Locked since/).first()).toBeVisible();
  // The new-fund form stays in the document, hidden: fill the shown one.
  await page
    .getByLabel(/^Heading/)
    .filter({ visible: true })
    .fill("Ramadan");
  const headed = await openPreview(page);
  await expect(headedGroup(headed).locator(":scope > h3")).toHaveText(
    "Ramadan",
  );
  await expectAccessible(page);
  await backToEdit(page);
  await expect(
    page.getByText(`/donate/test-sadaqah-${run}/give`),
  ).toBeVisible();
  await expectAccessible(page);
  await submit(page, "Save");
  await expect(savedToast(page)).toContainText("Saved");
  await expect(
    page.getByRole("listitem").filter({ hasText: name }),
  ).toContainText("Heading: Ramadan");
});

test("Funds: a Zakat al-Mal fund needs its sentence; archive and restore", async ({
  page,
}) => {
  await signInToSandbox(page);
  await page.goto("/admin/payments/funds/new");
  const name = `Test zakat ${run}`;
  await page.getByLabel(/^Name/).fill(name);
  await page.getByRole("radio", { name: "Zakat al-Mal" }).check();
  await expect(page.getByLabel(/^About this fund/)).toHaveAttribute(
    "placeholder",
    "Passed on to people in need.",
  );
  await page.getByLabel(/^Go2Pay page link/).fill(product(2));
  await page.getByLabel("Show on the Donate page").check();
  await pageButton(page, "Save").click();
  await expect(refusal(page)).toContainText("Some boxes need fixing.");
  await expect(
    page.getByText(/^Zakat funds need it before they show\./),
  ).toBeVisible();
  await page
    .getByLabel(/^About this fund/)
    .fill("Passed on to people in need.");
  await expect(await openPreview(page)).toContainText(
    "Goes only to people who can receive zakat.",
  );
  await backToEdit(page);
  await submit(page, "Save");
  await expect(savedToast(page)).toContainText("Saved");

  const row = page.getByRole("listitem").filter({ hasText: name });
  await row.getByRole("link", { name: `Edit ${name}` }).click();
  await page.locator("summary", { hasText: "Archive this fund" }).click();
  await submit(page, "Archive fund");
  await expect(notice(page)).toContainText("Archived.");
  await page.getByRole("link", { name: "Archived", exact: true }).click();
  await page.getByRole("button", { name: `Restore ${name}` }).click();
  await expect(notice(page)).toHaveText("Restored.");
  await expect(
    page.getByRole("listitem").filter({ hasText: name }),
  ).toBeVisible();
});

test("Funds list: flags, and an ended fund asks to be closed in Go2Pay", async ({
  page,
}) => {
  await signInToSandbox(page);
  await page.goto("/admin/payments/funds");
  await expect(
    page.getByRole("listitem").filter({ hasText: "Flood relief" }),
  ).toContainText(/ended on .*Close it in Go2Pay/);
  await expect(
    page.getByRole("listitem").filter({ hasText: "Study circle books" }),
  ).toContainText("Shows until");
  await expectAccessible(page);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  await expectAccessible(page);
});

test("Tickets: add a ticket with its Go2Pay page; no price box", async ({
  page,
}) => {
  await signInToSandbox(page);
  await page.goto("/admin/payments/tickets");
  await page.getByRole("link", { name: "Add a ticket" }).click();
  const name = `Test dinner ${run}`;
  await page.getByLabel(/^Name/).fill(name);
  await expect(page.getByLabel(/^(Price|Stock|Sold out)/)).toHaveCount(0);
  await page.getByLabel(/^Go2Pay page link/).fill(product(3));
  await page.getByLabel("On sale").check();
  await submit(page, "Save");
  await expect(savedToast(page)).toContainText("Saved");
  await expect(
    page.getByRole("listitem").filter({ hasText: name }),
  ).toContainText("On sale");
});

test("Seasons: confirm a first day, see the fund move, clear it; an in-use season stays", async ({
  page,
}) => {
  await signInToSandbox(page);
  await page.getByRole("link", { name: /^Seasons/ }).click();
  await expect(
    page.getByRole("heading", { name: "Seasons", level: 1 }),
  ).toBeVisible();
  const eid = page.getByRole("row").filter({ hasText: "Eid al-Fitr" });
  await expect(eid).toContainText("On 1 Shawwal");
  await expect(eid).toContainText("expected");
  await expect(eid).toContainText("1 fund");
  await expectAccessible(page);

  await page.getByRole("link", { name: "Eid al-Fitr (edit)" }).click();
  const expected = (await page
    .getByText(/^Empty = expected /)
    .first()
    .textContent())!;
  // "Empty = expected Tue 9 Mar 2027": confirm the day after.
  const [, d, mon, y] = /(\d+) (\w{3}) (\d{4})/.exec(expected)!;
  const months = "JanFebMarAprMayJunJulAugSepOctNovDec";
  const day = new Date(
    Date.UTC(Number(y), months.indexOf(mon) / 3, Number(d) + 1, 12),
  )
    .toISOString()
    .slice(0, 10);
  await page.getByLabel("First day (confirmed)").fill(day);
  await page.getByLabel("Last day (confirmed)").fill(day);
  await submit(page, "Save");
  await expect(savedToast(page)).toContainText("Saved");
  await expect(
    page.getByRole("row").filter({ hasText: "Eid al-Fitr" }),
  ).toContainText("confirmed");

  // The fund tied to Eid al-Fitr moves with it.
  await page.goto("/admin/payments/funds");
  const label = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${day}T12:00:00Z`));
  await expect(
    page.getByRole("listitem").filter({ hasText: "Eid gifts" }),
  ).toContainText(`Shows ${label}`);

  // Clear the days; archiving is refused while a fund uses the season.
  await page.goto("/admin/seasons");
  await page.getByRole("link", { name: "Eid al-Fitr (edit)" }).click();
  await page.getByLabel("First day (confirmed)").fill("");
  await page.getByLabel("Last day (confirmed)").fill("");
  await submit(page, "Save");
  await expect(
    page.getByRole("row").filter({ hasText: "Eid al-Fitr" }),
  ).not.toContainText("confirmed");
  await page.getByRole("link", { name: "Eid al-Fitr (edit)" }).click();
  await page.locator("summary", { hasText: "Archive this season" }).click();
  await submit(page, "Archive season");
  await expect(refusal(page)).toContainText(
    "Move or archive the funds and items that use this season first.",
  );
  await expectAccessible(page);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  await expectAccessible(page);
});

test("Payments: zakat apart, the unrestricted subtotal, notes on screen, a CSV without names", async ({
  page,
}) => {
  await signInToSandbox(page);
  await page.goto("/admin/payments");
  // Review fixes PR-1: no "Sandbox" line and no "Test" badge on sample orders.
  await expect(page.getByText(/^Sandbox:/)).toHaveCount(0);
  await expect(page.locator(".money-table .admin-badge")).toHaveCount(0);
  const fitr = page.getByRole("region", { name: "Zakat al-Fitr" });
  const mal = page.getByRole("region", { name: "Zakat al-Mal" });
  const free = page.getByRole("region", { name: "Unrestricted" });
  await expect(fitr).toContainText("Never added to any other total.");
  await expect(fitr).toContainText("US$40.00");
  await expect(mal).toContainText("US$100.00");
  await expect(mal).toContainText("US$20.00");
  // MSA & Musallah 25, Iftar 30, Sadaqah 15 (refunded), ticket 30: no zakat.
  await expect(free).toContainText("Unrestricted money in");
  await expect(free).toContainText("US$100.00");
  await expect(page.getByText(/no grand total/)).toBeVisible();
  const table = page.locator(".money-table");
  await expect(table).toContainText("For the Musallah carpets.");
  await expect(table).toContainText("Bilal Ahmed");
  // The unfinished attempt (#7005) is not counted.
  await expect(table).not.toContainText("#7005");
  await expectAccessible(page);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  await expectAccessible(page);

  const href = await page
    .getByRole("link", { name: "Download CSV" })
    .getAttribute("href");
  const csv = await page.request.get(href!);
  expect(csv.status()).toBe(200);
  expect(csv.headers()["cache-control"]).toContain("no-store");
  const text = await csv.text();
  expect(text.split("\r\n")[0]).toBe(
    "Date,Fund or item,Category,Go2Pay product,Order no.,Gift,Buyer paid,Refunded,Status,Note",
  );
  expect(text).toContain("For the Musallah carpets.");
  expect(text).not.toContain("Bilal");
  expect(text).not.toContain("7005");

  // Filters: one category only.
  await page.getByLabel("Category").selectOption({ label: "Zakat al-Mal" });
  await page.getByRole("button", { name: "Show", exact: true }).click();
  await expect(page).toHaveURL(/category=zakat_al_mal/);
  await expect(page.locator(".money-table")).not.toContainText("Iftar");
});

test("Without 'Manage money': Money in and the CSV are refused; funds can still be edited (D-64, D-65)", async ({
  page,
}) => {
  await signInToSandbox(page, "board");
  await page.goto("/admin/payments");
  await expect(
    page.getByRole("heading", {
      name: "Only for board members who can manage money",
    }),
  ).toBeVisible();
  await expect(page.locator(".money-table")).toHaveCount(0);
  // No payer row (the bell's photo line names him among others, P4).
  await expect(page.getByText("Bilal Ahmed", { exact: true })).toHaveCount(0);
  const csv = await page.request.get("/admin/payments/export");
  expect(csv.status()).toBe(403);
  expect(csv.headers()["cache-control"]).toContain("no-store");
  expect(await csv.text()).not.toContain("Bilal");

  await page.goto("/admin/payments/funds/new");
  const name = `Test no money ${run}`;
  await page.getByLabel(/^Name/).fill(name);
  await page.getByRole("radio", { name: "General" }).check();
  await submit(page, "Save");
  await expect(savedToast(page)).toContainText("Saved");
  await page
    .getByRole("listitem")
    .filter({ hasText: name })
    .getByRole("link", { name: `Edit ${name}` })
    .click();
  await page
    .getByLabel(/^About this fund/)
    .filter({ visible: true })
    .fill("Edited without money rights.");
  await submit(page, "Save");
  await expect(savedToast(page)).toContainText("Saved");
});

test("Payments CSV: anyone without 'manage money' gets 403", async ({
  browser,
}) => {
  const visitor = await browser.newContext();
  const answer = await visitor.request.get("/admin/payments/export");
  expect(answer.status()).toBe(403);
  expect(await answer.text()).not.toContain("Bilal");
  await visitor.close();
});

test("Funds: each fund says whether it is on the Donate page today, or why not (review fixes P4)", async ({
  page,
}) => {
  await signInToSandbox(page);
  await page.goto("/admin/payments/funds");
  const row = (name: string) =>
    page.getByRole("listitem").filter({
      has: page.getByRole("heading", { name, exact: true }),
    });
  await expect(row("Sadaqah")).toContainText("On the Donate page now");
  await expect(row("Flood relief")).toContainText(
    /Not on the Donate page: ended on /,
  );
  await expect(row("Eid gifts")).toContainText(
    /Not on the Donate page: its season starts on /,
  );
});
