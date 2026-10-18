import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";
import {
  UPLOAD_IMAGE_TYPES,
  UPLOAD_MAX_BYTES,
} from "../../src/lib/media/photo-limits";
import { heicCannotOpen } from "../../src/features/admin/fields";
import {
  expectAccessible,
  heicLikePhoto,
  savedToast,
  signInToSandbox,
  submit,
  pageButton,
} from "./actions";

// PR5a-WP3 (D-4): the board's photo box makes phone photos smaller in the
// browser before upload; the server keeps its own 3 MB check.

/** A noisy camera-sized JPEG of about 5 MB, like a phone photo. */
function phonePhoto() {
  return sharp({
    create: {
      width: 3600,
      height: 2700,
      channels: 3,
      background: "#806020",
      noise: { type: "gaussian", mean: 128, sigma: 40 },
    },
  })
    .jpeg({ quality: 85 })
    .toBuffer();
}

/** The photo now in the picture box (after shrinking, the smaller copy). */
function chosenPhoto(page: Page) {
  return page.getByLabel(/^Picture/).evaluate((input) => {
    const file = (input as HTMLInputElement).files![0];
    return { name: file.name, size: file.size, type: file.type };
  });
}

/**
 * Shrinking is silent (Q92, Q93): once the box holds the smaller copy (not
 * `original` bytes), Save is enabled again and no line shows.
 */
async function shrinkingDone(page: Page, original: number) {
  await expect
    .poll(async () => (await chosenPhoto(page)).size)
    .toBeLessThan(original);
  await expect(pageButton(page, "Save")).toBeEnabled();
  await expect(page.getByText(/made smaller on your phone/)).toHaveCount(0);
  await expect(page.locator(".form-field .form-error")).toHaveCount(0);
}

async function newAnnouncement(page: Page, title: string) {
  await page.goto("/admin/content/announcements/new");
  await page.getByLabel("Headline", { exact: true }).fill(title);
  await page
    .getByLabel("Describe the picture", { exact: true })
    .fill("A phone photo test");
}

test("sandbox: a 5 MB phone photo is made smaller before upload and saves", async ({
  page,
}) => {
  test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");
  await signInToSandbox(page);
  const title = `Phone photo ${Date.now()}`;
  await newAnnouncement(page, title);
  const buffer = await phonePhoto();
  expect(buffer.length).toBeGreaterThan(5 * 1024 * 1024);
  await page
    .getByLabel(/^Picture/)
    .setInputFiles({ name: "IMG_4821.jpg", mimeType: "image/jpeg", buffer });
  await shrinkingDone(page, buffer.length);
  // The smaller copy, not the original, is what the save sends.
  const chosen = await chosenPhoto(page);
  expect(chosen.name).toBe("IMG_4821.jpg");
  expect(chosen.type).toBe("image/jpeg");
  expect(chosen.size).toBeLessThan(UPLOAD_MAX_BYTES);
  await expectAccessible(page);
  await page.getByRole("radio", { name: "Everyone on the website" }).check();
  await submit(page, "Save");
  await expect(savedToast(page)).toContainText("Saved");

  const href = await page
    .getByRole("link", { name: `Edit ${title}` })
    .getAttribute("href");
  await page.goto(`/community/announcements/${href!.split("/").at(-1)}`);
  const photo = page.getByRole("img", { name: "A phone photo test" });
  await expect(photo).toBeVisible();
  await expect
    .poll(() =>
      photo.evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBe(1600);
});

test("sandbox: a sideways camera photo is turned upright while it is made smaller", async ({
  page,
}) => {
  test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");
  await signInToSandbox(page);
  await newAnnouncement(page, `Sideways photo ${Date.now()}`);
  // Stored 3600 x 1800 with the camera's "turn 90°" note (EXIF orientation
  // 6), so it shows 1800 wide and 3600 tall.
  const buffer = await sharp({
    create: {
      width: 3600,
      height: 1800,
      channels: 3,
      background: "#806020",
      noise: { type: "gaussian", mean: 128, sigma: 40 },
    },
  })
    .jpeg({ quality: 90 })
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const picture = page.getByLabel(/^Picture/);
  await picture.setInputFiles({
    name: "IMG_0001.jpg",
    mimeType: "image/jpeg",
    buffer,
  });
  await shrinkingDone(page, buffer.length);
  const size = await picture.evaluate(async (input) => {
    const bitmap = await createImageBitmap(
      (input as HTMLInputElement).files![0],
      {
        imageOrientation: "none",
      },
    );
    return [bitmap.width, bitmap.height];
  });
  expect(size).toEqual([800, 1600]);
});

test("sandbox: a photo the browser cannot read shows the could-not-shrink line and is not sent when over 3 MB", async ({
  page,
}) => {
  test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");
  await signInToSandbox(page);
  await newAnnouncement(page, `Broken photo ${Date.now()}`);
  const line = page.getByText(
    "This photo could not be made smaller on this device. If it is over 3 MB, take a screenshot of it or share it as JPEG.",
  );
  await page.getByLabel(/^Picture/).setInputFiles({
    name: "broken.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("not really a photo"),
  });
  await expect(line).toBeVisible();

  // Too big to send as it is: Save stops in the browser and nothing is posted.
  await page.getByLabel(/^Picture/).setInputFiles({
    name: "broken-big.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.alloc(UPLOAD_MAX_BYTES + 200_000, 7),
  });
  await expect(line).toBeVisible();
  let posted = false;
  page.on("request", (request) => {
    if (request.method() === "POST") posted = true;
  });
  await pageButton(page, "Save").click();
  await expect(page.getByLabel(/^Picture/)).toBeFocused();
  await expect(line).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/content\/announcements\/new$/);
  expect(posted).toBe(false);
});

