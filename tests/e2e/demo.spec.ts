import { test, expect, devices, type Page } from "@playwright/test";
import sharp from "sharp";
import { formatTimeOfDay } from "../../src/lib/time/time-of-day";
import { comingFriday } from "../../src/lib/prayer/congregation";
import {
  tourPages,
  tourSteps,
  type TourId,
} from "../../src/features/admin/tour/steps";
import {
  expectAccessible,
  fillTime,
  openNotifications,
  savedToast,
  settled,
  signInToSandbox,
  submit,
  timeBox,
  timeValue,
  pageButton,
} from "./actions";

test("explicit demo is populated, unlabeled like the live site, image-free and non-indexable", async ({
  page,
}) => {
  test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");
  await page.goto("/");
  // Review fixes PR-1: no banner; the sandbox looks exactly like the live site.
  await expect(page.getByText(/DESIGN DEMO/)).toHaveCount(0);
  await expect(
    page.getByText("Welcome to the community", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Calculated prayer start times" })
      // The six start times (the Begins column); iqamah, the next prayer and
      // Jumu'ah are <time> too.
      .locator("tbody td:nth-child(2) > time"),
  ).toHaveCount(6);
  await expect(
    page.getByRole("img", { name: /Photo needed:/ }).first(),
  ).toBeVisible();
  await expect(page.locator('img[src*="/images/"]')).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  await page
    .getByRole("link", { name: /Welcome to the community/ })
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Welcome to the community",
  );
  await expect(
    page.getByText(/New and returning students are all welcome/),
  ).toBeVisible();
  await page.goto("/prayer");
  await expect(page.locator("video")).toHaveCount(0);
  await expect(page.locator("iframe")).toHaveCount(0);
});

/** The sandbox's starting pin (PR7 D-3, E-9), as the directions carry it. */
const startingPin = "12.0025521%2C-61.7723834";
const googleTo = (destination: string) =>
  `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=walking`;
const appleTo = (destination: string) =>
  `https://maps.apple.com/directions?destination=${destination}&mode=walking`;
/** Requests for the map library (public/maplibre) or the map service. */
const isMapRequest = (url: string) =>
  url.includes("/maplibre/") || url.includes("tiles.openfreemap.org");

/** A Playwright device without its browser choice (the run's browser is used). */
function phone(name: string) {
  const device: Partial<(typeof devices)[string]> = { ...devices[name] };
  delete device.defaultBrowserType;
  return device;
}

for (const [name, buttons] of [
  ["iPhone 15", ["Apple Maps", "Google Maps"]],
  ["Pixel 7", ["Google Maps"]],
] as const)
  test.describe(`Find us on campus on an ${name.startsWith("i") ? "Apple" : "Android"} phone`, () => {
    test.use({ ...phone(name), reducedMotion: "reduce" });

    test(`sandbox: ${name} sees ${buttons.join(" and ")}; the map loads only when scrolled to (PR7 WP-4)`, async ({
      page,
    }) => {
      test.skip(
        process.env.E2E_DEMO !== "true",
        "Explicit demo server required",
      );
      test.setTimeout(90_000);
      for (const path of ["/contact", "/"]) {
        await page.goto(path);
        await expect(
          page.getByRole("link", { name: /^(Apple|Google) Maps$/ }),
        ).toHaveText(buttons);
      }
      // This test alone uses the real map service (network); no other test
      // depends on it.
      const requests: string[] = [];
      const problems: string[] = [];
      page.on("request", (request) => requests.push(request.url()));
      page.on("console", (message) => {
        if (/Content.Security.Policy|Refused to/i.test(message.text()))
          problems.push(message.text());
      });
      await page.goto("/prayer");
      await page.waitForLoadState("networkidle");
      // The box is below the written directions: nothing is fetched yet (D-6).
      expect(requests.filter(isMapRequest)).toEqual([]);
      const links = page.getByRole("link", {
        name: /^(Apple|Google) Maps$/,
      });
      await expect(links).toHaveText(buttons);
      await expect(links.last()).toHaveAttribute("href", googleTo(startingPin));
      if (buttons.length === 2)
        await expect(links.first()).toHaveAttribute(
          "href",
          appleTo(startingPin),
        );
      await expect(
        page.getByText("Get directions", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("The map loads from OpenFreeMap as you scroll to it."),
      ).toHaveCount(0);

      const map = page.getByRole("region", {
        name: "Map of the SGU Musallah on campus",
      });
      await map.scrollIntoViewIfNeeded();
      await expect(map.locator("[data-map-ready]")).toBeAttached({
        timeout: 30_000,
      });
      await expect(map.locator("canvas")).toBeVisible();
      await expect(
        map.getByText("SGU Musallah", { exact: true }),
      ).toBeVisible();
      // D-15: only the closed ⓘ credit, no library logo or credit line.
      const credit = map.locator(".maplibregl-ctrl-attrib");
      await expect(credit).toHaveCount(1);
      await expect(credit).not.toHaveClass(/maplibregl-compact-show/);
      await expect(credit.locator(".maplibregl-ctrl-attrib-inner")).toHaveText(
        "© OpenStreetMap contributors · OpenFreeMap",
      );
      await expect(map.locator(".maplibregl-ctrl-logo")).toHaveCount(0);
      expect(requests.filter((url) => url.includes("/maplibre/"))).toContain(
        new URL("/maplibre/maplibre-gl-worker.mjs", page.url()).href,
      );
      expect(problems).toEqual([]);
      await expect(page.locator("iframe")).toHaveCount(0);
      await expectAccessibleLightAndDark(page);
    });
  });

test("sandbox: the box without the map: blocked map service, Save-Data, and no prayer-start gap (PR7 WP-4)", async ({
  page,
}) => {
  test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");
  // The map service is down or blocked: the buttons still work (Failure Modes).
  await page.route("https://tiles.openfreemap.org/**", (route) =>
    route.abort(),
  );
  await page.goto("/prayer");
  const map = page.getByRole("region", {
    name: "Map of the SGU Musallah on campus",
  });
  await map.scrollIntoViewIfNeeded();
  await expect(
    map.getByText("The map can’t be shown right now."),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Google Maps", exact: true }),
  ).toHaveAttribute("href", googleTo(startingPin));
  await expect(page.getByText(/^Prayer start times (will|are)/)).toHaveCount(0);

  // The browser asks to save data: the map is never fetched (E-10).
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "connection", {
      value: { saveData: true },
    }),
  );
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/prayer");
  await map.scrollIntoViewIfNeeded();
  await expect(map.getByText("Map hidden to save data.")).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(requests.filter(isMapRequest)).toEqual([]);
  await expect(
    page.getByRole("link", { name: "Google Maps", exact: true }),
  ).toBeVisible();

  // The privacy page names the map service (D-10).
  await page.goto("/privacy");
  await expect(
    page.getByRole("heading", { name: "Map", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/your browser loads map pictures from OpenFreeMap/),
  ).toBeVisible();
});

