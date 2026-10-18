import { test, expect } from "@playwright/test";
import sharp from "sharp";
import {
  closePreview,
  expectAccessible,
  openPreview,
  settled,
  signInToSandbox,
  submit,
  pageButton,
} from "./actions";

/**
 * PR5c: season pages and merch from the dashboard, against the sandbox
 * (`npm run demo`, seeded today). Names and Go2Pay numbers are new on every
 * run, so the tests repeat against one running sandbox.
 */
test.describe.configure({ mode: "serial" });
test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");

const run = Date.now();
const RAMADAN = "00000000-0000-4000-8000-0000000005a1";
const SHUKR_ITEM = "00000000-0000-4000-8000-0000000007b3";
const SHUKR = "00000000-0000-4000-8000-0000000007a3";
/** Hijri years and month names: only prayer times and the calendar show them (D-31). */
const hijri =
  /\b(Muharram|Safar|Rabi|Jumada|Rajab|Sha.?ban|Shawwal|Dhu.?l|AH|14\d\d)\b/;

async function photo() {
  return {
    name: "shirt.jpg",
    mimeType: "image/jpeg",
    buffer: await sharp({
      create: { width: 64, height: 48, channels: 3, background: "#1f3d33" },
    })
      .jpeg()
      .toBuffer(),
  };
}

test("/ramadan stays up all year: the expected start, last year's label, no Hijri date", async ({
  page,
}) => {
  await page.goto("/ramadan");
  await expect(
    page.getByRole("heading", { name: "Ramadan", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText(
      /^Ramadan 20\d\d is expected to start around \d{1,2} \w{3}\.$/,
    ),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();
  expect(await page.locator("main").innerText()).not.toMatch(hijri);
  await expectAccessible(page);
  // /seasons/ramadan is the same page; a season without a page is a 404.
  await page.goto("/seasons/ramadan");
  await expect(page).toHaveURL(/\/ramadan$/);
  await page.goto("/seasons/eid-al-fitr");
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
});

test("the board fills Ramadan's page: intro, a schedule row and a photo, with Preview", async ({
  page,
}) => {
  await signInToSandbox(page);
  await page.goto(`/admin/seasons/${RAMADAN}`);
  await settled(page);
  const intro = `Iftar every night ${run}.`;
  await page.getByLabel(/^Introduction/).fill(intro);
  await page.getByRole("button", { name: "+ Add row" }).click();
  // A new row is refused until What and When are filled.
  await pageButton(page, "Save").click();
  await expect(page.getByText("Some boxes need fixing.")).toBeVisible();
  const schedule = page.getByRole("group", { name: "Schedule", exact: true });
  const row = schedule.locator(".page-list-item").last();
  await row.getByLabel("What").fill(`Family iftar ${run}`);
  await row.getByLabel("When").fill("Every Saturday at Maghrib");
  await page.getByRole("button", { name: "+ Add photo" }).click();
  const added = page
    .getByRole("group", { name: /^Photos/ })
    .locator(".page-list-item")
    .last();
  await added.getByLabel("Choose a photo").setInputFiles(await photo());
  await added.getByLabel("Describe the photo").fill(`Students at iftar ${run}`);
  // Save waits while the photo is made smaller.
  await expect(pageButton(page, "Save")).toBeEnabled();
  const preview = await openPreview(page);
  await expect(preview.getByText(intro)).toBeVisible();
  await expect(preview.getByText(`Family iftar ${run}`)).toBeVisible();
  await closePreview(page);
  await submit(page, "Save");
  await expect(page).toHaveURL(/\/admin\/seasons$/);
  await page.goto("/ramadan");
  await expect(page.getByText(intro)).toBeVisible();
  await expect(page.getByText(`Family iftar ${run}`)).toBeVisible();
  await expect(page.getByText(`Students at iftar ${run}`)).toBeVisible();
});

test("an event tagged with a season is listed on the season's page", async ({
  page,
}) => {
  await page.goto("/seasons/islamic-awareness-week");
  await expect(
    page.getByRole("heading", { name: "Islamic Awareness Week", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Islamic Awareness Week/ }),
  ).toBeVisible();
  await signInToSandbox(page);
  await page.goto("/admin/content/events");
  await page
    .getByRole("link", { name: /Community volunteer morning/ })
    .first()
    .click();
  await page.getByLabel(/^Season/).selectOption({ label: "Ramadan" });
  await submit(page, "Save");
  await page.goto("/ramadan");
  await expect(
    page.getByRole("link", { name: /Community volunteer morning/ }),
  ).toBeVisible();
});

test("/merch: sizes open their Give address; past collections are not for sale", async ({
  page,
}) => {
  await page.goto("/merch");
  const sizes = page.getByRole("group", {
    name: "Shukr long-sleeve: See price and buy",
  });
  await expect(sizes.getByRole("link", { name: /^S/ }).first()).toBeVisible();
  await expect(sizes.getByRole("link", { name: /^M/ })).toHaveAttribute(
    "href",
    "/donate/shukr-long-sleeve-m/give",
  );
  await expect(page.getByText("Not for sale")).toHaveCount(2);
  // No price, no Go2Pay address on our page (P-72 B).
  expect(await page.content()).not.toMatch(/go2pay\.gd|US\$/);
  await expectAccessible(page);
  // A size opens its own product (the sandbox checkout) in a new tab.
  const [checkout] = await Promise.all([
    page.context().waitForEvent("page"),
    sizes.getByRole("link", { name: /^M/ }).click(),
  ]);
  await expect(checkout).toHaveURL(/\/checkout\/9202$/);
});

test("any board member adds a size with its own Go2Pay page and an item with photos", async ({
  page,
}) => {
  // "board" cannot manage money: merch is for every board member (D-27 b).
  await signInToSandbox(page, "board");
  await page.goto(`/admin/merch/items/${SHUKR_ITEM}`);
  await page.getByRole("link", { name: "Add a size" }).click();
  await settled(page);
  const label = `X${run % 1000}`;
  await page.getByRole("textbox", { name: /^Size Shown/ }).fill(label);
  await page.getByLabel("On sale").check();
  await page
    .getByLabel(/^Go2Pay page link/)
    .fill(`go2pay.gd/${(run % 1_000_000) * 10 + 7}`);
  await submit(page, "Save");
  await expect(page).toHaveURL(new RegExp(`/admin/merch/items/${SHUKR_ITEM}`));
  await page.goto("/merch");
  await expect(
    page
      .getByRole("group", { name: "Shukr long-sleeve: See price and buy" })
      .getByRole("link", { name: new RegExp(`^${label}`) }),
  ).toBeVisible();

  await page.goto(`/admin/merch/collections/${SHUKR}`);
  await page.getByRole("link", { name: "Add an item" }).click();
  await settled(page);
  const name = `Hoodie ${run}`;
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(name);
  await page.getByRole("button", { name: "+ Add photo" }).click();
  const added = page.locator(".page-list-item").filter({ hasText: "Photo 1" });
  await added.getByLabel("Choose a photo").setInputFiles(await photo());
  await added.getByLabel("Describe the photo").fill(`The hoodie ${run}`);
  await expect(pageButton(page, "Save")).toBeEnabled();
  await submit(page, "Save");
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  await expectAccessible(page);
  await page.goto("/merch");
  await expect(page.getByRole("heading", { name })).toBeVisible();
  // An uploaded photo opens in the photo viewer (D-21: merch only).
  await page
    .getByRole("button", { name: new RegExp(`^Open photo.*The hoodie ${run}`) })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
