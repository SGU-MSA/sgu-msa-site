import { test, expect, type Page } from "@playwright/test";
import { savedToast, signInToSandbox, submit } from "./actions";

/**
 * Site essentials (docs/contracts/site-essentials.md) against the sandbox
 * (`npm run demo`): link-preview cards, manifest and icons, security.txt and
 * llms.txt, no structured data or verification off the live site, and a
 * Site-wide edit reaching the machine-readable files without a deploy.
 */
test.describe.configure({ mode: "serial" });
// Runs against the sandbox: with E2E_DEMO=true, or in the smoke config's
// projects (`npm run test:smoke`, which starts its own sandbox server).
test.beforeEach(({}, testInfo) => {
  test.skip(
    process.env.E2E_DEMO !== "true" &&
      !["desktop-light", "phone-dark"].includes(testInfo.project.name),
    "Explicit demo server required",
  );
});

const publicRoutes = [
  "/",
  "/prayer",
  "/calendar",
  "/community",
  "/resources",
  "/get-involved",
  "/about",
  "/contact",
  "/donate",
  "/faq",
  "/ramadan",
  "/merch",
  "/privacy",
];

/** The absolute address one preview tag points to, which must serve a PNG. */
async function expectCard(
  page: Page,
  property: string,
  attribute = "property",
) {
  const url = await page
    .locator(`meta[${attribute}="${property}"]`)
    .getAttribute("content");
  expect(url, `${property} on ${page.url()}`).toMatch(/^https?:\/\//);
  const response = await page.request.get(url!);
  expect(response.status(), url!).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/png");
  return url!;
}

test("every public page shares a large card with absolute image addresses", async ({
  page,
}) => {
  for (const path of publicRoutes) {
    await page.goto(path);
    await expectCard(page, "og:image");
    await expectCard(page, "twitter:image", "name");
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary_large_image",
    );
  }
});

test("an event and an update have their own cards", async ({ page }) => {
  await page.goto("/calendar");
  const event = page.locator('a[href^="/calendar/"]').first();
  const href = await event.getAttribute("href");
  await page.goto(href!);
  expect(await expectCard(page, "og:image")).toContain(`${href}/card?v=`);
  await page.goto("/community");
  const post = page.locator('a[href^="/community/"]').first();
  const postHref = await post.getAttribute("href");
  await page.goto(postHref!);
  expect(await expectCard(page, "og:image")).toContain(`${postHref}/card?v=`);
});

test("a card for an event or update that does not exist is a 404, not an image", async ({
  page,
}) => {
  expect(
    (await page.request.get("/calendar/no-such-event/card")).status(),
  ).toBe(404);
  expect(
    (
      await page.request.get("/community/announcements/no-such-update/card")
    ).status(),
  ).toBe(404);
});

test("the manifest, icons and root card are served", async ({ page }) => {
  const manifest = await page.request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  const json = await manifest.json();
  expect(json.name).toBe("SGU MSA");
  for (const icon of json.icons) {
    const response = await page.request.get(icon.src);
    expect(response.status(), icon.src).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
  }
  expect((await page.request.get("/favicon.ico")).status()).toBe(200);
  const root = await page.request.get("/opengraph-image");
  expect(root.status()).toBe(200);
  expect(root.headers()["content-type"]).toContain("image/png");
  await page.goto("/");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
});

test("security.txt and llms.txt are plain text with the Site-wide words", async ({
  page,
}) => {
  const security = await page.request.get("/.well-known/security.txt");
  expect(security.status()).toBe(200);
  expect(security.headers()["content-type"]).toContain("text/plain");
  expect(security.headers()["content-security-policy"]).toBeTruthy();
  const securityText = await security.text();
  expect(securityText).toContain("Contact: mailto:so-msa@sgu.edu");
  expect(securityText).toMatch(/^Expires: \d{4}-\d{2}-\d{2}T00:00:00\.000Z$/m);

  const llms = await page.request.get("/llms.txt");
  expect(llms.status()).toBe(200);
  expect(llms.headers()["content-type"]).toContain("text/plain");
  expect(llms.headers()["content-security-policy"]).toBeTruthy();
  const llmsText = await llms.text();
  expect(llmsText).toMatch(/^# SGU Muslim Students Association/);
  expect(llmsText).toMatch(/^> .+/m);
  expect(llmsText).toMatch(/\]\(https?:\/\/[^)]+\/calendar\)/);
});

test("the sandbox is not indexable: no structured data and no verification tag", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(
    0,
  );
  await expect(
    page.locator('meta[name="google-site-verification"]'),
  ).toHaveCount(0);
  await page.goto("/calendar");
  await page.goto(
    (await page.locator('a[href^="/calendar/"]').first().getAttribute("href"))!,
  );
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(
    0,
  );
});

test("a new search description shows in llms.txt and the manifest on the next request", async ({
  page,
}) => {
  await signInToSandbox(page);
  await page.goto("/admin/pages/site");
  const edit = page.getByRole("button", {
    name: "Edit Search engines",
    exact: true,
  });
  if (await edit.count()) await edit.click();
  const words = `Prayer times and community ${Date.now()}.`;
  await page.getByLabel("Description in search results").fill(words);
  await submit(page, "Save page");
  await expect(savedToast(page)).toContainText("Saved");
  const llms = await (await page.request.get("/llms.txt")).text();
  expect(llms).toContain(words);
  const manifest = await (
    await page.request.get("/manifest.webmanifest")
  ).json();
  expect(manifest.description).toBe(words);
});