test("sandbox: move the musallah pin from Prayer & iqamah; the website follows (PR7 WP-5)", async ({
  page,
  context,
}) => {
  test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");
  test.setTimeout(120_000);
  // No zoom animation: each Zoom out press takes effect at once.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signInToSandbox(page);
  await page.goto("/admin/prayer-times");
  const section = page.getByRole("region", { name: "Musallah location" });
  await expect(section.getByLabel("Latitude")).toHaveCount(0);
  await expect(section.locator("input:not([type=hidden])")).toHaveCount(0);
  await expect(section.locator("[data-map-ready]")).toBeAttached({
    timeout: 30_000,
  });
  const latitude = section.locator('input[name="latitude"]');
  const longitude = section.locator('input[name="longitude"]');
  await expect(latitude).toHaveValue("12.0025521");

  // Keyboard only (D-5): focus the dot, move it with the arrow keys.
  const dot = section.getByRole("application", {
    name: "Musallah pin. Use the arrow keys to move it.",
  });
  await dot.focus();
  await page.keyboard.press("Shift+ArrowUp");
  await page.keyboard.press("ArrowRight");
  // Each move is read out by screen readers (polite live region).
  await expect(dot).toHaveAttribute("aria-roledescription", "draggable pin");
  await expect(section.locator('[aria-live="polite"]')).toHaveText(
    /^Pin moved, not saved yet\./,
  );
  const moved = {
    latitude: await latitude.inputValue(),
    longitude: await longitude.inputValue(),
  };
  expect(Number(moved.latitude)).toBeGreaterThan(12.0025521);
  expect(Number(moved.longitude)).toBeGreaterThan(-61.7723834);

  // Another tab saves the prayer settings meanwhile: both saves succeed,
  // because the pin has its own version (D-4).
  const other = await context.newPage();
  await other.goto("/admin/prayer-times");
  await submit(other, "Save prayer settings");
  await expect(savedToast(other)).toContainText("Saved");

  await submit(page, "Save location");
  await expect(page).toHaveURL(/\/admin\/prayer-times#musallah-location$/);
  await expect(savedToast(page)).toContainText("Saved");
  const destination = `${moved.latitude}%2C${moved.longitude}`;
  await expect(
    page.getByRole("link", { name: "Try Google Maps directions ↗" }),
  ).toHaveAttribute("href", googleTo(destination));

  // The second tab still shows the old pin: its save is refused, kept as moved.
  await other.goto("/admin/prayer-times");
  const stale = await context.newPage();
  await stale.goto("/admin/prayer-times");
  await page.goto("/admin/prayer-times");
  const otherSection = other.getByRole("region", { name: "Musallah location" });
  await expect(otherSection.locator("[data-map-ready]")).toBeAttached({
    timeout: 30_000,
  });
  await otherSection
    .getByRole("application", { name: /^Musallah pin/ })
    .focus();
  await other.keyboard.press("ArrowLeft");
  await submit(other, "Save location");
  const staleSection = stale.getByRole("region", { name: "Musallah location" });
  await expect(staleSection.locator("[data-map-ready]")).toBeAttached({
    timeout: 30_000,
  });
  await staleSection
    .getByRole("application", { name: /^Musallah pin/ })
    .focus();
  await stale.keyboard.press("ArrowDown");
  const kept = await staleSection
    .locator('input[name="latitude"]')
    .inputValue();
  await submit(stale, "Save location");
  await expect(staleSection.getByRole("alert")).toHaveText(
    "Someone else saved the location first. Reload to see it, then try again.",
  );
  await expect(staleSection.locator('input[name="latitude"]')).toHaveValue(
    kept,
  );
  await stale.close();

  // A post far from campus (forged: the page never sends one) is refused (review fixes P4).
  await page.goto("/admin/prayer-times");
  // Hydrated first: the forged value must not be drawn over.
  await settled(page);
  await section.locator('input[name="latitude"]').evaluate((input) => {
    (input as HTMLInputElement).value = "13.1";
  });
  await submit(page, "Save location");
  await expect(section.getByRole("alert")).toContainText(
    "The pin must be on or near the SGU campus. Drag it back onto the campus.",
  );

  // Zoomed far out, a dot dragged off campus jumps back, nothing posted.
  await page.goto("/admin/prayer-times");
  await expect(section.locator("[data-map-ready]")).toBeAttached({
    timeout: 30_000,
  });
  const before = await section.locator('input[name="longitude"]').inputValue();
  for (let zoom = 0; zoom < 8; zoom++)
    await section.getByRole("button", { name: "Zoom out" }).click();
  const box = (await section
    .getByRole("application", { name: /^Musallah pin/ })
    .boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 150, box.y + 40, { steps: 10 });
  await page.mouse.move(box.x - 300, box.y + 80, { steps: 10 });
  await page.mouse.up();
  await expect(section.getByRole("alert")).toHaveText(
    "The pin must be on or near the SGU campus. Drag it back onto the campus.",
  );
  await expect(section.locator('input[name="longitude"]')).toHaveValue(before);

  // The public box and Recent changes use the saved pin.
  const saved = await section.locator('input[name="latitude"]').inputValue();
  const savedLongitude = before;
  await page.goto("/prayer");
  await expect(
    page.getByRole("link", { name: "Google Maps", exact: true }),
  ).toHaveAttribute("href", googleTo(`${saved}%2C${savedLongitude}`));
  await page.goto("/admin/activity");
  await expect(
    page.getByRole("heading", { name: /musallah location/ }).first(),
  ).toBeVisible();
  await expectAccessibleLightAndDark(page);

  // Put the starting pin back for the other tests.
  await page.goto("/admin/prayer-times");
  // Hydrated first: the forged value must not be drawn over.
  await settled(page);
  await section.locator('input[name="latitude"]').evaluate((input) => {
    (input as HTMLInputElement).value = "12.0025521";
  });
  await section.locator('input[name="longitude"]').evaluate((input) => {
    (input as HTMLInputElement).value = "-61.7723834";
  });
  await submit(page, "Save location");
  await expect(page).toHaveURL(/\/admin\/prayer-times#musallah-location$/);
  await expectAccessibleLightAndDark(page);
});

test("sandbox: the preview route is gone and a wrong password is rejected", async ({
  page,
}) => {
  test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");
  const preview = await page.goto("/demo/prayer-settings");
  expect(preview?.status()).toBe(404);
  await page.goto("/admin");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password", { exact: true }).fill("wrong");
  await submit(page, "Sign In");
  await expect(
    page.getByRole("alert").filter({ hasText: "Sign-in unsuccessful" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/admin$/);
});

test("sandbox: admin/admin edits an event; the edit survives navigation and refresh", async ({
  page,
}) => {
  test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");
  await signInToSandbox(page);

  // A unique marker keeps the test repeatable against one running sandbox.
  const marker = `Sandbox edit ${Date.now()}`;
  await page.goto("/admin/content/events");
  const edit = page.getByRole("link", {
    name: "Edit Community volunteer morning",
  });
  const href = (await edit.getAttribute("href"))!;
  await edit.click();
  await page.getByLabel("What is it about?", { exact: true }).fill(marker);
  await submit(page, "Save");
  await expect(savedToast(page)).toContainText("Saved");

  const publicPage = `/calendar/${href.split("/").at(-1)}`;
  await page.goto(publicPage);
  await expect(page.getByText(marker)).toBeVisible();
  await page.goto("/");
  await page.goto(publicPage);
  await page.reload();
  await expect(page.getByText(marker)).toBeVisible();
  await page.goto(href);
  await expect(
    page.getByLabel("What is it about?", { exact: true }),
  ).toHaveValue(marker);

  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/admin$/);
});

test("sandbox: boxes turn red as you type, Save stops on them, and leaving asks first (review 2)", async ({
  page,
}) => {
  test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");
  await signInToSandbox(page);
  await page.goto("/admin/content/events/new");
  const title = `Sandbox refused ${Date.now()}`;
  await page.getByLabel("Event name", { exact: true }).fill(title);
  // A box is checked as you type once you have started on it.
  const link = page.getByLabel(/^Sign-up link/);
  await link.fill("http://sgu-msa-test.com");
  await expect(link).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByText("Use a secure web address (starting with https://)."),
  ).toBeVisible();
  await fillTime(page, "Start time (optional)", "13:00");
  // On the start day the end comes after the start: earlier times are
  // greyed out, never refused after Save (review fixes P1).
  const end = timeBox(page, "End time (optional)");
  await end.getByLabel("AM or PM", { exact: true }).selectOption("PM");
  await expect(
    end.getByLabel("Hour", { exact: true }).locator('option[value="12"]'),
  ).toBeDisabled();
  await end.getByLabel("Hour", { exact: true }).selectOption("1");
  const minutes = end.getByLabel("Minutes", { exact: true });
  await expect(minutes.locator('option[value="00"]')).toBeDisabled();
  await expect(minutes.locator('option[value="01"]')).toBeEnabled();
  await fillTime(page, "End time (optional)", "");
  await page.getByRole("radio", { name: "Everyone on the website" }).check();

  // Save with red boxes posts nothing: one line at the top, the first red
  // box takes the focus, and each box says why.
  let posted = false;
  page.on("request", (request) => {
    if (request.method() === "POST") posted = true;
  });
  await pageButton(page, "Save").click();
  const alert = page
    .getByRole("alert")
    .filter({ hasText: "Some boxes need fixing." });
  await expect(alert).toBeVisible();
  await expect(alert.getByRole("listitem")).toHaveCount(0);
  await expect(page.locator("[aria-invalid='true']")).toHaveCount(2);
  await expect(page.getByLabel("Place", { exact: true })).toBeFocused();
  for (const reason of [
    "Use a secure web address (starting with https://).",
    "Add where it happens, or save as a draft.",
  ])
    await expect(page.getByText(reason)).toBeVisible();
  expect(posted).toBe(false);
  await expect(page.getByLabel("Event name", { exact: true })).toHaveValue(
    title,
  );
  await expectAccessible(page);

  // Fixing a box clears it at once.
  await page.getByLabel("Place", { exact: true }).fill("Sandbox hall");
  await expect(page.getByLabel("Place", { exact: true })).not.toHaveAttribute(
    "aria-invalid",
    "true",
  );

  // Leaving with changes asks: Keep editing stays; Save is refused while a
  // box is red; Discard leaves.
  await page
    .getByRole("navigation", { name: "Breadcrumb" })
    .getByRole("link", { name: "Events" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Leave without saving?" });
  await expect(dialog).toBeVisible();
  await expectAccessible(page);
  await dialog.getByRole("button", { name: "Keep editing" }).click();
  await expect(dialog).toBeHidden();
  await page
    .getByRole("navigation", { name: "Breadcrumb" })
    .getByRole("link", { name: "Events" })
    .click();
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/admin\/content\/events\/new/);
  await expect(alert).toBeVisible();
  expect(posted).toBe(false);
  await page
    .getByRole("navigation", { name: "Breadcrumb" })
    .getByRole("link", { name: "Events" })
    .click();
  await dialog.getByRole("button", { name: "Discard" }).click();
  await expect(page).toHaveURL(/\/admin\/content\/events$/);
  await expect(page.getByText(title)).toHaveCount(0);
});

test("sandbox: opening a board form and leaving at once asks nothing (review 2)", async ({
  page,
}) => {
  test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");
  test.setTimeout(180_000);
  await signInToSandbox(page);
  for (const path of [
    "/admin/content/events/new",
    "/admin/content/events/00000000-0000-4000-8000-000000000100",
    "/admin/content/announcements/new",
    "/admin/content/news_posts/new",
    "/admin/content/newsletters/new",
    "/admin/prayer-times",
    "/admin/people/new",
    "/admin/people/groups",
    "/admin/payments/funds/new",
    "/admin/payments/tickets/new",
    "/admin/seasons/new",
    "/admin/pages/about",
    "/admin/handover/steps",
    "/admin/handover/logins/new",
  ]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await page
      .getByRole("navigation", { name: "Breadcrumb" })
      .getByRole("link", { name: "Dashboard" })
      .click();
    await expect(page, path).toHaveURL(/\/admin\/dashboard/);
  }
});

test("sandbox: Save in the leave dialog saves, then opens the page that was clicked (review 2)", async ({
  page,
}) => {
  test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");
  await signInToSandbox(page);
  await page.goto("/admin/content/events/new");
  const title = `Leave and save ${Date.now()}`;
  await page.getByLabel("Event name", { exact: true }).fill(title);
  await page
    .getByRole("link", { name: "Dashboard", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "Leave without saving?" });
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard/);
  await page.goto("/admin/content/events");
  await expect(page.getByRole("link", { name: `Edit ${title}` })).toBeVisible();
  // Nothing changed: no question.
  await page.getByRole("link", { name: `Edit ${title}` }).click();
  await expect(page).toHaveURL(/\/admin\/content\/events\/[0-9a-f-]{36}$/);
  // Pages visited before stay in the document, hidden: the shown link only.
  await page
    .getByRole("link", { name: "Dashboard", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/admin\/dashboard/);
});

test("sandbox: a board form opened by a link starts from the saved text; Back keeps what was typed (review 2 PR-C)", async ({
  page,
}) => {
  test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");
  await signInToSandbox(page);
  await page.goto("/admin/content/events/new");
  const name = page
    .getByLabel("Event name", { exact: true })
    .filter({ visible: true });
  const title = `Discarded ${Date.now()}`;
  await name.fill(title);
  const dialog = page.getByRole("dialog", { name: "Leave without saving?" });
  const leave = async () => {
    await page
      .getByRole("navigation", { name: "Breadcrumb" })
      .filter({ visible: true })
      .getByRole("link", { name: "Events" })
      .click();
    await dialog.getByRole("button", { name: "Discard" }).click();
    await expect(page).toHaveURL(/\/admin\/content\/events$/);
  };
  await leave();
  // The browser's Back button: the page as it was left.
  await page.goBack();
  await expect(page).toHaveURL(/\/admin\/content\/events\/new$/);
  await expect(name).toHaveValue(title);
  await leave();
  // A link: the form starts over; the discarded text does not come back.
  await page
    .getByRole("link", { name: "Create new" })
    .filter({ visible: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/content\/events\/new$/);
  await expect(name).toHaveValue("");
});

test("sandbox: the four simplified content forms show only the approved boxes and publish as before", async ({
  page,
}) => {
  test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");
  // Four forms, each scanned by axe in light and dark, and four publications.
  test.setTimeout(120_000);
  await signInToSandbox(page);
  const form = page.locator("form.editor-form");
  const everyone = page.getByRole("radio", { name: "Everyone on the website" });

  // PR4 D-7: each kind's labels; the old boxes and the Published checkbox are gone.
  const forms = {
    events: [
      "Event name",
      "Start date",
      "Start time (optional)",
      "End date (optional)",
      "End time (optional)",
      "Place",
      // Review fixes P3: from Dashboard → Lists.
      "Category (optional)",
      "Term (optional)",
      "What is it about?",
      "Describe the picture",
      "Sign-up link (optional)",
    ],
    announcements: [
      "Headline",
      "One-line summary",
      "Full message",
      "Show from",
      "Hide after (optional)",
      // PR5a: "How important is it?" replaces the homepage tick box.
      "Normal",
      "Featured",
      "Urgent",
      "Describe the picture",
      "Link (optional)",
    ],
    news_posts: [
      "Headline",
      "One-line summary",
      "Full story",
      "Date",
      "Describe the picture",
      "Link (optional)",
      "Pin to the top of Community updates",
      "Hide after (optional)",
    ],
    newsletters: [
      "Issue name",
      "Issue date",
      "Short description (optional)",
      "Upload a PDF or an image (max 3 MB)",
      "Link to it (https://…)",
    ],
  } as const;
  const removed = [
    "Title",
    "Short summary",
    "Full description",
    "Feature on the homepage",
    "Image description",
  ];
  for (const [kind, labels] of Object.entries(forms)) {
    await page.goto(`/admin/content/${kind}/new`);
    for (const label of labels)
      await expect(form.getByLabel(label, { exact: true })).toHaveCount(1);
    for (const label of removed)
      await expect(form.getByLabel(label, { exact: true })).toHaveCount(0);
    await expect(form.getByLabel(/^Expiration date/)).toHaveCount(0);
    await expect(
      form.getByRole("checkbox", { name: /^Published/ }),
    ).toHaveCount(0);
    await expect(
      form.getByRole("radio", { name: "Only the board (draft)" }),
    ).toBeChecked();
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      // Reload: a live switch is scanned mid colour transition.
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute(
        "data-theme",
        colorScheme,
      );
      await expectAccessible(page);
    }
  }
  await page.emulateMedia({ colorScheme: "light" });
  // Removed per kind: an event has no summary or homepage box, a newsletter no picture.
  await page.goto("/admin/content/events/new");
  await expect(form.getByLabel("One-line summary")).toHaveCount(0);
  await expect(form.getByLabel(/^Hide after/)).toHaveCount(0);
  await expect(form.getByLabel(/homepage/)).toHaveCount(0);
  await page.goto("/admin/content/newsletters/new");
  await expect(form.getByLabel(/picture/i)).toHaveCount(0);
  await expect(form.getByLabel(/^Hide after/)).toHaveCount(0);

  // An event saved before PR4 with only a short summary keeps its description.
  const stamp = Date.now();
  const event = `Summary-only event ${stamp}`;
  const summary = `Short summary only ${stamp}`;
  await page.goto("/admin/content/events/new");
  await page.getByLabel("Event name", { exact: true }).fill(event);
  await fillTime(page, "Start time (optional)", "17:00");
  await page.getByLabel("Place", { exact: true }).fill("Charter Hall");
  await everyone.check();
  // The form no longer shows a summary; set the kept one as an older item
  // had it, last (a change in the form draws it again).
  await form
    .locator('input[name="summary"]')
    .evaluate(
      (input, text) => ((input as HTMLInputElement).value = text),
      summary,
    );
  await submit(page, "Save");
  await expect(savedToast(page)).toContainText("Saved");
  const eventHref = (await page
    .getByRole("link", { name: `Edit ${event}` })
    .getAttribute("href"))!;
  const eventPage = `/calendar/${eventHref.split("/").at(-1)}`;
  await page.goto(eventPage);
  await expect(page.getByText(summary)).toBeVisible();
  await page.goto(eventHref);
  await expect(
    page.getByLabel("What is it about?", { exact: true }),
  ).toHaveValue(summary);
  await submit(page, "Save");
  await expect(savedToast(page)).toContainText("Saved");
  await page.goto(eventPage);
  await expect(page.getByText(summary)).toBeVisible();
  await page.goto(eventHref);
  await expect(form.locator('input[name="summary"]')).toHaveValue("");

  // An announcement and a news story publish with "Everyone on the website".
  const notice = `Simplified notice ${stamp}`;
  await page.goto("/admin/content/announcements/new");
  await page.getByLabel("Headline", { exact: true }).fill(notice);
  await page
    .getByLabel("One-line summary", { exact: true })
    .fill("Cleaning day; reopens Sunday.");
  await everyone.check();
  await submit(page, "Save");
  await expect(savedToast(page)).toContainText("Saved");
  const story = `Simplified story ${stamp}`;
  await page.goto("/admin/content/news_posts/new");
  await page.getByLabel("Headline", { exact: true }).fill(story);
  await page.getByLabel("Full story", { exact: true }).fill("A full story.");
  await everyone.check();
  await submit(page, "Save");
  await expect(savedToast(page)).toContainText("Saved");
  await page.goto("/community");
  await expect(page.getByRole("link", { name: notice })).toBeVisible();
  await expect(page.getByRole("link", { name: story })).toBeVisible();

  // A newsletter with a link; the archive lists it next to the sample issue.
  const issue = `Simplified issue ${stamp}`;
  const link = `https://sgu-msa-test.com/letter-${stamp}.pdf`;
  await page.goto("/admin/content/newsletters/new");
  await page.getByLabel("Issue name", { exact: true }).fill(issue);
  await page.getByRole("radio", { name: "Link to it (https://…)" }).check();
  await page.getByLabel("Link to the newsletter").fill(link);
  await everyone.check();
  await submit(page, "Save");
  await expect(savedToast(page)).toContainText("Saved");
  const issueHref = (await page
    .getByRole("link", { name: `Edit ${issue}` })
    .getAttribute("href"))!;
  // Saving it again unchanged keeps the link.
  await page.goto(issueHref);
  await expect(
    page.getByRole("radio", { name: "Link to it (https://…)" }),
  ).toBeChecked();
  await submit(page, "Save");
  await expect(savedToast(page)).toContainText("Saved");
  await page.goto("/resources");
  await expect(
    page
      .locator("li")
      .filter({ hasText: issue })
      .getByRole("link", { name: "Open PDF" }),
  ).toHaveAttribute("href", link);
  // An issue with no file and no link is not listed: nothing to open.
  await expect(
    page.locator("li").filter({ hasText: "The community letter" }),
  ).toHaveCount(0);

  // Choosing the PDF without a file is refused, not saved with the old link.
  await page.goto(issueHref);
  await page
    .getByRole("radio", { name: "Upload a PDF or an image (max 3 MB)" })
    .check();
  await pageButton(page, "Save").click();
  await expect(form.getByRole("alert")).toContainText(
    "Some boxes need fixing.",
  );
  await expect(
    form.getByText("Choose a PDF or an image, or add a link."),
  ).toBeVisible();

  // An uploaded PDF is what visitors open; choosing "Link to it" takes it off.
  const openIssue = page
    .locator("li")
    .filter({ hasText: issue })
    .getByRole("link", { name: "Open PDF" });
  await page.goto(issueHref);
  await page
    .getByRole("radio", { name: "Upload a PDF or an image (max 3 MB)" })
    .check();
  await page.getByLabel("Newsletter file").setInputFiles({
    name: "letter.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nSandbox test fixture\n%%EOF"),
  });
  await submit(page, "Save");
  await expect(savedToast(page)).toContainText("Saved");
  await page.goto(issueHref);
  await expect(
    page.getByRole("radio", { name: "Upload a PDF or an image (max 3 MB)" }),
  ).toBeChecked();
  await expect(
    form.getByText("A PDF is attached; choose a file to replace it."),
  ).toBeVisible();
  await page.goto("/resources");
  await expect(openIssue).not.toHaveAttribute("href", link);
  const relink = `https://sgu-msa-test.com/relinked-${stamp}.pdf`;
  await page.goto(issueHref);
  await page.getByRole("radio", { name: "Link to it (https://…)" }).check();
  await expect(
    form.getByText("Saving takes the attached file off this issue."),
  ).toBeVisible();
  await page.getByLabel("Link to the newsletter").fill(relink);
  await submit(page, "Save");
  await expect(savedToast(page)).toContainText("Saved");
  await page.goto("/resources");
  await expect(openIssue).toHaveAttribute("href", relink);
  await page.goto(issueHref);
  await expect(
    page.getByRole("radio", { name: "Link to it (https://…)" }),
  ).toBeChecked();
  await expect(form.getByText(/A PDF is attached/)).toHaveCount(0);
});

test("sandbox: People: the Executive board takes one of its five roles, one person each; groups are added, archived, restored and deleted", async ({
  page,
}) => {
  test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");
  await page.setViewportSize({ width: 390, height: 844 });
  await signInToSandbox(page);
  await page.getByRole("link", { name: /^People/ }).click();
  await expect(page).toHaveURL(/\/admin\/people$/);
  await expect(
    page.getByRole("heading", { name: "Aisha Rahman" }),
  ).toBeVisible();
  // No consent wording and no move arrows anywhere (review 2).
  await expect(page.getByText(/consent/i)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^Move (up|down)/ }),
  ).toHaveCount(0);
  await expectAccessible(page);

  await page.getByRole("link", { name: "Add a person" }).click();
  // "Show on public page" starts ticked (review fixes P4).
  await expect(page.getByLabel("Show on public page")).toBeChecked();
  await expect(page.getByLabel("Order number")).toHaveCount(0);
  await expect(page.getByText(/consent/i)).toHaveCount(0);
  await expectAccessible(page);

  const name = `Sandbox person ${Date.now()}`;
  await page.getByLabel("Name", { exact: true }).fill(name);
  // "Show on public page" follows the group's start answer until the board picks.
  const group = page.getByRole("combobox", { name: /^Group/ });
  await group.selectOption({ label: "General board" });
  await expect(page.getByLabel("Show on public page")).toBeChecked();
  // Other groups: a free role title, with the founder's roles suggested.
  await page.getByLabel("Role title (optional)").fill("Events lead");
  await expect(
    page.locator('#role-title-suggestions option[value="Pre-med term rep"]'),
  ).toHaveCount(1);
  // The Executive board: the role is one of its five, from a list.
  await group.selectOption({ label: "Executive board" });
  // The Executive board is always on About: no box (review fixes P4).
  await expect(page.getByLabel("Show on public page")).toHaveCount(0);
  await expect(
    page.getByText("Everyone in the Executive board is on the About page"),
  ).toBeVisible();
  await expect(page.getByLabel("Role title (optional)")).toHaveCount(0);
  const role = page.getByRole("combobox", { name: /^Role/ });
  await expect(role.locator("option:not([disabled])")).toHaveText([
    "President",
    "Vice President (Brothers)",
    "Vice President (Sisters)",
    "Treasurer",
    "Secretary",
  ]);
  // Save with no role: the box says why, nothing is posted (review 2).
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Some boxes need fixing.")).toBeVisible();
  await expect(
    page.getByText("Choose one of the Executive board roles."),
  ).toBeVisible();
  await expect(role).toBeFocused();
  await expect(role).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByLabel("Name", { exact: true }).filter({ visible: true }),
  ).toHaveValue(name);
  await role.selectOption({ label: "Treasurer" });
  await expect(
    page.getByText("Choose one of the Executive board roles."),
  ).toHaveCount(0);
  // One current person per role (2026-10-06): the Treasurer is asked about.
  const question = page.getByRole("group", {
    name: `Maryam Siddiqui is Treasurer. Make ${name} Treasurer instead?`,
  });
  await expect(question).toContainText(
    "Maryam Siddiqui moves to the General board, with no role title. Nobody is deleted.",
  );
  await expectAccessible(page);
  // Save before answering: the question is answered first, nothing is posted.
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(question).toContainText("Answer Yes or Cancel first.");
  await expect(question.getByRole("button", { name: "Yes" })).toBeFocused();
  await expect(role).not.toHaveAttribute("aria-invalid", "true");
  // Cancel puts the role back.
  await question.getByRole("button", { name: "Cancel" }).click();
  await expect(question).toHaveCount(0);
  await expect(role).toHaveValue("");
  await expect(role).toBeFocused();
  await role.selectOption({ label: "Treasurer" });
  await question.getByRole("button", { name: "Yes" }).click();
  await expect(
    page.getByText(
      "When you save, this person becomes Treasurer and Maryam Siddiqui moves to the General board.",
    ),
  ).toBeFocused();
  await submit(page, "Save changes");
  await expect(savedToast(page)).toContainText(
    "Saved. The person who held that role is now in the General board.",
  );
  // Listed by role: the new Treasurer before the Secretary; no handles.
  const board = page.getByRole("region", { name: "Executive board" });
  const shown = board.getByRole("heading", { level: 3 });
  await expect(shown.filter({ hasText: name })).toBeVisible();
  const order = await shown.allTextContents();
  expect(order).toEqual([
    "Omar Haddad",
    "Bilal Ahmed",
    "Aisha Rahman",
    name,
    "Hamza Ali",
  ]);
  await expect(board.locator("[data-drag-handle]")).toHaveCount(0);
  await expect(board.getByText("On public page").last()).toBeVisible();
  // The former Treasurer is last in the General board, not deleted.
  await expect(
    page
      .getByRole("region", { name: "General board" })
      .getByRole("listitem")
      .last(),
  ).toContainText("Maryam Siddiqui");

  // Moved with the Group box: they go to the end of the General board.
  await board.getByRole("link", { name: `Edit ${name}` }).click();
  // The earlier Add a person page may stay in the document, hidden.
  await page
    .getByRole("combobox", { name: /^Group/ })
    .filter({ visible: true })
    .selectOption({ label: "General board" });
  await expect(
    page.getByLabel("Role title (optional)").filter({ visible: true }),
  ).toHaveValue("Treasurer");
  // Off the public page again, so the About page keeps only the seed team.
  await page
    .getByLabel("Show on public page")
    .filter({ visible: true })
    .uncheck();
  await submit(page, "Save changes");
  await expect(savedToast(page)).toContainText("Saved");
  const general = page.getByRole("region", { name: "General board" });
  await expect(general.getByRole("listitem").last()).toContainText(name);
  // The role is free again: Maryam takes it back with no question, so the
  // About page keeps the seed team.
  await general.getByRole("link", { name: "Edit Maryam Siddiqui" }).click();
  await page
    .getByRole("combobox", { name: /^Group/ })
    .filter({ visible: true })
    .selectOption({ label: "Executive board" });
  await page
    .getByRole("combobox", { name: /^Role/ })
    .filter({ visible: true })
    .selectOption({ label: "Treasurer" });
  await expect(page.locator(".role-question")).toHaveCount(0);
  await submit(page, "Save changes");
  await expect(savedToast(page)).toContainText("Saved");

  await page.getByRole("link", { name: "Edit groups" }).click();
  await expectAccessible(page);
  // The Executive board and the General board are always kept.
  for (const kept of ["Executive board", "General board"]) {
    const card = page.getByRole("region", { name: kept });
    await expect(card.getByLabel("Group name")).toHaveCount(0);
    await expect(card.getByText("Archive this group")).toHaveCount(0);
    await expect(card.getByText(/always kept/)).toBeVisible();
  }
  const newGroup = `Sandbox group ${Date.now()}`;
  const add = page.getByRole("region", { name: "Add a group" });
  await add.getByLabel("Group name").fill(newGroup);
  await submit(page, "Add group");
  await expect(savedToast(page)).toContainText("Saved");
  const added = page.getByRole("region", { name: newGroup });
  await added.getByText("Archive this group").click();
  await submit(page, `Archive group ${newGroup}`);
  await expect(page.getByRole("status")).toContainText("Group archived");
  await expect(page.getByRole("region", { name: newGroup })).toHaveCount(0);
  await expectAccessible(page);
  // D-22: an archived group comes back with Restore.
  const archivedGroups = page.getByRole("region", { name: "Archived groups" });
  await archivedGroups
    .getByRole("button", { name: `Restore ${newGroup}` })
    .click();
  await expect(page.getByRole("status")).toContainText("Group restored");
  await expect(page.getByRole("region", { name: newGroup })).toBeVisible();
  // Archived again and empty: deleted for good after typing DELETE.
  await page
    .getByRole("region", { name: newGroup })
    .getByText("Archive this group")
    .click();
  await submit(page, `Archive group ${newGroup}`);
  await expect(page.getByRole("status")).toContainText("Group archived");
  await archivedGroups.getByText(`Delete permanently ${newGroup}`).click();
  await archivedGroups.getByLabel("Type DELETE to confirm").fill("DELETE");
  await submit(page, `Delete group ${newGroup}`);
  await expect(page.getByRole("status")).toContainText(
    "Group permanently deleted.",
  );
  await expect(page.getByText(newGroup)).toHaveCount(0);
});

