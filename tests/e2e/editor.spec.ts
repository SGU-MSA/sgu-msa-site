import { expectAccessible, fillTime, savedToast, submit } from "./actions";
import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import sharp from "sharp";
import { localDate } from "../../src/lib/community/schema";

async function login(page: Page) {
  await page.goto("/admin");
  await page
    .getByLabel("Email", { exact: true })
    .fill(process.env.E2E_ADMIN_EMAIL!);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard/);
}

test.beforeEach(async ({ page }) => {
  test.skip(!process.env.E2E_ADMIN_EMAIL, "Local test account required");
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
});

/** Each content form's name box (PR4 D-7). */
const nameLabel = {
  events: "Event name",
  news_posts: "Headline",
  newsletters: "Issue name",
} as const;

for (const kind of ["events", "news_posts", "newsletters"] as const) {
  test(`${kind}: responsive editor, publication and attachment`, async ({
    page,
    request,
  }) => {
    await page.goto(`/admin/content/${kind}/new`);
    const name = page.getByLabel(nameLabel[kind], { exact: true });
    await expect(name).toBeVisible();
    await expectAccessible(page);
    const title = `Local ${kind} ${Date.now()}`;
    await name.fill(title);
    if (kind === "events") {
      await page
        .getByLabel("What is it about?", { exact: true })
        .fill("A local-only verification record.");
      await page.getByLabel("Start date", { exact: true }).fill("2099-01-01");
      await fillTime(page, "Start time (optional)", "12:00");
      await fillTime(page, "End time (optional)", "13:00");
      await page
        .getByLabel("Place", { exact: true })
        .fill("Local test location");
    } else
      await page
        .getByLabel(
          kind === "newsletters"
            ? "Short description (optional)"
            : "One-line summary",
          { exact: true },
        )
        .fill("A local-only verification record.");
    if (kind === "newsletters") {
      await page.getByLabel("Newsletter file").setInputFiles({
        name: "test.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4\nLocal test fixture\n%%EOF"),
      });
    } else {
      await page
        .getByLabel("Describe the picture", { exact: true })
        .fill("A plain test image");
      const buffer = await sharp({
        create: { width: 640, height: 360, channels: 3, background: "#806020" },
      })
        .png()
        .toBuffer();
      await page
        .getByLabel(/^Picture/)
        .setInputFiles({ name: "test.png", mimeType: "image/png", buffer });
    }
    await page.getByRole("radio", { name: "Everyone on the website" }).check();
    await submit(page, "Save");
    await expect(savedToast(page)).toContainText("Saved");
    const editHref = await page
      .getByRole("link", { name: `Edit ${title}` })
      .getAttribute("href");
    const id = editHref!.split("/").at(-1);
    let asset: string;
    if (kind === "newsletters") {
      await page.goto("/resources");
      const issue = page.locator("li").filter({ hasText: title });
      asset = (await issue
        .getByRole("link", { name: "Open PDF" })
        .getAttribute("href"))!;
      const pdf = await request.get(asset);
      expect(pdf.status()).toBe(200);
      expect(pdf.headers()["content-disposition"]).toContain("attachment");
    } else {
      await page.goto(
        kind === "events" ? `/calendar/${id}` : `/community/news_posts/${id}`,
      );
      await expect(
        page.getByRole("heading", { name: title, exact: true }),
      ).toBeVisible();
      const image = page.getByRole("img", { name: "A plain test image" });
      await expect(image).toBeVisible();
      asset = (await image.getAttribute("src"))!;
      expect((await request.get(asset)).status()).toBe(200);
    }
    await page.goto(editHref!);
    await page.getByRole("radio", { name: "Only the board (draft)" }).check();
    await submit(page, "Save");
    await expect(savedToast(page)).toContainText("Saved");
    expect((await request.get(asset)).status()).toBe(404);
    await page.goto(editHref!);
    // Archive first (ADR 0013); permanent delete is only offered from Archived.
    await page.locator("summary", { hasText: "Archive this item" }).click();
    await submit(page, "Archive");
    await expect(page.getByRole("status")).toContainText("Archived");
    await page.goto(editHref!);
    await page.locator("summary", { hasText: "Delete permanently" }).click();
    await page.getByLabel("Type DELETE to confirm").fill("DELETE");
    await submit(page, "Delete permanently");
    await expect(page.getByRole("status")).toContainText("deleted");
  });
}

