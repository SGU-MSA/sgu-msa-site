import { test, expect, type TestInfo } from "@playwright/test";
import {
  expectAccessible,
  pageButton,
  savedToast,
  settled,
  signInToSandbox,
  submit,
} from "./actions";

const smokeOrigin = "http://127.0.0.1:3217";

// This spec is also discovered by the general E2E command. Only the dedicated
// config may run it; that config pins every browser to its loopback server.
test.beforeEach(({}, testInfo) => {
  test.skip(
    !["desktop-light", "phone-dark"].includes(testInfo.project.name),
    "Run this local-only suite with npm run test:smoke.",
  );
});

test.beforeEach(async ({ page }, testInfo) => {
  expect(testInfo.project.use.baseURL).toBe(smokeOrigin);
  await page.goto("/");
  expect(page.viewportSize()).toEqual(testInfo.project.use.viewport);
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme",
    testInfo.project.use.colorScheme as string,
  );
});

function publicContextOptions(testInfo: TestInfo) {
  return {
    baseURL: smokeOrigin,
    viewport: testInfo.project.use.viewport,
    colorScheme: testInfo.project.use.colorScheme,
    isMobile: testInfo.project.use.isMobile,
    hasTouch: testInfo.project.use.hasTouch,
  };
}

test("signed-out admin pages and downloads refuse access", async ({ page }) => {
  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByLabel("Username", { exact: true }).fill("admin");
  await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();

  const payments = await page.request.get("/admin/payments/export");
  expect(payments.status()).toBe(403);
  expect(payments.headers()["cache-control"]).toContain("no-store");
  const term = await page.request.get(
    "/admin/term-export/download?name=Smoke&from=2020-01-01&until=2030-12-31",
  );
  expect(term.status()).toBe(403);
});