test("sandbox: People, groups and tickets are put in order by dragging or with the arrow keys on the handle, then Save order", async ({
  page,
}) => {
  test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");
  // Tall enough that the whole General board list is on screen for the drag.
  await page.setViewportSize({ width: 1280, height: 1600 });
  await signInToSandbox(page);
  await page.goto("/admin/people");
  // The Executive board is listed by role, with nothing to drag (review 2).
  const executive = page.getByRole("region", { name: "Executive board" });
  await expect(executive.locator("[data-drag-handle]")).toHaveCount(0);
  // No "Listed by role" line any more (#99): the order follows the roles.
  await expect(executive.getByText(/President first/)).toHaveCount(0);
  const general = page.getByRole("region", { name: "General board" });
  const names = general.locator("[data-sortable-item] h3");
  await expect(names.first()).toBeVisible();
  const before = await names.allTextContents();
  expect(before.length).toBeGreaterThan(2);
  // No typed order numbers and no arrow buttons anywhere on the list.
  await expect(page.getByText(/Order number/)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^Move (up|down)/ }),
  ).toHaveCount(0);

  // Mouse: drag the last person by the handle to the top.
  const handles = general.locator("[data-drag-handle]");
  await general.scrollIntoViewIfNeeded();
  const from = (await handles.last().boundingBox())!;
  const to = (await handles.first().boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  for (let step = 1; step <= 20; step += 1)
    await page.mouse.move(
      from.x + from.width / 2,
      from.y + ((to.y - from.y) * step) / 20,
    );
  await page.mouse.up();
  const dragged = [before.at(-1)!, ...before.slice(0, -1)];
  await expect(names).toHaveText(dragged);
  await expect(
    general.getByText("The order changed. Save it to keep it."),
  ).toBeVisible();
  await expectAccessible(page);

  // Undo puts the saved order back; on the focused handle the arrow keys
  // move one place at a time, and the focus stays on it.
  await general.getByRole("button", { name: "Undo" }).click();
  await expect(names).toHaveText(before);
  const handle = general.getByRole("button", { name: `Move ${before[0]}` });
  await handle.focus();
  await page.keyboard.press("ArrowDown");
  await expect(handle).toBeFocused();
  await page.keyboard.press("ArrowDown");
  const moved = [before[1], before[2], before[0], ...before.slice(3)];
  await expect(names).toHaveText(moved);
  await expect(page.getByText(`${before[0]} is now 3 of`)).toBeAttached();
  await submit(page, "Save order");
  await expect(savedToast(page)).toContainText("Order saved.");
  await page.reload();
  await expect(names).toHaveText(moved);

  // Back to how it was, so other tests see the seed order.
  await handle.focus();
  await page.keyboard.press("Home");
  await expect(names).toHaveText(before);
  await submit(page, "Save order");
  await expect(savedToast(page)).toContainText("Order saved.");

  // Groups: the same list, as cards.
  await page.goto("/admin/people/groups");
  await expect(page.getByLabel("Order number")).toHaveCount(0);
  const groups = page.locator("[data-sortable-item] h2");
  await expect(groups.first()).toBeVisible();
  const groupNames = await groups.allTextContents();
  await page.getByRole("button", { name: `Move ${groupNames[0]}` }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(groups.first()).toHaveText(groupNames[1]);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(groups).toHaveText(groupNames);
  await expectAccessible(page);

  // Tickets: the arrow keys, then Save order; no Order number box when editing.
  await page.goto("/admin/payments/tickets");
  const tickets = page.locator("[data-sortable-item] h3");
  await expect(
    page.getByRole("heading", { name: "Tickets", level: 1 }),
  ).toBeVisible();
  const ticketNames = await tickets.allTextContents();
  if (ticketNames.length > 1) {
    const ticketHandle = page.getByRole("button", {
      name: `Move ${ticketNames[0]}`,
    });
    await ticketHandle.focus();
    await page.keyboard.press("ArrowDown");
    await submit(page, "Save order");
    await expect(savedToast(page)).toContainText("Order saved.");
    await ticketHandle.focus();
    await page.keyboard.press("ArrowUp");
    await submit(page, "Save order");
    await expect(tickets).toHaveText(ticketNames);
  }
  await page.goto("/admin/payments/tickets/new");
  await expect(page.getByLabel("Order number")).toHaveCount(0);
});