test("prayer settings save, expire and remain distinct from calculations", async ({
  page,
}) => {
  await page.goto("/admin/prayer-times");
  await expect(page.locator("h1")).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page
    .getByLabel("Times start on", { exact: true })
    .fill(localDate(new Date()));
  await page
    .getByLabel("Times end on", { exact: true })
    .fill(localDate(new Date()));
  await fillTime(page, "Fajr iqamah time", "05:40");
  await submit(page, "Save prayer settings");
  await expect(savedToast(page)).toContainText("Saved");
  await page.goto("/prayer");
  await expect(page.getByText("5:40 AM", { exact: true })).toBeVisible();
  // Starts are calculated at the musallah pin (PR7 migration seeds it).
  await expect(page.getByText(/^Prayer start times (will|are)/)).toHaveCount(0);
  await page.goto("/admin/prayer-times");
  await page.getByLabel("Times start on", { exact: true }).fill("2020-01-01");
  await page.getByLabel("Times end on", { exact: true }).fill("2020-01-02");
  await submit(page, "Save prayer settings");
  await expect(savedToast(page)).toContainText("Saved");
  await page.goto("/prayer");
  await expect(page.getByText("5:40 AM", { exact: true })).toHaveCount(0);
  await page.goto("/admin/prayer-times");
  await fillTime(page, "Fajr iqamah time", "");
  await page.getByLabel("Times start on", { exact: true }).fill("");
  await page.getByLabel("Times end on", { exact: true }).fill("");
  await submit(page, "Save prayer settings");
  await expect(savedToast(page)).toContainText("Saved");
});

// The local stack's mail catcher (Mailpit, `[inbucket]` in supabase/config.toml).
const mailbox = "http://127.0.0.1:54324";

/** The confirm link of the newest email to `to` with this subject, on the server under test. */
async function emailLink(
  request: APIRequestContext,
  to: string,
  subject: string,
  baseURL: string,
) {
  const query = encodeURIComponent(`to:"${to}" subject:"${subject}"`);
  let id: string | undefined;
  await expect
    .poll(
      async () => {
        const found = await (
          await request.get(`${mailbox}/api/v1/search?query=${query}`)
        ).json();
        id = found.messages?.[0]?.ID;
        return id;
      },
      { timeout: 15_000 },
    )
    .toBeTruthy();
  const { HTML } = await (
    await request.get(`${mailbox}/api/v1/message/${id}`)
  ).json();
  const href = String(HTML).match(/href="([^"]*token_hash=[^"]*)"/)![1];
  const link = new URL(href.replaceAll("&amp;", "&"));
  // The templates use the Auth site URL; follow the same path on the server under test.
  return new URL(link.pathname + link.search, baseURL).href;
}