test("restricted board navigation and direct sensitive routes follow current rights", async ({
  page,
}) => {
  await signInToSandbox(page, "board");
  await expect(page.getByRole("link", { name: "Payments" })).toHaveAttribute(
    "href",
    "/admin/payments/funds",
  );
  await expect(page.getByRole("link", { name: /Term export/ })).toHaveCount(0);
  await expectAccessible(page);

  await page.goto("/admin/payments");
  await expect(
    page.getByRole("heading", {
      name: "Only for board members who can manage money",
    }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Payments" })
      .getByRole("link", { name: "Funds" }),
  ).toBeVisible();
  const csv = await page.request.get("/admin/payments/export");
  expect(csv.status()).toBe(403);

  await page.goto("/admin/term-export");
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  const zip = await page.request.get(
    "/admin/term-export/download?name=Smoke&from=2020-01-01&until=2030-12-31",
  );
  expect(zip.status()).toBe(403);
});

test("manager can navigate to protected Money in, Term export and own access", async ({
  page,
}) => {
  await signInToSandbox(page, "admin");
  await expect(page.getByRole("link", { name: "Payments" })).toHaveAttribute(
    "href",
    "/admin/payments",
  );
  await expect(page.getByRole("link", { name: /Term export/ })).toBeVisible();

  await page.goto("/admin/payments");
  await expect(page.getByRole("heading", { name: "Payments" })).toBeVisible();
  await page.goto("/admin/term-export");
  await expect(
    page.getByRole("heading", { name: "Term export", level: 1 }),
  ).toBeVisible();

  await page.goto("/admin/people");
  await page.getByRole("link", { name: "Edit Omar Haddad" }).click();
  const login = page.getByRole("region", { name: "Dashboard login" });
  await expect(login.getByLabel("Manage people")).toBeChecked();
  await expect(login.getByLabel("Manage people")).toBeDisabled();
  await login.locator("summary", { hasText: "Deactivate login" }).click();
  await expect(
    login.getByRole("button", { name: "Deactivate login" }),
  ).toBeDisabled();
  await expectAccessible(page);
});

test("published event edit appears in a separate public context and is restored", async ({
  page,
  browser,
}, testInfo) => {
  // Cold-CI route compiles, public revalidation, axe and archive cleanup can
  // exceed 30 seconds together; keep the extra allowance local to this flow.
  test.setTimeout(60_000);
  await signInToSandbox(page, "board");
  const title = `Browser smoke event ${Date.now()}`;
  const original = `Smoke event before board edit ${Date.now()}`;
  const marker = `Board edit visible to visitors ${Date.now()}`;
  await page.goto("/admin/content/events/new");
  await settled(page);
  const name = page.getByLabel("Event name", { exact: true });
  await name.focus();
  await page.keyboard.type(title);
  const place = page.getByLabel("Place", { exact: true });
  await place.focus();
  await page.keyboard.type("Smoke test hall");
  const body = page.getByLabel("What is it about?", { exact: true });
  await body.focus();
  await page.keyboard.type(original);
  await expect(name).toHaveValue(title);
  await expect(place).toHaveValue("Smoke test hall");
  await expect(body).toHaveValue(original);
  await page.getByRole("radio", { name: "Everyone on the website" }).check();
  await submit(page, "Save", "keyboard");
  await expect(savedToast(page)).toContainText("Saved");
  await page.goto("/admin/content/events");
  const edit = page.getByRole("link", { name: `Edit ${title}` });
  const href = await edit.getAttribute("href");
  expect(href).toBeTruthy();
  const publicContext = await browser.newContext(
    publicContextOptions(testInfo),
  );
  const publicPage = await publicContext.newPage();
  const publicPath = `/calendar/${href!.split("/").at(-1)}`;

  try {
    await publicPage.goto(publicPath);
    expect(publicPage.viewportSize()).toEqual(testInfo.project.use.viewport);
    await expect(publicPage.locator("html")).toHaveAttribute(
      "data-theme",
      testInfo.project.use.colorScheme as string,
    );
    await expect(publicPage.getByText(original, { exact: true })).toBeVisible();
    await page.goto(href!);
    await settled(page);
    const editBody = page.getByLabel("What is it about?", { exact: true });
    await expect(editBody).toHaveValue(original);
    await editBody.fill(marker);
    await expect(editBody).toHaveValue(marker);
    await submit(page, "Save");
    await expect(savedToast(page)).toContainText("Saved");
    await publicPage.goto("/");
    await publicPage.goto(publicPath);
    await publicPage.reload();
    await expect(publicPage.getByText(marker, { exact: true })).toBeVisible();
    await expect(publicPage.getByText(original, { exact: true })).toHaveCount(
      0,
    );
    await publicPage.screenshot({
      path: testInfo.outputPath("public-event.png"),
      fullPage: true,
    });
    await expectAccessible(publicPage);
    await page.goto(href!);
    await page.locator("summary", { hasText: "Archive this item" }).click();
    await submit(page, "Archive");
    await publicPage.goto(publicPath);
    await expect(publicPage.getByRole("heading", { name: title })).toHaveCount(
      0,
    );
  } finally {
    // If an assertion fails, archive the temporary test event before closing.
    if (href && !page.isClosed()) {
      await page.goto(href);
      const archive = page.locator("summary", {
        hasText: "Archive this item",
      });
      if (await archive.count()) {
        await archive.click();
        const archiveButton = pageButton(page, "Archive");
        if (await archiveButton.isEnabled()) await submit(page, "Archive");
      }
    }
    await publicContext.close();
  }
});

test("invalid event input stays visible, explains the error and receives focus", async ({
  page,
}, testInfo) => {
  await signInToSandbox(page);
  await page.goto("/admin/content/events/new");
  await settled(page);
  await page
    .getByLabel("Event name", { exact: true })
    .fill("Smoke invalid input");
  const link = page.getByLabel(/^Sign-up link/);
  await link.fill("http://example.invalid");
  await expect(link).toHaveAttribute("aria-invalid", "true");
  let posted = false;
  page.on("request", (request) => {
    if (request.method() === "POST") posted = true;
  });
  await pageButton(page, "Save").click();

  await expect(
    page.getByRole("alert").filter({ hasText: "Some boxes need fixing." }),
  ).toBeVisible();
  await expect(
    page.getByText("Use a secure web address (starting with https://)."),
  ).toBeVisible();
  await expect(link).toBeFocused();
  await expect(page.getByLabel("Event name", { exact: true })).toHaveValue(
    "Smoke invalid input",
  );
  expect(posted).toBe(false);
  await expectAccessible(page);
  await page.screenshot({
    path: testInfo.outputPath("invalid-event.png"),
    fullPage: true,
  });

  await link.fill("https://forms.gle/AbCdEf123");
  await expect(link).not.toHaveAttribute("aria-invalid", "true");
  await pageButton(page, "Save").click();
  await expect(savedToast(page)).toContainText("Saved");

  // Saving a corrected draft proves recovery; archive it so the demo is clean.
  await page.goto("/admin/content/events");
  await page.getByRole("link", { name: "Edit Smoke invalid input" }).click();
  await page.locator("summary", { hasText: "Archive this item" }).click();
  await submit(page, "Archive");
  await expect(page).toHaveURL(/\/admin\/content\/events(?:\?.*)?$/);
});

test("a lost session refuses a pending event save without changing public content", async ({
  page,
  browser,
}, testInfo) => {
  await signInToSandbox(page);
  await page.goto("/admin/content/events");
  const edit = page.getByRole("link", {
    name: "Edit Community volunteer morning",
  });
  const href = await edit.getAttribute("href");
  expect(href).toBeTruthy();
  await edit.click();
  await settled(page);
  const body = page.getByLabel("What is it about?", { exact: true });
  const original = await body.inputValue();
  expect(original.trim()).not.toBe("");
  const attempted = `Must not save after session loss ${Date.now()}`;
  await body.fill(attempted);
  const publicContext = await browser.newContext(
    publicContextOptions(testInfo),
  );
  const publicPage = await publicContext.newPage();

  try {
    await publicPage.goto(`/calendar/${href!.split("/").at(-1)}`);
    await page.context().clearCookies();
    await submit(page, "Save");
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Your session expired or access was removed." }),
    ).toContainText(
      "Your session expired or access was removed. Sign in again.",
    );
    await page.screenshot({
      path: testInfo.outputPath("session-refused.png"),
      fullPage: true,
    });
    await publicPage.reload();
    expect(publicPage.viewportSize()).toEqual(testInfo.project.use.viewport);
    await expect(publicPage.locator("html")).toHaveAttribute(
      "data-theme",
      testInfo.project.use.colorScheme as string,
    );
    await expect(
      publicPage.getByRole("heading", { name: "Community volunteer morning" }),
    ).toBeVisible();
    await expect(publicPage.getByText(original, { exact: true })).toBeVisible();
    await expect(publicPage.locator("article")).not.toContainText(attempted);
  } finally {
    await publicContext.close();
  }
});