test("sandbox: Save is quietly disabled while the photo is being made smaller and sends nothing", async ({
  page,
}) => {
  test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");
  // Hold the browser's photo reading until the test lets it go, like a slow
  // phone, so Save can be clicked mid-shrink.
  await page.addInitScript(() => {
    const read = window.createImageBitmap.bind(window);
    const held: Array<() => void> = [];
    Object.assign(window, {
      releasePhoto: () => held.splice(0).forEach((go) => go()),
    });
    window.createImageBitmap = ((...args: Parameters<typeof read>) =>
      new Promise<void>((go) => held.push(go)).then(() =>
        read(...args),
      )) as typeof window.createImageBitmap;
  });
  await signInToSandbox(page);
  await newAnnouncement(page, `Slow photo ${Date.now()}`);
  const photo = await phonePhoto();
  await page.getByLabel(/^Picture/).setInputFiles({
    name: "IMG_5000.jpg",
    mimeType: "image/jpeg",
    buffer: photo,
  });
  let posted = false;
  page.on("request", (request) => {
    if (request.method() === "POST") posted = true;
  });
  const save = pageButton(page, "Save");
  await expect(save).toBeDisabled();
  // Enter in a text box cannot send the form either.
  await page.getByLabel("Headline", { exact: true }).press("Enter");
  expect(posted).toBe(false);
  await page.evaluate(() =>
    (window as unknown as { releasePhoto: () => void }).releasePhoto(),
  );
  await shrinkingDone(page, photo.length);
  expect((await chosenPhoto(page)).size).toBeLessThan(UPLOAD_MAX_BYTES);
  expect(posted).toBe(false);
});

test("sandbox: the server still refuses a 4 MB photo posted without the browser checks", async ({
  page,
}) => {
  test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");
  // Next 16.3.4's development server fails a form posted without JavaScript
  // under Cache Components (InvariantError reading cookies); production builds
  // answer it (review fixes PR-C). Run against `npm run demo:review`.
  test.skip(
    process.env.E2E_SERVER_MODE === "development",
    "Next dev server bug: no-JavaScript form posts under Cache Components",
  );
  await signInToSandbox(page);
  const title = `Unchecked photo ${Date.now()}`;
  await newAnnouncement(page, title);
  const picture = page.getByLabel(/^Picture/);
  await picture.setInputFiles({
    name: "big.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.alloc(4_000_000, 7),
  });
  // The dashboard's forms need JavaScript to show (streamed), so post the
  // form the way a browser without JavaScript does: a plain form submission
  // that skips the submit event, the photo check and React.
  const posted = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/admin"),
  );
  await picture.evaluate((input) =>
    HTMLFormElement.prototype.submit.call((input as HTMLInputElement).form!),
  );
  await posted;
  // Next's route announcer is also an alert: look for the form's own.
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Each upload must be 3 MB or smaller." }),
  ).toBeVisible();
  await expect(page.getByLabel("Headline", { exact: true })).toHaveValue(title);
});