test("sandbox: invite, resend, deactivate and reactivate a login; own access is protected", async ({
  page,
}) => {
  test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");
  await page.setViewportSize({ width: 390, height: 844 });
  await signInToSandbox(page);

  // A new entry keeps the test repeatable against one running sandbox. In
  // the Executive board: only its people may hold "manage money"
  // (2026-10-06).
  const name = `Sandbox invitee ${Date.now()}`;
  await page.goto("/admin/people/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page
    .getByRole("combobox", { name: /^Group/ })
    .selectOption({ label: "Executive board" });
  await page
    .getByRole("combobox", { name: "Role", exact: true })
    .selectOption("Secretary");
  // One person per role (2026-10-06): the Secretary moves to the General
  // board; they get the role back at the end.
  await page
    .locator(".role-question")
    .getByRole("button", { name: "Yes" })
    .click();
  await submit(page, "Save changes");
  await expect(savedToast(page)).toContainText("Saved");
  await page.getByRole("link", { name: `Edit ${name}` }).click();

  const login = page.getByRole("region", { name: "Dashboard login" });
  await expect(login).toContainText("has no login");
  await expectAccessible(page);
  await login
    .getByLabel("Email for the invite")
    .fill(`invitee-${Date.now()}@sgu-msa.invalid`);
  await login.getByLabel("Manage money").check();
  await submit(page, "Send invite");
  // Review fixes PR-1: the sandbox sends nothing but answers like the live site.
  await expect(login.getByRole("status")).toHaveText(
    /^Invite email sent( again)? to .+@sgu-msa\.invalid\. The link works once and expires in 24 hours\.$/,
  );
  await expect(login.getByText("Invited", { exact: true })).toBeVisible();
  await expect(login.getByLabel("Manage money")).toBeChecked();
  await expect(login.getByLabel("Manage people")).not.toBeChecked();
  await expectAccessible(page);

  await submit(page, "Send the invite again");
  // Review fixes PR-1: the sandbox sends nothing but answers like the live site.
  await expect(login.getByRole("status")).toHaveText(
    /^Invite email sent( again)? to .+@sgu-msa\.invalid\. The link works once and expires in 24 hours\.$/,
  );

  // Change email (review fixes P4): invited only, so the invite goes again
  // to the new address; the same address is refused in plain words.
  const moved = `moved-${Date.now()}@sgu-msa.invalid`;
  await login.locator("summary", { hasText: "Change email" }).click();
  await login.getByLabel("New email").fill(moved);
  await submit(page, "Change email");
  await expect(login.getByRole("status")).toHaveText(
    `Invite email sent to ${moved}. The link works once and expires in 24 hours.`,
  );
  await expect(login).toContainText(`Invited (${moved})`);
  await login.locator("summary", { hasText: "Change email" }).click();
  await login.getByLabel("New email").fill(moved);
  await submit(page, "Change email");
  await expect(login.getByRole("alert")).toHaveText(
    "This is already their email. Type the new one.",
  );

  await login.locator("summary", { hasText: "Deactivate login" }).click();
  await submit(page, "Deactivate login");
  await expect(login.getByRole("status")).toContainText("Login deactivated.");
  await expect(
    login.getByText("Login deactivated", { exact: true }),
  ).toBeVisible();
  await submit(page, "Reactivate login");
  await expect(login.getByRole("status")).toContainText("Login reactivated.");
  await expect(login.getByText("Invited", { exact: true })).toBeVisible();

  await page.goto("/admin/people");
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: name })
      .getByText("Invited", { exact: true }),
  ).toBeVisible();

  // Your own "manage people" and access cannot be removed (admins_guard).
  await page.getByRole("link", { name: "Edit Omar Haddad" }).click();
  const own = page.getByRole("region", { name: "Dashboard login" });
  await expect(own.getByLabel("Manage people")).toBeDisabled();
  await expect(own.getByLabel("Manage people")).toBeChecked();
  await own.locator("summary", { hasText: "Deactivate login" }).click();
  const deactivate = own.getByRole("button", { name: "Deactivate login" });
  await expect(deactivate).toBeDisabled();
  await expect(
    own.getByText("You cannot remove your own access").first(),
  ).toBeVisible();
  // The server refuses it too, not only the disabled button.
  await deactivate.evaluate((button) => button.removeAttribute("disabled"));
  await submit(page, "Deactivate login");
  await expect(own.getByRole("alert")).toHaveText(
    "You cannot remove your own access or your own 'manage people' permission. Ask another manager.",
  );

  // Hamza Ali takes the Secretary role back, so the About page keeps the
  // seed team.
  await page.goto("/admin/people");
  await page.getByRole("link", { name: "Edit Hamza Ali" }).click();
  await page
    .getByRole("combobox", { name: /^Group/ })
    .filter({ visible: true })
    .selectOption({ label: "Executive board" });
  await page
    .getByRole("combobox", { name: "Role", exact: true })
    .filter({ visible: true })
    .selectOption("Secretary");
  await page
    .locator(".role-question")
    .getByRole("button", { name: "Yes" })
    .click();
  await submit(page, "Save changes");
  await expect(savedToast(page)).toContainText("Saved");
  // The invitee, now in the General board, comes off About (review fixes P4).
  await page.getByRole("link", { name: `Edit ${name}` }).click();
  await page
    .getByLabel("Show on public page")
    .filter({ visible: true })
    .uncheck();
  await submit(page, "Save changes");
  await expect(savedToast(page)).toContainText("Saved");
  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
});

