import AxeBuilder from "@axe-core/playwright";
import {
  test,
  expect,
  type APIRequestContext,
  type Locator,
} from "@playwright/test";

import { savedToast, settled, signInToSandbox, submit } from "./actions";

test("the calendar feed answers GET and HEAD as a noindex calendar", async ({
  request,
}) => {
  const get = await request.get("/calendar.ics");
  expect(get.status()).toBe(200);
  expect(get.headers()["content-type"]).toContain("text/calendar");
  expect(get.headers()["x-robots-tag"]).toBe("noindex");
  expect(get.headers()["cache-control"]).toContain("s-maxage=300");
  const body = await get.text();
  expect(body).toContain("BEGIN:VCALENDAR");
  expect(body).toContain("X-WR-CALNAME:");
  expect(body.trimEnd().endsWith("END:VCALENDAR")).toBe(true);

  const head = await request.head("/calendar.ics");
  expect(head.status()).toBe(200);
  expect(head.headers()["content-type"]).toContain("text/calendar");
});

test("every event on the Events page is in the feed", async ({
  page,
  request,
}) => {
  const feed = await (await request.get("/calendar.ics")).text();
  await page.goto("/calendar");
  const hrefs = await page
    .locator('a[href^="/calendar/"]')
    .evaluateAll((links) =>
      links.map((link) => link.getAttribute("href") ?? ""),
    );
  const ids = hrefs
    .map((href) => /^\/calendar\/([^/?#]+)$/.exec(href)?.[1])
    .filter((id): id is string => Boolean(id));
  for (const id of ids)
    expect(feed).toContain(`UID:${decodeURIComponent(id)}@sgu-msa`);
});

for (const scheme of ["light", "dark"] as const) {
  test(`the Subscribe control opens its menu by keyboard (${scheme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/calendar");
    const subscribe = page.getByRole("button", {
      name: "Subscribe to calendar",
    });
    await subscribe.focus();
    await page.keyboard.press("Enter");
    const items = page.getByRole("menuitem");
    await expect(items).toHaveCount(4);
    await expect(
      page.getByRole("menuitem", { name: /Apple Calendar/ }),
    ).toHaveAttribute("href", /^webcal:\/\/.+\/calendar\.ics$/);
    await expect(
      page.getByRole("menuitem", { name: "Google Calendar" }),
    ).toHaveAttribute("href", /calendar\.google\.com\/calendar\/render\?cid=/);
    await expect(
      page.getByRole("menuitem", { name: "Outlook" }),
    ).toHaveAttribute("href", /outlook\.live\.com\/calendar\/0\/addfromweb/);
    await expect(
      page.getByRole("menuitem", { name: "Copy link" }),
    ).toBeVisible();
    const scan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(scan.violations.map((v) => v.id)).toEqual([]);
  });
}

/** On screen and not under another element (such as the open menu). */
async function expectUncovered(locator: Locator) {
  await expect(locator).toBeVisible();
  await expect(locator).toBeInViewport();
  const covered = await locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const top = document.elementFromPoint(
      box.left + box.width / 2,
      box.top + Math.min(box.height / 2, 12),
    );
    return !top || !element.contains(top);
  });
  expect(covered).toBe(false);
}

for (const width of [1280, 390]) {
  test(`Copy link confirms or fails where the person is looking (${width}px)`, async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/calendar");
    await page.getByRole("button", { name: "Subscribe to calendar" }).click();
    await page.getByRole("menuitem", { name: "Copy link" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Link copied" }),
    ).toHaveCount(1);
    const done = page.getByRole("menuitem", { name: "Link copied" });
    await expectUncovered(done);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
      /^https?:\/\/.+\/calendar\.ics$/,
    );
    await expect(page.getByRole("menuitem", { name: "Copy link" })).toBeVisible(
      { timeout: 4000 },
    );

    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: () => Promise.reject(new Error("blocked")) },
      });
    });
    await page.getByRole("menuitem", { name: "Copy link" }).click();
    const failed = page.getByRole("menuitem", { name: /^Couldn.t copy$/ });
    await expectUncovered(failed);
    const hint = page.locator('[class*="copyHint"]');
    await expectUncovered(hint);
    await expectUncovered(page.locator("code", { hasText: "/calendar.ics" }));
    await expect(
      page.getByRole("status").filter({ hasText: "Couldn" }),
    ).toContainText("select the link below");
    // It stays until the menu closes.
    await page.waitForTimeout(2500);
    await expectUncovered(hint);
  });
}

/** A feed's VEVENT for `id`, with folded lines joined. */
async function eventInFeed(request: APIRequestContext, id: string) {
  const text = (await (await request.get("/calendar.ics")).text()).replace(
    /\r\n /g,
    "",
  );
  return (
    text
      .split("BEGIN:VEVENT")
      .slice(1)
      .find((block) => block.includes(`UID:${id}@sgu-msa`)) ?? null
  );
}
const sequenceOf = (block: string) => Number(/SEQUENCE:(\d+)/.exec(block)![1]);

test("a board edit, cancel and archive reach the feed", async ({
  page,
  request,
}, testInfo) => {
  test.skip(
    !["desktop-light", "phone-dark"].includes(testInfo.project.name),
    "Needs the local sample server: npm run test:smoke.",
  );
  test.setTimeout(120_000);
  // The sample store's versions are opaque ids, not times, so SEQUENCE stays 0
  // here and can only be checked as "not lower"; its growth with `updated_at`
  // is a unit test (tests/calendar-feed.test.ts, tests/add-to-calendar.test.ts).
  await signInToSandbox(page, "board");

  async function create(title: string) {
    await page.goto("/admin/content/events/new");
    await settled(page);
    const name = page.getByLabel("Event name", { exact: true });
    await name.focus();
    await page.keyboard.type(title);
    await expect(name).toHaveValue(title);
    const place = page.getByLabel("Place", { exact: true });
    await place.focus();
    await page.keyboard.type("Feed test hall");
    const about = page.getByLabel("What is it about?", { exact: true });
    await about.focus();
    await page.keyboard.type("Feed test event.");
    await page.getByRole("radio", { name: "Everyone on the website" }).check();
    await submit(page, "Save", "keyboard");
    await expect(savedToast(page)).toContainText("Saved");
    await page.goto("/admin/content/events");
    const href = await page
      .getByRole("link", { name: `Edit ${title}` })
      .getAttribute("href");
    expect(href).toBeTruthy();
    return { href: href!, id: decodeURIComponent(href!.split("/").at(-1)!) };
  }
  async function archive(href: string) {
    await page.goto(href);
    await page.locator("summary", { hasText: "Archive this item" }).click();
    await submit(page, "Archive");
  }

  const stamp = Date.now();
  const renamed = await create(`Feed rename before ${stamp}`);
  const cancelled = await create(`Feed cancel ${stamp}`);
  const archived = await create(`Feed archive ${stamp}`);
  try {
    const before = {
      renamed: (await eventInFeed(request, renamed.id))!,
      cancelled: (await eventInFeed(request, cancelled.id))!,
    };
    expect(before.renamed).toContain(`SUMMARY:Feed rename before ${stamp}`);
    expect(await eventInFeed(request, archived.id)).not.toBeNull();

    await page.goto(renamed.href);
    await settled(page);
    await page
      .getByLabel("Event name", { exact: true })
      .fill(`Feed renamed after ${stamp}`);
    await submit(page, "Save");
    await expect(savedToast(page)).toContainText("Saved");

    await page.goto(cancelled.href);
    await settled(page);
    await page.getByRole("radio", { name: /Cancelled/ }).check();
    await page.getByLabel(/^Reason/).fill("Speaker unavailable");
    // Cancelling asks whether to post a notice; the feed does not need one.
    await page.getByRole("radio", { name: "No", exact: true }).check();
    await submit(page, "Save");
    await expect(savedToast(page)).toContainText("Saved");

    await archive(archived.href);

    const after = {
      renamed: (await eventInFeed(request, renamed.id))!,
      cancelled: (await eventInFeed(request, cancelled.id))!,
    };
    expect(after.renamed).toContain(`SUMMARY:Feed renamed after ${stamp}`);
    expect(sequenceOf(after.renamed)).toBeGreaterThanOrEqual(
      sequenceOf(before.renamed),
    );
    expect(after.cancelled).toContain("STATUS:CANCELLED");
    expect(after.cancelled).toContain(
      `SUMMARY:Cancelled: Feed cancel ${stamp}`,
    );
    expect(sequenceOf(after.cancelled)).toBeGreaterThanOrEqual(
      sequenceOf(before.cancelled),
    );
    expect(await eventInFeed(request, archived.id)).toBeNull();
  } finally {
    await archive(renamed.href);
    await archive(cancelled.href);
  }
});
