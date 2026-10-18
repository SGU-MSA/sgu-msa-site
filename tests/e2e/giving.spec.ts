import { viewportSize } from "../support/viewports";
import { test, expect, type Page } from "@playwright/test";
import { expectAccessible, signInToSandbox, submit } from "./actions";

/**
 * PR6 PR-C (docs/contracts/pr6-go2pay-payments.md, WP-8, WP-9): the Donate
 * page's slips, the Give route, the sandbox checkout and event tickets,
 * against the sandbox (`npm run demo`) and its sample funds. Ticket names
 * and Go2Pay numbers are new on every run, so the tests repeat against one
 * running sandbox.
 */
test.describe.configure({ mode: "serial" });
test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");

const run = Date.now();
/** The slips' titles, top to bottom. */
const slipTitles = (page: Page) =>
  page.locator("main li h3, main li h4").allTextContents();
/** Any Hijri date or year (D-78): month names, "AH" or a 14xx year. */
const hijri =
  /\b(Muharram|Safar|Rabi|Jumada|Rajab|Sha.?ban|Ramadan 14\d\d|Shawwal|Dhu.?l|AH)\b/;

test("Donate: slips in order, no heading but the board's, tags, rule lines, fine print", async ({
  page,
}) => {
  await page.goto("/donate");
  await expect(
    page.getByText("The fund you choose is your intention."),
  ).toBeVisible();
  expect(await slipTitles(page)).toEqual([
    "Zakat al-Fitr",
    "Zakat al-Mal",
    "Iftar",
    "Sadaqah",
    "MSA & Musallah",
    "Study circle books",
  ]);
  // No heading by default (D-77): the board's "Ramadan" over Iftar only.
  const groupHeadings = page.locator("main div > h3");
  await expect(groupHeadings).toHaveText(["Ramadan"]);
  await expect(page.locator("main h4")).toHaveText(["Iftar"]);
  const slip = (title: string) =>
    page.getByRole("listitem").filter({
      has: page.getByRole("heading", { name: title, exact: true }),
    });
  await expect(slip("Iftar")).toContainText("Sadaqah");
  // Slips start at the left, never centred: the lone Iftar under "Ramadan"
  // and the lone last slip too (D-80); a thin line ends the Ramadan group (D-79).
  const left = async (title: string) =>
    Math.round((await slip(title).boundingBox())!.x);
  expect(await left("Iftar")).toBe(await left("Zakat al-Fitr"));
  const heading = page.getByRole("heading", { name: "Ramadan", exact: true });
  expect(Math.round((await heading.boundingBox())!.x)).toBe(
    await left("Iftar"),
  );
  expect(await left("Study circle books")).toBe(await left("Sadaqah"));
  const ramadan = page.locator("main div").filter({
    has: page.getByRole("heading", { name: "Ramadan", exact: true }),
  });
  await expect(ramadan.last()).toHaveCSS("border-bottom-style", "solid");
  await expect(slip("Zakat al-Fitr")).toContainText(
    "Goes to people in need before Eid prayer.",
  );
  await expect(slip("Zakat al-Mal")).toContainText(
    "Goes only to people who can receive zakat.",
  );
  await expect(slip("Sadaqah")).not.toContainText("Goes ");
  await expect(slip("Study circle books")).toContainText("Closes tomorrow");
  await expect(page.getByText("Flood relief")).toHaveCount(0);
  // The Go2Pay notice near the top, before the slips (review fixes P4).
  const notice = page.getByText(
    "Payments are made on Go2Pay, an outside service. About 5% goes to fees.",
  );
  await expect(notice).toBeVisible();
  expect((await notice.boundingBox())!.y).toBeLessThan(
    (await slip("Zakat al-Fitr").boundingBox())!.y,
  );
  // No amounts, no Hijri date, and no Go2Pay address in the page (D-49, D-53, D-78).
  const html = await page.content();
  expect(html).not.toContain("go2pay.gd");
  expect(await page.locator("main").innerText()).not.toMatch(hijri);
  expect(await page.locator("main").innerText()).not.toMatch(
    /US\$\d+(?!.*per)/,
  );
  const give = slip("Iftar").getByRole("link", { name: /^Give on Go2Pay/ });
  await expect(give).toHaveAttribute("href", "/donate/iftar/give");
  await expect(give).toHaveAttribute("target", "_blank");
  await expectAccessible(page);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  await expectAccessible(page);
  await page.setViewportSize(viewportSize("390x844"));
  await page.reload();
  await expectAccessible(page);
});

test("Give: opens the sandbox checkout in a new tab", async ({ page }) => {
  await page.goto("/donate");
  const [checkout] = await Promise.all([
    page.waitForEvent("popup"),
    page
      .getByRole("listitem")
      .filter({ has: page.getByRole("heading", { name: "Sadaqah" }) })
      .getByRole("link", { name: /^Give/ })
      .click(),
  ]);
  await expect(checkout).toHaveURL(/\/checkout\/9005$/);
  await expect(
    checkout.getByRole("heading", { name: "Sadaqah", level: 1 }),
  ).toBeVisible();
  // The form only: paying would add to the sandbox totals that
  // payments.spec.ts reads. The fake payment is covered by
  // tests/payments-adapters.test.ts.
  await expect(checkout.getByLabel("Amount (US$)")).toBeVisible();
  await expect(checkout.getByLabel(/^Note for Vendor/)).toBeVisible();
  await expect(checkout.getByRole("button", { name: "Pay" })).toBeVisible();
  await expectAccessible(checkout);
});

