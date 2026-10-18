import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { unzip } from "../support/unzip";
import {
  expectAccessible,
  savedToast,
  settled,
  signInToSandbox,
  submit,
} from "./actions";

// Term export (review fixes P5): the zip opens with its folders; "Free up
// space" removes the files of archived items after the download; people
// without "Manage people" reach neither the screen nor the route.

const stamp = Date.now();

test("Without 'Manage people': no Term export card, the screen and the zip are refused", async ({
  page,
}) => {
  test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");
  await signInToSandbox(page, "board");
  await expect(page.getByRole("link", { name: /Term export/ })).toHaveCount(0);
  await page.goto("/admin/term-export");
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  const zip = await page.request.get(
    "/admin/term-export/download?name=2026%20Fall&from=2020-01-01&until=2030-12-31",
  );
  expect(zip.status()).toBe(403);
  expect(zip.headers()["cache-control"]).toContain("no-store");
  expect(zip.headers()["content-type"]).not.toContain("zip");
  // Signed out: the zip is refused and the screen sends you to sign in.
  await page.context().clearCookies();
  const signedOut = await page.request.get(
    "/admin/term-export/download?name=x&from=2020-01-01&until=2030-12-31",
  );
  expect(signedOut.status()).toBe(403);
  await page.goto("/admin/term-export");
  await expect(page).toHaveURL(/\/admin$/);
});

test("A manager downloads a term zip with its folders, then frees up the space of archived items", async ({
  page,
}) => {
  test.skip(process.env.E2E_DEMO !== "true", "Explicit demo server required");
  await signInToSandbox(page);

  // An archived news item with a photo, so the zip has a file to carry and
  // Free up space has something to remove.
  const title = `Term story ${stamp}`;
  await page.goto("/admin/content/news_posts/new");
  await page.getByLabel("Headline", { exact: true }).fill(title);
  await page
    .getByLabel("One-line summary", { exact: true })
    .fill("A term export check.");
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
  await page.getByRole("radio", { name: "Everyone on the website" }).check();
  await submit(page, "Save");
  await expect(savedToast(page)).toContainText("Saved");
  const editHref = (await page
    .getByRole("link", { name: `Edit ${title}` })
    .getAttribute("href"))!;
  await page.goto(editHref);
  await page.locator("summary", { hasText: "Archive this item" }).click();
  await submit(page, "Archive");

  await page.goto("/admin/dashboard");
  await page.getByRole("link", { name: /Term export/ }).click();
  await expect(page).toHaveURL(/\/admin\/term-export$/);
  await expect(
    page.getByRole("heading", { name: "Term export", level: 1 }),
  ).toBeVisible();
  await settled(page);
  const download = page.getByRole("button", { name: "Download zip" });
  const freeUp = page.getByRole("button", { name: "Free up space…" });
  // Nothing filled in: nothing can be downloaded or removed yet.
  await expect(download).toBeDisabled();
  await expect(freeUp).toBeDisabled();
  await expect(
    page.getByText("Fill in the name and both days to download."),
  ).toBeVisible();
  await expectAccessible(page);

  await page.getByLabel("Name of the term").fill("2026 Fall");
  await page.getByLabel("From", { exact: true }).fill("2020-01-01");
  // To cannot be before From: the picker greys those days out.
  await expect(page.getByLabel("To", { exact: true })).toHaveAttribute(
    "min",
    "2020-01-01",
  );
  await page.getByLabel("To", { exact: true }).fill("2030-12-31");
  await expect(download).toBeEnabled();
  await expect(freeUp).toBeDisabled();
  await expect(
    page.getByText("Download the zip for these days first."),
  ).toBeVisible();

  const [file] = await Promise.all([
    page.waitForEvent("download"),
    download.click(),
  ]);
  expect(file.suggestedFilename()).toBe("2026 Fall.zip");
  const entries = unzip(await readFile((await file.path())!));
  const paths = entries.map((entry) => entry.path);
  for (const sheet of [
    "Events",
    "Community news",
    "Newsletters",
    "People",
    "Funds",
    "Resources",
  ])
    expect(paths).toContain(`2020/2026 Fall/${sheet}.csv`);
  const news = entries
    .find((entry) => entry.path === "2020/2026 Fall/Community news.csv")!
    .data.toString("utf8");
  const row = news.split("\r\n").find((line) => line.startsWith(title))!;
  const photo = row.match(/Community news\/[^,]+\.webp/)![0];
  expect(paths).toContain(`2020/2026 Fall/${photo}`);
  expect(
    entries
      .find((entry) => entry.path === "2020/2026 Fall/People.csv")!
      .data.toString("utf8"),
  ).toContain("Omar Haddad");

  await expect(
    page.getByText("The zip is downloading. Open it to check it."),
  ).toBeVisible();
  await expect(freeUp).toBeEnabled();
  await freeUp.click();
  const dialog = page.getByRole("dialog", {
    name: "Remove these photos and PDFs?",
  });
  await expect(dialog).toContainText(
    /archived items? dated 1 Jan 2020 to 31 Dec 2030 will be deleted/,
  );
  await expectAccessible(page);
  // Remove files waits for the tick box.
  const removeFiles = dialog.getByRole("button", { name: "Remove files" });
  await expect(removeFiles).toBeDisabled();
  await dialog
    .getByRole("checkbox", { name: "I opened the zip and can see the photos" })
    .check();
  await removeFiles.click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByText(/^Space freed: \d+ files? removed \(\d+ KB\)\.$/),
  ).toBeVisible();
  await expectAccessible(page);
  // Nothing is left to remove for these days.
  await freeUp.click();
  const none = page.getByRole("dialog", { name: "Free up space" });
  await expect(none).toContainText(
    "No archived item from these days has a photo or PDF to remove.",
  );
  await none.getByRole("button", { name: "Close" }).click();
  await expect(none).toBeHidden();

  // The item stays archived with its words; its photo is gone from Photos.
  await page.goto(editHref);
  await expect(page.getByText(title).first()).toBeVisible();
  await expect(
    page.getByRole("img", { name: "A plain test image" }),
  ).toHaveCount(0);
  await page.goto("/admin/photos");
  await expect(page.getByRole("link", { name: new RegExp(title) })).toHaveCount(
    0,
  );
});