test("admin content editor supports keyboard focus and passes axe", async ({
  page,
}, testInfo) => {
  await signInToSandbox(page, "board");
  await page.goto("/admin/content/events");
  const edit = page.getByRole("link", {
    name: "Edit Community volunteer morning",
  });
  await edit.focus();
  await expect(edit).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/admin\/content\/events\//);
  await expect(page.getByLabel("Event name", { exact: true })).toBeVisible();
  await expectAccessible(page);
  await page.screenshot({
    path: testInfo.outputPath("event-editor.png"),
    fullPage: true,
  });
});

test("the sign-in password can be shown and hidden by mouse and keyboard", async ({
  page,
}) => {
  await page.goto("/admin");
  await page.getByLabel("Username", { exact: true }).fill("someone");
  const field = page.getByLabel("Password", { exact: true });
  await field.fill("not-a-real-password");
  await expect(field).toHaveAttribute("type", "password");
  // One name; aria-pressed says whether the password is showing.
  const toggle = page.getByRole("button", { name: "Show password" });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(field).toHaveAttribute("type", "text");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(field).toHaveAttribute("type", "password");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  // Submitting while it shows puts it back to a password field first.
  await toggle.click();
  await expect(field).toHaveAttribute("type", "text");
  await field.evaluate((el) => {
    (el as HTMLInputElement).form!.addEventListener(
      "submit",
      (event) => event.preventDefault(),
      { once: true },
    );
    (el as HTMLInputElement).form!.requestSubmit();
  });
  await expect(field).toHaveAttribute("type", "password");
  await expectAccessible(page);
});