test("Give: a closed, archived or unknown fund shows This has closed", async ({
  page,
}) => {
  for (const slug of ["flood-relief", "old-general-fund", `nothing-${run}`]) {
    await page.goto(`/donate/${slug}/give`);
    await expect(
      page.getByRole("heading", { name: "This has closed", level: 1 }),
    ).toBeVisible();
    const main = page.locator("#main-content");
    await expect(main.getByRole("link", { name: "Donate" })).toHaveAttribute(
      "href",
      "/donate",
    );
    await expect(main.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    await expect(page).toHaveURL(new RegExp(`/donate/${slug}/give$`));
  }
  await expectAccessible(page);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  await expectAccessible(page);
});

/** Picks the event's ticket in its form and saves, as the board account without money. */
async function chooseTicket(page: Page, event: string, ticket: string) {
  await page.goto("/admin/content/events");
  await page
    .getByRole("listitem")
    .filter({ hasText: event })
    .getByRole("link", { name: /^Edit/ })
    .first()
    .click();
  await page.getByLabel(/^Ticket/).selectOption({ label: ticket });
  await submit(page, "Save");
  await expect(page).toHaveURL(/\/admin\/content\/events$/);
}

test("Tickets: any board member gives an event a ticket; See price and buy; gone when cancelled or removed", async ({
  page,
}) => {
  // A fresh ticket with its own sample Go2Pay number.
  await signInToSandbox(page, "board");
  await page.goto("/admin/payments/tickets/new");
  const ticket = `E2E dinner ${run}`;
  await page.getByLabel(/^Name/).fill(ticket);
  await page
    .getByLabel(/^Go2Pay page link/)
    .fill(`go2pay.gd/${(run % 1_000_000) * 10 + 7}`);
  await page.getByLabel("On sale").check();
  await submit(page, "Save");

  // A scheduled event sells it.
  await chooseTicket(page, "Community volunteer morning", ticket);
  await page.goto("/admin/payments/tickets");
  await expect(
    page.getByRole("listitem").filter({ hasText: ticket }),
  ).toContainText("Used by Community volunteer morning");
  await page.goto("/calendar");
  await page
    .getByRole("link", { name: "Community volunteer morning", exact: true })
    .click();
  const buy = page.getByRole("link", { name: /^See price and buy/ });
  await expect(buy).toHaveAttribute("target", "_blank");
  const href = (await buy.getAttribute("href"))!;
  expect(href).toMatch(/^\/donate\/e2e-dinner-\d+\/give$/);
  expect(await page.locator("main").innerText()).not.toMatch(/US\$/);
  // The ticket is the filled button; Add to Calendar is outlined (D-82).
  await expect(
    page.getByRole("button", { name: /^Add to Calendar/ }),
  ).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expectAccessible(page);

  // Taken off the event: the button and the Give link go (D-23).
  await chooseTicket(page, "Community volunteer morning", "No ticket");
  await page.goto(href);
  await expect(
    page.getByRole("heading", { name: "This has closed", level: 1 }),
  ).toBeVisible();

  // A cancelled event never sells its ticket (D-23).
  await chooseTicket(page, "Beach clean-up", ticket);
  await page.goto("/calendar");
  await page.getByRole("link", { name: "Beach clean-up", exact: true }).click();
  await expect(
    page.getByRole("link", { name: /^See price and buy/ }),
  ).toHaveCount(0);
  await page.goto(href);
  await expect(
    page.getByRole("heading", { name: "This has closed", level: 1 }),
  ).toBeVisible();
  await chooseTicket(page, "Beach clean-up", "No ticket");

  // Postponed, new date not known yet: the event stays with its line, the
  // button and the Give link pause (D-81).
  await chooseTicket(page, "Qur'an night", ticket);
  await page.goto("/calendar");
  await page.getByRole("link", { name: "Qur'an night", exact: true }).click();
  // Under the title and as its Status (dashboard polish).
  await expect(
    page
      .getByText("Postponed: new date to be announced")
      .filter({ visible: true }),
  ).toHaveCount(2);
  await expect(
    page.getByRole("link", { name: /^See price and buy/ }),
  ).toHaveCount(0);
  await page.goto(href);
  await expect(
    page.getByRole("heading", { name: "This has closed", level: 1 }),
  ).toBeVisible();
  await chooseTicket(page, "Qur'an night", "No ticket");
});

test("Tickets: the Welcome dinner ticket opens the sandbox checkout", async ({
  page,
}) => {
  await page.goto("/calendar");
  await page.getByRole("link", { name: "Welcome dinner", exact: true }).click();
  const [checkout] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("link", { name: /^See price and buy/ }).click(),
  ]);
  await expect(checkout).toHaveURL(/\/checkout\/9101$/);
});