test("sandbox: forgot password, set password and an expired email link", async ({
  page,
}) => {
  test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin");
  await expect(
    page.getByText("Need access? Ask a board member who can manage people."),
  ).toBeVisible();
  await page.getByRole("link", { name: "Forgot your password?" }).click();
  await expect(page).toHaveURL(/\/admin\/forgot-password$/);
  await expectAccessible(page);
  await page
    .getByRole("textbox", { name: "Email" })
    .fill("someone@sgu-msa.invalid");
  await submit(page, "Send reset link");
  await expect(page.getByRole("status")).toHaveText(
    "If this email belongs to a board account, a reset link is on its way. Check your inbox and spam folder.",
  );

  // Opening an email link only shows Continue (D-25: mail scanners open links
  // too); the link is used when the person clicks it. The sandbox sends no
  // links, so every link counts as used or expired.
  await page.goto("/admin/auth/confirm?token_hash=sample&type=recovery");
  await expect(page).toHaveURL(/\/admin\/auth\/confirm\?/);
  await expectAccessible(page);
  await submit(page, "Continue");
  await expect(page).toHaveURL(/\/admin\?link=expired$/);
  await expect(page.locator("p[role=alert]")).toHaveText(
    "This link has expired or was already used. Ask for a new invite or use Forgot password.",
  );
  // A broken link (a type other than invite or recovery) never shows Continue.
  await page.goto("/admin/auth/confirm?token_hash=sample&type=signup");
  await expect(page).toHaveURL(/\/admin\?link=expired$/);

  await signInToSandbox(page);
  await page.goto("/admin/set-password");
  await expectAccessible(page);
  const hint =
    "At least 12 characters, including a lower-case letter, a capital letter, a number and a symbol.";
  await expect(page.getByText(hint)).toBeVisible();
  // Skip the browser's length check to reach the server's D-16 check.
  await page.locator("form.editor-form").evaluate((form) => {
    (form as HTMLFormElement).noValidate = true;
  });
  await page.getByLabel("New password", { exact: true }).fill("alllowercase");
  await page.getByLabel("Type the new password again").fill("alllowercase");
  await submit(page, "Save password");
  await expect(page.locator("p[role=alert]")).toHaveText(hint);
  await page
    .getByLabel("New password", { exact: true })
    .fill("Sandbox-pass-2026");
  await page
    .getByLabel("Type the new password again")
    .fill("Sandbox-pass-2027");
  await submit(page, "Save password");
  await expect(page.locator("p[role=alert]")).toContainText("are different");
  // A refused form is cleared: passwords are never sent back to the browser.
  await expect(page.getByLabel("New password", { exact: true })).toHaveValue(
    "",
  );
  await page
    .getByLabel("New password", { exact: true })
    .fill("Sandbox-pass-2026");
  await page
    .getByLabel("Type the new password again")
    .fill("Sandbox-pass-2026");
  await submit(page, "Save password");
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await expect(savedToast(page)).toContainText("Your password is saved.");
});

test("sandbox: Recent changes shows who changed what; prayer changes are highlighted", async ({
  page,
}) => {
  test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");
  await page.setViewportSize({ width: 390, height: 844 });
  await signInToSandbox(page);

  // Rename an event and put the title back, so the test can run again.
  const original = "An evening of reflection";
  const renamed = `${original} ${Date.now()}`;
  await page.goto("/admin/content/events");
  await page.getByRole("link", { name: `Edit ${original}` }).click();
  const title = page.getByLabel("Event name", { exact: true });
  await title.fill(renamed);
  await submit(page, "Save");
  await expect(savedToast(page)).toContainText("Saved");

  await page.goto("/admin/dashboard");
  await page.getByRole("link", { name: /^Recent changes/ }).click();
  await expect(page).toHaveURL(/\/admin\/activity$/);
  const latest = page.locator(".activity-feed > li").first();
  await expect(latest.getByRole("heading")).toHaveText(
    `Edited event: ${renamed}`,
  );
  await expect(latest).toContainText("Omar Haddad");
  const titleChange = latest.getByRole("definition").first();
  await expect(titleChange).toContainText(original);
  await expect(titleChange).toContainText(renamed);
  await expect(titleChange).toContainText("→");
  await expectAccessible(page);

  await page.goto("/admin/content/events");
  await page.getByRole("link", { name: `Edit ${renamed}` }).click();
  await title.fill(original);
  await submit(page, "Save");
  await expect(savedToast(page)).toContainText("Saved");

  // A prayer change is highlighted in the feed and in the notifications.
  const notice = `Schedule note ${Date.now()}`;
  await page.goto("/admin/prayer-times");
  await page.getByLabel("Note for visitors (optional)").fill(notice);
  await submit(page, "Save prayer settings");
  await expect(savedToast(page)).toContainText("Saved");
  await page.goto("/admin/dashboard");
  const panel = await openNotifications(page);
  const highlight = panel
    .getByRole("listitem")
    .filter({ hasText: "Prayer settings changed recently" });
  await expect(highlight).toContainText(
    "Omar Haddad changed the prayer settings",
  );
  await expectAccessible(page);
  // Escape closes the panel and puts focus back on the bell.
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(
    page.getByRole("button", { name: /^Notifications/ }),
  ).toBeFocused();
  await (
    await openNotifications(page)
  )
    .getByRole("link", { name: /See what changed in Recent changes/ })
    .click();
  const prayer = page.locator(".activity-feed > li").first();
  await expect(prayer).toHaveClass(/activity-highlight/);
  await expect(prayer).toContainText("Prayer change");
  await expect(prayer).toContainText(notice);
});