test("sandbox: a HEIC photo this browser cannot open shows the HEIC line, and Save sends nothing (D-29)", async ({
  page,
}) => {
  test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");
  await signInToSandbox(page);
  const title = `HEIC photo ${Date.now()}`;
  await newAnnouncement(page, title);
  const picture = page.getByLabel(/^Picture/);
  // The box still offers only JPEG, PNG and WebP.
  await expect(picture).toHaveAttribute("accept", UPLOAD_IMAGE_TYPES.join(","));
  const line = page.getByText(heicCannotOpen);
  for (const file of [
    { name: "IMG_4821.HEIC", mimeType: "image/heic" },
    // Some browsers give a HEIC file no type: its name decides.
    { name: "IMG_4822.heic", mimeType: "" },
  ]) {
    await picture.setInputFiles({ ...file, buffer: heicLikePhoto() });
    await expect(line).toBeVisible();
    await expect(pageButton(page, "Save")).toBeEnabled();
  }
  // Only the HEIC line, not the could-not-shrink line.
  await expect(page.getByText(/could not be made smaller/)).toHaveCount(0);
  await expectAccessible(page);

  let posted = false;
  page.on("request", (request) => {
    if (request.method() === "POST") posted = true;
  });
  await pageButton(page, "Save").click();
  await expect(picture).toBeFocused();
  await expect(line).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/content\/announcements\/new$/);
  expect(posted).toBe(false);
  // What was typed stays.
  await expect(page.getByLabel("Headline", { exact: true })).toHaveValue(title);

  // Choosing a JPEG instead clears the line, and the save goes through.
  await picture.setInputFiles({
    name: "IMG_4821.jpg",
    mimeType: "image/jpeg",
    buffer: await sharp({
      create: { width: 40, height: 30, channels: 3, background: "#806020" },
    })
      .jpeg()
      .toBuffer(),
  });
  await expect(line).toHaveCount(0);
  await expect(pageButton(page, "Save")).toBeEnabled();
  await submit(page, "Save");
  await expect(savedToast(page)).toContainText("Saved");
});

/** A small photo of one colour, so each upload is its own file. */
function plainPhoto(background: string) {
  return sharp({ create: { width: 400, height: 300, channels: 3, background } })
    .png()
    .toBuffer();
}

