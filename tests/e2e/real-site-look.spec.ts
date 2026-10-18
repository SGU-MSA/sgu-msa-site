import { expect, test, type Page } from "@playwright/test";

import { signInToSandbox } from "./actions";

/**
 * Review fixes PR-1: the sandbox (`npm run demo`) looks exactly like the
 * live site. No page shows "demo", "sample", "example", "placeholder", "not
 * approved" or "illustrative" in its visible text (any case). Only what a
 * person can read counts: code, attributes, hidden text and the dashboard's
 * instructions "for example …" and "a grey example" (plain English in board
 * hints, never a label on content) are left out.
 */
const labelWords =
  /\b(demo|sample|example|placeholder|not approved|illustrative)/i;
const instructions = /\bfor example\b|\ba grey example\b/gi;

async function labelsOn(page: Page, path: string) {
  await page.goto(path);
  const text = await page.locator("body").innerText();
  return text
    .split("\n")
    .filter((line) => labelWords.test(line.replace(instructions, "")))
    .map((line) => `${path}: ${line.trim()}`);
}

/** Every page the current page links to under `prefix`. */
async function linkedPages(page: Page, prefix: string) {
  const hrefs = await page
    .locator(`a[href^="${prefix}"]`)
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  return [
    ...new Set(
      hrefs
        .map((href) => (href ?? "").split(/[?#]/)[0])
        // Downloads (PDF, calendar file, the money export) are not pages.
        .filter(
          (href) =>
            href &&
            !/\.(pdf|ics)$|\/ics$|\/export$|^\/(media|api)\//.test(href),
        ),
    ),
  ];
}

test("public pages and every post and event page have no sample labels", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const paths = new Set([
    "/",
    "/about",
    "/calendar",
    "/community",
    "/contact",
    "/donate",
    "/faq",
    "/get-involved",
    "/merch",
    "/prayer",
    "/privacy",
    "/ramadan",
    "/resources",
    "/support",
    "/admin",
    "/admin/forgot-password",
  ]);
  for (const list of ["/calendar", "/community"]) {
    await page.goto(list);
    for (const path of await linkedPages(page, `${list}/`)) paths.add(path);
  }
  const found: string[] = [];
  for (const path of paths) found.push(...(await labelsOn(page, path)));
  expect(found).toEqual([]);
});

test("the board dashboard's screens have no sample labels", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await signInToSandbox(page);
  const paths = new Set(["/admin/dashboard", "/admin/help"]);
  for (const list of [
    "/admin/dashboard",
    "/admin/people",
    "/admin/handover",
    "/admin/payments",
    "/admin/payments/funds",
    "/admin/content/events",
    "/admin/content/announcements",
    "/admin/pages",
  ]) {
    paths.add(list);
    await page.goto(list);
    for (const path of await linkedPages(page, "/admin/"))
      if (!path.startsWith("/admin/auth")) paths.add(path);
  }
  const found: string[] = [];
  for (const path of paths) found.push(...(await labelsOn(page, path)));
  expect(found).toEqual([]);
});