test("sandbox: archive, restore, create from and permanently delete content", async ({
  page,
}) => {
  test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");
  await page.setViewportSize({ width: 390, height: 844 });
  await signInToSandbox(page);

  // A new published event keeps the test repeatable against one sandbox.
  const title = `Archive test ${Date.now()}`;
  await page.goto("/admin/content/events/new");
  await page.getByLabel("Event name", { exact: true }).fill(title);
  await fillTime(page, "Start time (optional)", "17:00");
  await page.getByLabel("Place").fill("Charter Hall");
  await page.getByRole("radio", { name: "Everyone on the website" }).check();
  await submit(page, "Save");
  await expect(savedToast(page)).toContainText("Saved");
  const edit = page.getByRole("link", { name: `Edit ${title}` });
  const href = (await edit.getAttribute("href"))!;
  const publicPage = `/calendar/${href.split("/").at(-1)}`;
  await page.goto(publicPage);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  // Archive replaces delete: the event leaves the website (ADR 0013).
  await page.goto(href);
  await expect(page.getByText("Delete this item")).toHaveCount(0);
  await page.locator("summary", { hasText: "Archive this item" }).click();
  await submit(page, "Archive");
  await expect(page).toHaveURL(/\/admin\/content\/events\?archived=1$/);
  await expect(page.getByRole("status")).toContainText("Archived.");
  await expect(page.getByRole("link", { name: `Edit ${title}` })).toHaveCount(
    0,
  );
  await page.goto(publicPage);
  await expect(page.getByRole("heading", { name: title })).toHaveCount(0);
  await page.goto("/calendar");
  await expect(page.getByText(title)).toHaveCount(0);

  // Archived: read-only, Restore brings it back as a draft (D-13).
  await page.goto("/admin/content/events");
  await page.getByRole("link", { name: "Archived", exact: true }).click();
  await expect(page).toHaveURL(/view=archived$/);
  await expectAccessible(page);
  await page.getByRole("link", { name: `View ${title}` }).click();
  await expect(page).toHaveURL(/\/admin\/content\/events\/[0-9a-f-]{36}$/);
  await expect(page.getByLabel("Event name", { exact: true })).toHaveCount(0);
  await expectAccessible(page);
  await submit(page, "Restore");
  await expect(page.getByRole("status")).toContainText(
    "Restored as an unpublished draft",
  );
  await expect(
    page.getByRole("listitem").filter({ hasText: title }),
  ).toContainText("Draft");
  await page.goto(publicPage);
  await expect(page.getByRole("heading", { name: title })).toHaveCount(0);

  // Create from this announcement (review fixes P3; was Duplicate): a new,
  // unsaved draft with the same words and no date.
  const original = `Create-from test ${Date.now()}`;
  await page.goto("/admin/content/announcements/new");
  await page.getByLabel("Headline", { exact: true }).fill(original);
  await page.getByRole("radio", { name: "Everyone on the website" }).check();
  await submit(page, "Save");
  await expect(savedToast(page)).toContainText("Saved");
  await page.getByRole("link", { name: `Edit ${original}` }).click();
  await page
    .getByRole("link", { name: "Create from this announcement" })
    .click();
  await expect(page).toHaveURL(/\/new\?from=/);
  await expect(page.getByRole("status")).toContainText(
    `Started from “${original}”. Choose the date.`,
  );
  await expect(page.getByLabel("Headline", { exact: true })).toHaveValue(
    original,
  );
  await expect(
    page.getByRole("radio", { name: "Only the board (draft)" }),
  ).toBeChecked();
  await expectAccessible(page);
  const notice = `${original} (new)`;
  await page.getByLabel("Headline", { exact: true }).fill(notice);
  await page
    .getByLabel("Show from")
    .fill(
      new Intl.DateTimeFormat("en-CA", { timeZone: "America/Grenada" }).format(
        new Date(),
      ),
    );
  await submit(page, "Save");
  await expect(savedToast(page)).toContainText("Saved");
  await page.getByRole("link", { name: `Edit ${notice}` }).click();

  // Permanent delete: only from Archived, and only after typing DELETE.
  // Pages visited just before stay in the document, hidden (Cache
  // Components keep them for going back): only the shown copy counts.
  await page
    .locator("summary:visible", { hasText: "Archive this item" })
    .click();
  await submit(page, "Archive");
  await page.getByRole("link", { name: "Archived", exact: true }).click();
  await page.getByRole("link", { name: `View ${notice}` }).click();
  await expect(page).toHaveURL(/\/admin\/content\/\w+\/[\w-]+$/);
  await page
    .locator("summary:visible", { hasText: "Delete permanently" })
    .click();
  const purge = page.locator("form:visible", {
    has: page.getByLabel("Type DELETE to confirm"),
  });
  // Skip the browser's check to reach the server's.
  await purge.evaluate((form) => {
    (form as HTMLFormElement).noValidate = true;
  });
  await purge.getByLabel("Type DELETE to confirm").fill("delete");
  await submit(page, "Delete permanently");
  await expect(purge.getByRole("alert")).toHaveText("Type DELETE to confirm.");
  await purge.getByLabel("Type DELETE to confirm").fill("DELETE");
  await submit(page, "Delete permanently");
  await expect(page).toHaveURL(/view=archived&deleted=1$/);
  await expect(page.getByRole("status")).toHaveText("Permanently deleted.");
  await expect(page.getByText(notice).filter({ visible: true })).toHaveCount(0);
});

test("sandbox: archive and restore a person; an archived login stays off; permanent delete removes the login", async ({
  page,
}) => {
  test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");
  await page.setViewportSize({ width: 390, height: 844 });
  await signInToSandbox(page);

  // A new entry with a photo and a login keeps the test repeatable. Photos
  // are for the Executive board only (review fixes P4): the new person takes
  // the Secretary role, and Hamza Ali gets it back at the end.
  const name = `Sandbox archive ${Date.now()}`;
  await page.goto("/admin/people/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page
    .getByRole("combobox", { name: /^Group/ })
    .selectOption({ label: "Executive board" });
  await page
    .getByRole("combobox", { name: "Role", exact: true })
    .selectOption("Secretary");
  await page
    .locator(".role-question")
    .getByRole("button", { name: "Yes" })
    .click();
  const png = await sharp({
    create: { width: 64, height: 64, channels: 3, background: "#806020" },
  })
    .png()
    .toBuffer();
  await page
    .locator('input[name="image"]')
    .setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: png });
  await submit(page, "Save changes");
  await expect(savedToast(page)).toContainText("Saved");
  await page.getByRole("link", { name: `Edit ${name}` }).click();
  await expect(page).toHaveURL(/\/admin\/people\/[0-9a-f-]{36}$/);
  const person = page.url();
  const login = page.getByRole("region", { name: "Dashboard login" });
  await login
    .getByLabel("Email for the invite")
    .fill(`archive-${Date.now()}@sgu-msa.invalid`);
  await submit(page, "Send invite");
  // Review fixes PR-1: the sandbox sends nothing but answers like the live site.
  await expect(login.getByRole("status")).toHaveText(
    /^Invite email sent( again)? to .+@sgu-msa\.invalid\. The link works once and expires in 24 hours\.$/,
  );

  // Archiving also turns the login off (D-12).
  await page.locator("summary", { hasText: "No longer on the team?" }).click();
  await submit(page, "No longer on the team");
  await expect(page).toHaveURL(/\/admin\/people\?archived=1$/);
  await expect(page.getByRole("status")).toContainText(
    "Marked as no longer on the team.",
  );
  await expect(page.getByRole("heading", { name })).toHaveCount(0);
  await page.getByRole("link", { name: "Archived", exact: true }).click();
  await expectAccessible(page);
  await page.getByRole("link", { name: `View ${name}` }).click();
  await expect(page).toHaveURL(person);
  // The person's earlier edit page may stay in the document, hidden.
  await expect(
    page.getByLabel("Name", { exact: true }).filter({ visible: true }),
  ).toHaveCount(0);
  await expectAccessible(page);

  // D-19: an archived person's login cannot be turned on.
  const archivedLogin = page.getByRole("region", { name: "Dashboard login" });
  await expect(
    archivedLogin.getByText("Login deactivated", { exact: true }),
  ).toBeVisible();
  await expect(
    archivedLogin.getByText("Restore this person first.", { exact: true }),
  ).toBeVisible();
  const reactivate = archivedLogin.getByRole("button", {
    name: "Reactivate login",
  });
  await expect(reactivate).toBeDisabled();
  // The server refuses it too, not only the disabled button.
  await reactivate.evaluate((button) => button.removeAttribute("disabled"));
  await submit(page, "Reactivate login");
  await expect(archivedLogin.getByRole("alert")).toHaveText(
    "Restore this person first.",
  );

  // D-26: the photo is removed without restoring first.
  await submit(page, "Remove photo");
  await expect(page.getByRole("status")).toHaveText("Photo removed.");
  await expect(page.getByRole("definition").nth(3)).toHaveText("No");

  // Restore: the entry comes back, the login stays off.
  await submit(page, "Restore");
  await expect(page.getByRole("status")).toContainText(
    "Restored. Their login stays off",
  );
  await expect(
    page.getByLabel("Name", { exact: true }).filter({ visible: true }),
  ).toHaveValue(name);
  await expect(
    page
      .getByRole("region", { name: "Dashboard login" })
      .getByText("Login deactivated", { exact: true }),
  ).toBeVisible();

  // Permanent delete also deletes the login account (D-21). That the account
  // is really gone (its email free for a new invite) is proven by the
  // conformance test "a permanently deleted person's account is deleted too"
  // in tests/people.test.ts, which runs against the sample adapters.
  await page.locator("summary", { hasText: "No longer on the team?" }).click();
  await submit(page, "No longer on the team");
  await page.goto(person);
  await page.locator("summary", { hasText: "Delete permanently" }).click();
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await submit(page, "Delete permanently");
  await expect(page).toHaveURL(/view=archived&deleted=1&login=deleted$/);
  await expect(page.getByRole("status")).toHaveText(
    "Permanently deleted, together with their login account.",
  );
  await expect(page.getByText(name).filter({ visible: true })).toHaveCount(0);
  await page.goto(person);
  await expect(page.getByText(name)).toHaveCount(0);

  // Hamza Ali takes the Secretary role back, so the About page keeps the
  // seed team.
  await page.goto("/admin/people");
  await page.getByRole("link", { name: "Edit Hamza Ali" }).click();
  await page
    .getByRole("combobox", { name: /^Group/ })
    .filter({ visible: true })
    .selectOption({ label: "Executive board" });
  await page
    .getByRole("combobox", { name: "Role", exact: true })
    .filter({ visible: true })
    .selectOption("Secretary");
  await submit(page, "Save changes");
  await expect(savedToast(page)).toContainText("Saved");
});

/** Minutes since midnight of a public time such as "5:12 AM" (D-8). */
function minutesOf(shown: string) {
  const [, hour, minute, half] = shown.match(/^(\d+):(\d\d)\s(AM|PM)$/)!;
  return (Number(hour) % 12) * 60 + Number(minute) + (half === "PM" ? 720 : 0);
}

