import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

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

test("Copy link confirms visibly and is announced; a blocked clipboard shows the link", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/calendar");
  await page.getByRole("button", { name: "Subscribe to calendar" }).click();
  await page.getByRole("menuitem", { name: "Copy link" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Link copied" }),
  ).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: "Link copied" }),
  ).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
    /^https?:\/\/.+\/calendar\.ics$/,
  );
  await expect(page.getByRole("menuitem", { name: "Copy link" })).toBeVisible({
    timeout: 4000,
  });

  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: () => Promise.reject(new Error("blocked")) },
    });
  });
  await page.getByRole("menuitem", { name: "Copy link" }).click();
  const note = page.getByRole("status").filter({ hasText: "Couldn't copy" });
  await expect(note).toContainText("press and hold the link to copy it");
  await expect(note.locator("code")).toContainText("/calendar.ics");
});