test("sandbox: the photo library: where each photo is used, reuse without uploading, delete only unused ones", async ({
  page,
}) => {
  test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");
  await signInToSandbox(page);
  // The dashboard card.
  await page.getByRole("link", { name: /^Photos/ }).click();
  await expect(page.getByRole("heading", { name: "Photos" })).toBeVisible();
  await expect(page.getByText(/^Space used: .* of 1 GB/)).toBeVisible();

  // Upload a picture with a new announcement.
  const first = `Library first ${Date.now()}`;
  await newAnnouncement(page, first);
  await page.getByLabel(/^Picture/).setInputFiles({
    name: "red.png",
    mimeType: "image/png",
    buffer: await plainPhoto("#a03030"),
  });
  await expect(pageButton(page, "Save")).toBeEnabled();
  await page.getByRole("radio", { name: "Everyone on the website" }).check();
  await submit(page, "Save");
  await expect(savedToast(page)).toContainText("Saved");

  // A second announcement reuses it: nothing is uploaded again.
  const second = `Library reuse ${Date.now()}`;
  await newAnnouncement(page, second);
  await page
    .getByRole("button", { name: "Choose from uploaded photos" })
    .click();
  const chooser = page.getByRole("dialog", { name: "Uploaded photos" });
  await chooser
    .getByRole("button", { name: new RegExp(`Announcement: ${first}`) })
    .click();
  await expect(chooser).toBeHidden();
  await expect(page.getByText("Chosen from uploaded photos.")).toBeVisible();
  await page.getByRole("radio", { name: "Everyone on the website" }).check();
  await submit(page, "Save");
  await expect(savedToast(page)).toContainText("Saved");

  // Photos lists the one file, used by both; no Delete on it.
  await page.goto("/admin/photos");
  const used = page
    .locator(".photo-card")
    .filter({ hasText: `Announcement: ${first}` });
  await expect(used).toHaveCount(1);
  await expect(used.getByText(`Announcement: ${second}`)).toBeVisible();
  await expect(used.getByRole("button", { name: /^Delete/ })).toHaveCount(0);

  // Replacing the second one's picture leaves no file unused (the first
  // still uses it); replacing the first's then leaves it unused.
  await page.goto("/admin/content/announcements");
  await page.getByRole("link", { name: `Edit ${first}` }).click();
  await page.getByLabel(/^Picture/).setInputFiles({
    name: "blue.png",
    mimeType: "image/png",
    buffer: await plainPhoto("#3050a0"),
  });
  await expect(pageButton(page, "Save")).toBeEnabled();
  await submit(page, "Save");
  await expect(savedToast(page)).toContainText("Saved");
  await page.goto("/admin/content/announcements");
  await page.getByRole("link", { name: `Edit ${second}` }).click();
  await page
    .getByRole("button", { name: "Choose from uploaded photos" })
    .click();
  await page
    .getByRole("dialog", { name: "Uploaded photos" })
    .getByRole("button", { name: new RegExp(`Announcement: ${first}`) })
    .first()
    .click();
  await submit(page, "Save");
  await expect(savedToast(page)).toContainText("Saved");

  await page.goto("/admin/photos");
  const unused = page
    .locator(".photo-card")
    .filter({ hasText: "Not used anywhere" });
  const before = await unused.count();
  expect(before).toBeGreaterThan(0);
  await expectAccessible(page);
  await unused
    .first()
    .getByRole("button", { name: /^Delete/ })
    .click();
  const confirm = page.getByRole("dialog", { name: "Delete this file?" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Deleted.");
  await expect(unused).toHaveCount(before - 1);
});

test("sandbox: Home's first-visit photo is changed from Pages with a reused photo", async ({
  page,
}) => {
  test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");
  await signInToSandbox(page);
  // A photo to reuse: a person's photo.
  await page.goto("/admin/people");
  await page.getByRole("link", { name: "Edit Omar Haddad" }).click();
  await page.locator('input[type="file"][name="image"]').setInputFiles({
    name: "green.png",
    mimeType: "image/png",
    buffer: await plainPhoto("#30a050"),
  });
  await expect(
    page.getByRole("button", { name: "Save changes" }),
  ).toBeEnabled();
  await submit(page, "Save changes");
  await expect(savedToast(page)).toContainText("Saved");

  await page.goto("/admin/pages/home");
  await page.getByRole("button", { name: "Edit Your first visit" }).click();
  const visit = page.getByRole("region", { name: "Your first visit" });
  await visit
    .getByRole("button", { name: "Choose from uploaded photos" })
    .click();
  await page
    .getByRole("dialog", { name: "Uploaded photos" })
    .getByRole("button", { name: /^People: Omar Haddad/ })
    .first()
    .click();
  await expect(visit.getByText("Chosen from uploaded photos.")).toBeVisible();
  await expect(visit.locator("img.page-photo-thumb")).toHaveAttribute(
    "src",
    /^\/admin\/media\/[a-f0-9-]{36}\.webp$/,
  );
  await submit(page, "Save page");
  await expect(savedToast(page)).toContainText("Saved");
  await page.goto("/");
  await expect(
    page.locator('section[aria-labelledby="first-visit"] img[src*="/media/"]'),
  ).toHaveCount(1);
});