test("sandbox: the Prayer & iqamah screen sets iqamah after the adhan with a live preview, two Jumu'ah prayers and a Friday change (PR4 WP-4; review fixes P2)", async ({
  page,
}) => {
  test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");
  test.setTimeout(120_000);
  // Two weekly Jumu'ah prayers show on /prayer and Home (review fixes P2).
  await page.goto("/prayer");
  const weekly = page.locator("#jumuah");
  await expect(weekly).toContainText("First prayer");
  await expect(weekly).toContainText("Second prayer");
  await page.goto("/");
  await expect(
    page.getByText(/khutbah 12:45\sPM, iqamah 1:00\sPM; khutbah 1:45\sPM/),
  ).toBeVisible();

  await signInToSandbox(page);
  await page.goto("/admin/prayer-times");

  // One page, three sections, one Save; no calculation controls and no
  // Hijri date (criterion 1; review fixes P2).
  for (const legend of [
    "1. Daily iqamah",
    "2. Jumu’ah (every Friday)",
    "3. Changes for one date",
  ])
    await expect(page.getByRole("group", { name: legend })).toBeVisible();
  await expect(page.getByRole("group", { name: /Hijri date/ })).toHaveCount(0);
  await expect(
    page.getByText(
      /worked out automatically for the Musallah: Muslim World League · Standard Asr/,
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save prayer settings" }),
  ).toHaveCount(1);
  await expect(
    page.getByText(
      /Calculation method|Asr convention|Leadership has confirmed/,
    ),
  ).toHaveCount(0);
  await expectAccessible(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await expectAccessible(page);
  // Light and dark on every changed screen (Test Strategy). Reload so the
  // scan never catches the colours mid-transition.
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expectAccessible(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await expectAccessible(page);
  await page.emulateMedia({ colorScheme: "light" });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  // The sandbox's schedule starts on its own today.
  const today = await page.getByLabel("Times start on").inputValue();
  const fridayDate = comingFriday(today);

  // Save with boxes to fix shows each problem on its box and keeps every
  // typed value (criterion 5; review 2).
  const fajrFixed = await timeValue(page, "Fajr iqamah time").inputValue();
  await page.getByLabel("Times end on").fill("");
  await page.getByRole("button", { name: "+ Add a date" }).click();
  const change = page.getByRole("group", { name: "Change 1" });
  await change.getByLabel("Date", { exact: true }).fill(fridayDate);
  await change.getByLabel("No Jumu’ah this week").check();
  // A new Friday change asks for an urgent notice (PR5a D-3): not this time.
  await change.getByRole("radio", { name: "No", exact: true }).check();
  await page.getByRole("button", { name: "Save prayer settings" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Some boxes need fixing." }),
  ).toBeVisible();
  await expect(page.getByLabel("Times end on")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByLabel("Times end on")).toBeFocused();
  await expect(
    page.getByText(
      "Fixed times need both dates, and the end cannot be before the start.",
    ),
  ).toBeVisible();
  await expect(
    change.getByLabel(/^Reason \(shown to visitors\)/),
  ).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Times end on")).toHaveValue("");
  await expect(timeValue(page, "Fajr iqamah time")).toHaveValue(fajrFixed);
  await expect(change.getByLabel("Date", { exact: true })).toHaveValue(
    fridayDate,
  );
  await expect(change.getByLabel("No Jumu’ah this week")).toBeChecked();

  // Fix both and switch Fajr to 20 minutes after the adhan: the row shows
  // the adhan and the iqamah it gives today as you type (review fixes P2).
  await page.getByLabel("Times end on").fill(today);
  await change.getByLabel("Reason (shown to visitors)").fill("Mid-term break");
  const fajrSwitch = page.getByRole("group", {
    name: "How is Fajr iqamah set?",
  });
  const fajrPreview = page
    .getByRole("row", { name: /^Fajr/ })
    .locator(".iqamah-preview");
  await expect(fajrPreview).toContainText(/^Adhan \d+:\d\d\sAM/);
  await fajrSwitch.getByText("After adhan").click();
  await page.getByLabel("Fajr iqamah, minutes after adhan").fill("20");
  const previewed = (await fajrPreview.innerText()).replace(/\s+/g, " ");
  const [, adhanShown, iqamahShown] = previewed.match(
    /Adhan (\d+:\d\d [AP]M) .*Iqamah (\d+:\d\d [AP]M) today/,
  )!;
  expect(minutesOf(iqamahShown)).toBe(minutesOf(adhanShown) + 20);
  // Switching keeps what was typed in each kind.
  await fajrSwitch.getByText("Fixed time").click();
  await expect(timeValue(page, "Fajr iqamah time")).toHaveValue(fajrFixed);
  await fajrSwitch.getByText("After adhan").click();
  await expect(page.getByLabel("Fajr iqamah, minutes after adhan")).toHaveValue(
    "20",
  );
  await submit(page, "Save prayer settings");
  await expect(savedToast(page)).toContainText("Saved");
  await expect(page.getByLabel("Fajr iqamah, minutes after adhan")).toHaveValue(
    "20",
  );

  // /prayer: Fajr iqamah is 20 minutes after the calculated start (criterion 2).
  await page.goto("/prayer");
  const fajrRow = page.getByRole("row", { name: /^Fajr/ });
  // The times stream in after the page's frame (review fixes PR-C).
  await expect(fajrRow).toBeVisible();
  const [begins, iqamah] = await fajrRow.locator("td").allTextContents();
  expect(minutesOf(iqamah.replace(/\s/g, " "))).toBe(
    minutesOf(begins.replace(/\s/g, " ")) + 20,
  );
  // The dashboard's preview gave the same time.
  expect(minutesOf(iqamah.replace(/\s/g, " "))).toBe(minutesOf(iqamahShown));
  // The cancelled Friday shows on the Jumu'ah card with its reason (criterion 3).
  const card = page.locator("#jumuah");
  await expect(card).toContainText("No Jumu’ah this Friday");
  await expect(card).toContainText("Mid-term break");
  await page.goto("/");
  await expect(page.getByText(/No Jumu’ah this Friday/).first()).toBeVisible();

  // Put everything back so the test can run again.
  await page.goto("/admin/prayer-times");
  await page
    .getByRole("group", { name: "How is Fajr iqamah set?" })
    .getByText("Fixed time")
    .click();
  await fillTime(page, "Fajr iqamah time", fajrFixed);
  await page
    .getByRole("group", { name: "Change 1" })
    .getByRole("button", { name: "Remove this date" })
    .click();
  await submit(page, "Save prayer settings");
  await expect(savedToast(page)).toContainText("Saved");
  await expect(page.getByRole("group", { name: "Change 1" })).toHaveCount(0);
  await expect(timeValue(page, "Fajr iqamah time")).toHaveValue(fajrFixed);
});

test("sandbox: the notifications bell follows Times end on (daily check WP-6; review fixes P1, item 5)", async ({
  page,
}) => {
  test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await signInToSandbox(page);
  const addDays = (date: string, days: number) =>
    new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000)
      .toISOString()
      .slice(0, 10);
  const setDates = async (start: string, end: string) => {
    await page.goto("/admin/prayer-times");
    await page.getByLabel("Times start on").fill(start);
    await page.getByLabel("Times end on").fill(end);
    await submit(page, "Save prayer settings");
    await expect(savedToast(page)).toContainText("Saved");
    await page.goto("/admin/dashboard");
    await openNotifications(page);
  };
  const box = page.getByRole("region", { name: "Notifications" });
  const iqamah = box.getByText(/^Iqamah times/);

  // The sandbox's iqamah times end today: one item, the same line the email
  // uses. Its fund that ended 3 days ago is listed too (stage 2, WP-8).
  await page.goto("/admin/prayer-times");
  const start = await page.getByLabel("Times start on").inputValue();
  const end = await page.getByLabel("Times end on").inputValue();
  await page.goto("/admin/dashboard");
  await openNotifications(page);
  await expect(iqamah).toHaveText(
    /^Iqamah times end on \w{3} \d{1,2} \w{3} \(today\)$/,
  );
  await expect(
    box.getByText(
      /^“Flood relief” ended on \w{3} \d{1,2} \w{3}: close its Go2Pay page$/,
    ),
  ).toBeVisible();
  // A problem cannot be closed: only an information line has ×.
  await expect(
    box
      .getByRole("listitem")
      .filter({ hasText: "Iqamah times" })
      .getByRole("button"),
  ).toHaveCount(0);
  await expect(
    box.getByRole("link", { name: "Open the fund →" }),
  ).toBeVisible();
  await expectAccessible(page);
  await box.getByRole("link", { name: "Open Prayer & iqamah →" }).click();
  await expect(page).toHaveURL(/\/admin\/prayer-times$/);

  try {
    // Ten days later: the iqamah times need nothing, so no iqamah line.
    await setDates(start, addDays(end, 10));
    await expect(
      page.getByRole("heading", { name: "Your community website" }),
    ).toBeVisible();
    await expect(iqamah).toHaveCount(0);

    // An end date that has passed: the line stays until the date is moved (D-3).
    await setDates(addDays(end, -10), addDays(end, -1));
    await expect(iqamah).toHaveText(
      /^Iqamah times ended on \w{3} \d{1,2} \w{3} — update them$/,
    );
    await expectAccessible(page);
  } finally {
    await setDates(start, end);
  }
  await expect(iqamah).toBeVisible();
});

test("sandbox: restore an earlier prayer schedule from History", async ({
  page,
}) => {
  test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");
  await page.setViewportSize({ width: 390, height: 844 });
  await signInToSandbox(page);

  await page.goto("/admin/prayer-times");
  const earlier = await timeValue(page, "Fajr iqamah time").inputValue();
  const changed = earlier === "05:12" ? "05:14" : "05:12";
  await fillTime(page, "Fajr iqamah time", changed);
  await submit(page, "Save prayer settings");
  await expect(savedToast(page)).toContainText("Saved");
  // Stored as 24-hour times; read as "5:12 AM" everywhere (D-8, review fixes P1).
  const shown = (time: string) => formatTimeOfDay(time).replace(/\s/g, " ");
  await page.goto("/prayer");
  await expect(page.getByText(shown(changed), { exact: true })).toBeVisible();

  await page.goto("/admin/prayer-times");
  const history = page.getByRole("region", { name: "History" });
  const newest = history.getByRole("listitem").first();
  const fajrChange = newest.getByRole("definition").first();
  await expect(fajrChange).toContainText(`${shown(earlier)} →`);
  await expect(fajrChange).toContainText(shown(changed));
  await expectAccessible(page);
  await newest
    .getByRole("button", { name: /^Restore the version before this change/ })
    .click();
  // Review 3 D: it asks first, naming what comes back, and shows it.
  const confirm = page.getByRole("dialog", { name: "Restore this version?" });
  await expect(
    confirm.getByText(
      /^This puts “Prayer & iqamah” back to how it was on .+\. The 1 change made to it after that will be replaced\. Nothing else on the website changes\. You can undo this from History\.$/,
    ),
  ).toBeVisible();
  await expect(
    confirm.getByRole("region", { name: "This version" }),
  ).toContainText(shown(earlier));
  await expectAccessible(page);
  await confirm.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(page).toHaveURL(/restored=1$/);
  await expect(page.getByRole("status")).toContainText(
    "Earlier prayer settings restored.",
  );
  await expect(timeValue(page, "Fajr iqamah time")).toHaveValue(earlier);
  await page.goto("/prayer");
  await expect(page.getByText(shown(earlier), { exact: true })).toBeVisible();
  await expect(page.getByText(shown(changed), { exact: true })).toHaveCount(0);

  // The restore is a logged change like any other.
  await page.goto("/admin/activity");
  const latest = page.locator(".activity-feed > li").first();
  await expect(latest.getByRole("heading")).toHaveText(
    "Restored prayer settings",
  );
  await expect(latest).toContainText(/Restored to the version of .+/);
  const restoredFajr = latest.getByRole("definition").first();
  await expect(restoredFajr).toContainText(`${shown(changed)} →`);
  await expect(restoredFajr).toContainText(shown(earlier));
});

test("sandbox: About lists the Executive board in tiers, with photos; View all opens the others by name and role (review fixes P4)", async ({
  page,
}) => {
  test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");
  await page.setViewportSize({ width: 390, height: 844 });

  // Seeds: the Executive board always listed, by role; no photo, still shown;
  // no YAML roster (D-10).
  await page.goto("/about");
  const team = page.locator("#team");
  await expect(
    team.getByRole("heading", { name: "Our team", level: 2 }),
  ).toBeVisible();
  await expect(
    team.getByRole("heading", { name: "Executive board" }),
  ).toBeVisible();
  const seats = team.getByRole("listitem").filter({ visible: true });
  await expect(seats.nth(0)).toContainText("President");
  await expect(seats.nth(1)).toContainText("Vice President (Brothers)");
  await expect(team.getByText("Hamza Ali")).toBeVisible();
  await expect(team.getByText("To be confirmed", { exact: true })).toHaveCount(
    0,
  );
  // The rest of the team stays closed until "View all".
  const more = team.getByRole("button", { name: "View all" });
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await expect(
    team.getByRole("heading", { name: "General board" }),
  ).toBeHidden();
  await expectAccessible(page);

  // Keyboard: Enter opens, Space closes; focus stays on the button.
  await more.focus();
  await page.keyboard.press("Enter");
  const less = team.getByRole("button", { name: "Show less" });
  await expect(less).toHaveAttribute("aria-expanded", "true");
  await expect(less).toBeFocused();
  const general = team
    .locator("div")
    .filter({ has: page.getByRole("heading", { name: "General board" }) })
    .last();
  await expect(general.getByRole("listitem")).toHaveText([
    /Yusuf Ibrahim/,
    /Zainab Hussain/,
    /Idris Bello/,
    /Huda Karim/,
    /Sara Malik/,
  ]);
  // Names and roles only; unticked people and the Executive board not repeated.
  await expect(general.locator("img")).toHaveCount(0);
  await expect(general).toContainText("Musallah coordinator");
  await expect(team.getByText("Adam Yusuf")).toHaveCount(0);
  await expect(team.getByText("Karim Mansour")).toHaveCount(0);
  await expect(team.getByText("Aisha Rahman")).toHaveCount(1);
  await expectAccessible(page);
  await page.keyboard.press("Space");
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await expect(more).toBeFocused();

  // An Executive board member with a photo: a portrait on About.
  await signInToSandbox(page);
  const name = `Sandbox team ${Date.now()}`;
  await page.goto("/admin/people/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page
    .getByRole("combobox", { name: /^Group/ })
    .selectOption({ label: "Executive board" });
  await page
    .getByRole("combobox", { name: "Role", exact: true })
    .selectOption("Secretary");
  await page
    .locator(".role-question")
    .getByRole("button", { name: "Yes" })
    .click();
  const png = await sharp({
    create: { width: 64, height: 80, channels: 3, background: "#206080" },
  })
    .png()
    .toBuffer();
  await page
    .locator('input[name="image"]')
    .setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: png });
  await submit(page, "Save changes");
  await expect(savedToast(page)).toContainText("Saved");
  await page.getByRole("link", { name: `Edit ${name}` }).click();
  await expect(page).toHaveURL(/\/admin\/people\/[0-9a-f-]{36}$/);
  const person = page.url();

  await page.goto("/about");
  const entry = team.getByRole("listitem").filter({ hasText: name });
  await expect(entry).toContainText("Secretary");
  // The name is printed under the portrait, so the photo itself has no alt.
  const photo = entry.locator("img");
  await expect(photo).toBeVisible();
  // The first /media request can still be loading after the img is visible.
  await expect
    .poll(() =>
      photo.evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);

  // Remove photo: the person stays, the photo goes.
  await page.goto(person);
  await submit(page, "Remove photo");
  await expect(page.getByRole("status")).toHaveText("Photo removed.");
  await page.goto("/about");
  await expect(entry).toBeVisible();
  await expect(entry.locator("img")).toHaveCount(0);

  // Off the team: the person leaves the page; Hamza Ali takes the role back.
  await page.goto(person);
  await page.locator("summary", { hasText: "No longer on the team?" }).click();
  await submit(page, "No longer on the team");
  await page.getByRole("link", { name: "Edit Hamza Ali" }).click();
  await page
    .getByRole("combobox", { name: /^Group/ })
    .filter({ visible: true })
    .selectOption({ label: "Executive board" });
  await page
    .getByRole("combobox", { name: "Role", exact: true })
    .filter({ visible: true })
    .selectOption("Secretary");
  await submit(page, "Save changes");
  await expect(savedToast(page)).toContainText("Saved");
  await page.goto("/about");
  await expect(team.getByText("Hamza Ali")).toBeVisible();
  await expect(team.getByText(name)).toHaveCount(0);
});

/** The open step of a "Show me how" tour (PR4 WP-6). */
const tourStep = (page: Page) => page.getByRole("alertdialog");

/**
 * Plays a tour with Next and Done: all its steps, or the given step titles
 * when some steps' elements are not on the page (they are left out).
 */
async function playTour(
  page: Page,
  tour: TourId,
  titles = tourSteps[tour].map((step) => String(step.title)),
) {
  for (const [index, title] of titles.entries()) {
    const step = tourStep(page);
    await expect(step).toContainText(`Step ${index + 1} of ${titles.length}`);
    await expect(step.getByRole("heading", { name: title })).toBeVisible();
    await step
      .getByRole("button", {
        name: index === titles.length - 1 ? "Done" : "Next",
      })
      .click();
  }
  await expect(tourStep(page)).toHaveCount(0);
}

test.describe("a board member's first visit", () => {
  // Nothing remembered in this browser yet (playwright.config.ts marks the
  // dashboard tour as seen for every other test).
  test.use({ storageState: { cookies: [], origins: [] } });

  test("sandbox: the dashboard tour starts by itself once; Skip ends it for good; Show me how replays it (PR4 WP-6)", async ({
    page,
  }) => {
    test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");
    // Less motion: no fades, so axe sees the final colours.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await signInToSandbox(page);
    const step = tourStep(page);
    await expect(step).toContainText("Step 1 of 6");
    await expect(
      step.getByRole("heading", { name: "Your content" }),
    ).toBeVisible();
    // Axe with the step open, light and dark.
    await expectAccessible(page);
    await page.emulateMedia({ colorScheme: "dark" });
    await expectAccessible(page);
    await page.emulateMedia({ colorScheme: "light" });

    // Keyboard only: focus starts on Next; Enter moves on; Tab reaches Skip tour.
    const next = step.getByRole("button", { name: "Next" });
    await expect(next).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(step).toContainText("Step 2 of 6");
    await expect(
      step.getByRole("heading", { name: "Prayer & iqamah" }),
    ).toBeVisible();
    await expect(next).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(step.getByRole("button", { name: "Skip tour" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(step).toHaveCount(0);

    // Skipped is remembered in this browser: a reload does not restart it.
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Show me how" }),
    ).toBeVisible();
    await settled(page);
    await expect(step).toHaveCount(0);

    // Show me how replays the whole tour; Escape ends it like Skip tour.
    await page.getByRole("button", { name: "Show me how" }).click();
    await playTour(page, "dashboard");
    await page.getByRole("button", { name: "Show me how" }).click();
    await expect(step).toContainText("Step 1 of 6");
    await page.keyboard.press("Escape");
    await expect(step).toHaveCount(0);
  });
});

test("sandbox: Show me how and ?tour=1 play the Prayer, Edit item and People tours; no other tour starts by itself (PR4 WP-6)", async ({
  page,
}) => {
  test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");
  test.setTimeout(90_000);
  await signInToSandbox(page);
  const showMeHow = page.getByRole("button", { name: "Show me how" });
  // Already seen in this browser: the dashboard tour stays closed.
  await expect(showMeHow).toBeVisible();
  await settled(page);
  await expect(tourStep(page)).toHaveCount(0);

  await page.goto("/admin/prayer-times");
  await expect(showMeHow).toBeVisible();
  await settled(page);
  await expect(tourStep(page)).toHaveCount(0);
  await showMeHow.click();
  // The Jumu'ah notice question shows only under a changed Friday.
  await playTour(
    page,
    "prayer",
    tourSteps.prayer
      .filter((step) => step.title !== "Urgent notice for Jumu’ah")
      .map((step) => String(step.title)),
  );

  // An event that can be duplicated and archived: every step but the
  // announcement's "How important is it?" and the announcement question
  // (asked only after a date change or a cancel, review 2).
  await page.goto("/admin/content/events");
  await page
    .getByRole("link", { name: "Edit Community volunteer morning" })
    .click();
  await showMeHow.click();
  await playTour(
    page,
    "content",
    tourSteps.content
      .filter(
        (step) =>
          step.title !== "How important is it?" &&
          step.title !== "Also post an announcement?",
      )
      .map((step) => String(step.title)),
  );
  await expectAccessible(page);
  // A new item cannot be duplicated or archived yet: that step is left out,
  // and an announcement has no event status, so the tour counts six steps
  // and ends with Done.
  await page.goto("/admin/content/announcements/new?tour=1");
  await playTour(page, "content", [
    "Preview",
    "Name",
    "Date and time",
    "How important is it?",
    "Who can see it?",
    "Save",
  ]);

  // A help link opens a page with its tour running.
  await page.goto("/admin/people?tour=1");
  await expect(tourStep(page)).toBeVisible();
  await expectAccessible(page);
  await playTour(page, "people");

  // The New board term and Recent changes tours (PR5a WP8).
  await page.goto("/admin/handover?tour=1");
  await playTour(page, "handover");
  await page.goto("/admin/activity?tour=1");
  await playTour(page, "activity");

  // Pages without a tour have no Show me how.
  await page.goto("/admin/people/groups");
  await expect(
    page.getByRole("heading", { name: "Team groups", level: 1 }),
  ).toBeVisible();
  await expect(showMeHow).toHaveCount(0);
});

/** Axe in light and dark; reloads so the scan never catches the colours mid-transition. */
async function expectAccessibleLightAndDark(page: Page) {
  await expectAccessible(page);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expectAccessible(page);
  await page.emulateMedia({ colorScheme: "light" });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
}

test("sandbox walkthrough: the Help page lists the tours, and every PR3 and PR4 screen passes axe", async ({
  page,
}) => {
  test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");
  // Eleven pages, each with an axe scan.
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await signInToSandbox(page);

  // The sandbox's iqamah times end today: the notifications bell reminds
  // the board (PR4 D-12, daily check WP-6) and links to the prayer screen.
  await expectAccessibleLightAndDark(page);
  const reminder = await openNotifications(page);
  await expect(reminder).toContainText(
    /Iqamah times end on \w{3} \d{1,2} \w{3} \(today\)/,
  );
  await reminder.getByRole("link", { name: "Open Prayer & iqamah →" }).click();
  await expect(page).toHaveURL(/\/admin\/prayer-times$/);
  await page.goto("/admin/dashboard");

  // The Help page (final plan B): it points to the board handbook (a Word
  // file) and lists every "Show me how" tour; each link plays its tour.
  await page.getByRole("link", { name: /board editing guide/i }).click();
  await expect(page).toHaveURL(/\/admin\/help$/);
  await expect(
    page.getByRole("region", { name: "The board handbook" }),
  ).toContainText("SGU MSA Website Handbook");
  const tours = page.getByRole("region", { name: "“Show me how” tours" });
  for (const tour of Object.values(tourPages))
    await expect(
      tours.getByRole("link", { name: `${tour.label} →` }),
    ).toHaveAttribute("href", tour.href);
  await expectAccessibleLightAndDark(page);
  await tours.getByRole("link", { name: "Prayer & iqamah →" }).click();
  await expect(page).toHaveURL(/\/admin\/prayer-times\?tour=1$/);
  await expect(tourStep(page)).toBeVisible();

  // Every PR3 and PR4 screen passes axe.
  const screens: [string, string][] = [
    ["/admin/people", "People"],
    ["/admin/activity", "Recent changes"],
    ["/admin/prayer-times", "History"],
  ];
  for (const [path, heading] of screens) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    await expectAccessible(page);
  }
  for (const path of [
    "/admin/people/groups",
    "/admin/people?view=archived",
    "/admin/content/events?view=archived",
    "/admin/people/new",
    "/admin/set-password",
    "/admin/auth/confirm?token_hash=test&type=invite",
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectAccessible(page);
  }

  // Signed out: the forgot-password screen.
  await page.goto("/admin/dashboard");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("link", { name: "Forgot your password?" }).click();
  await expect(page).toHaveURL(/\/admin\/forgot-password$/);
  await expectAccessible(page);
});