test("access lifecycle: invite email, set password, reset signs out other devices, deactivation", async ({
  page,
  browser,
  request,
  baseURL,
}) => {
  const stamp = Date.now();
  const name = `Local invitee ${stamp}`;
  const email = `invitee-${stamp}@sgu-msa.invalid`;
  await page.goto("/admin/people/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page
    .getByRole("combobox", { name: /^Group/ })
    .selectOption({ label: "Advisors/Faculty" });
  await page.getByLabel("Show on public page").uncheck();
  await submit(page, "Save changes");
  await page.getByRole("link", { name: `Edit ${name}` }).click();
  await expect(page).toHaveURL(/\/admin\/people\/[0-9a-f-]{36}$/);
  const person = page.url();
  const access = page.getByRole("region", { name: "Dashboard login" });
  await access.getByLabel("Email for the invite").fill(email);
  await submit(page, "Send invite");
  await expect(
    access.getByRole("status").or(access.getByRole("alert")),
  ).toBeVisible();
  // `SUPABASE_SECRET_KEY=off` (the usual developer setting) sends no invites.
  const off = access.getByRole("alert").filter({ hasText: "switched off" });
  test.skip(
    await off.isVisible(),
    "Invites need SUPABASE_SECRET_KEY set to the local stack's secret key",
  );
  await expect(access.getByRole("status")).toContainText(
    `Invite email sent to ${email}.`,
  );
  await expect(access.getByText("Invited", { exact: true })).toBeVisible();

  // A mail scanner opens the link first (D-25): that GET leaves it unused.
  const inviteLink = await emailLink(
    request,
    email,
    "You're invited to the SGU MSA website dashboard",
    baseURL!,
  );
  const scanned = await request.get(inviteLink, { maxRedirects: 0 });
  expect(scanned.status()).toBe(200);
  expect(await scanned.text()).toContain("Continue");

  // The invitee follows the email link on another device and chooses a password (D-16).
  const invitee = await browser.newPage();
  await invitee.goto(inviteLink);
  await submit(invitee, "Continue");
  await expect(invitee).toHaveURL(/\/admin\/set-password$/);
  const first = `Local-first-${stamp}!`;
  await invitee.getByLabel("New password", { exact: true }).fill(first);
  await invitee.getByLabel("Type the new password again").fill(first);
  await submit(invitee, "Save password");
  await expect(invitee).toHaveURL(/\/admin\/dashboard$/);
  await page.goto(person);
  await expect(access.getByText("Login active", { exact: true })).toBeVisible();

  // A second device signs in; a reset from the sign-in page ends it (D-15).
  const otherDevice = await browser.newPage();
  await otherDevice.goto("/admin");
  await otherDevice.getByLabel("Email", { exact: true }).fill(email);
  await otherDevice.getByLabel("Password", { exact: true }).fill(first);
  await submit(otherDevice, "Sign In");
  await expect(otherDevice).toHaveURL(/\/admin\/dashboard/);
  const resetter = await browser.newPage();
  await resetter.goto("/admin/forgot-password");
  await resetter.getByRole("textbox", { name: "Email" }).fill(email);
  await submit(resetter, "Send reset link");
  await expect(resetter.getByRole("status")).toContainText(
    "If this email belongs to a board account",
  );
  const resetLink = await emailLink(
    request,
    email,
    "Reset your SGU MSA dashboard password",
    baseURL!,
  );
  await request.get(resetLink, { maxRedirects: 0 });
  await resetter.goto(resetLink);
  await submit(resetter, "Continue");
  await expect(resetter).toHaveURL(/\/admin\/set-password$/);
  // The Continue click used the link: it works only once.
  const reused = await browser.newPage();
  await reused.goto(resetLink);
  await submit(reused, "Continue");
  await expect(reused).toHaveURL(/\/admin\?link=expired$/);
  await reused.close();
  const second = `Local-second-${stamp}!`;
  await resetter.getByLabel("New password", { exact: true }).fill(second);
  await resetter.getByLabel("Type the new password again").fill(second);
  await submit(resetter, "Save password");
  await expect(resetter).toHaveURL(/\/admin\/dashboard$/);
  await otherDevice.goto("/admin/dashboard");
  await expect(otherDevice).toHaveURL(/\/admin$/);

  // Deactivation sends the person back to sign-in on every device.
  await page.goto(person);
  await access.locator("summary", { hasText: "Deactivate login" }).click();
  await submit(page, "Deactivate login");
  await expect(access.getByRole("status")).toContainText("Login deactivated.");
  await resetter.goto("/admin/dashboard");
  await expect(resetter).toHaveURL(/\/admin$/);
  await resetter.getByLabel("Email", { exact: true }).fill(email);
  await resetter.getByLabel("Password", { exact: true }).fill(second);
  await submit(resetter, "Sign In");
  await expect(
    resetter
      .getByRole("alert")
      .filter({ hasText: "does not have board access" }),
  ).toBeVisible();
});
