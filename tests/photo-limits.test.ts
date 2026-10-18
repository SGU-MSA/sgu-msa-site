import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import {
  ACTION_BODY_LIMIT_BYTES,
  isHeic,
  isUploadImageType,
  keepShrunk,
  MAX_NEW_PHOTOS_PER_SAVE,
  newPhotosProblem,
  PHOTO_MAX_SIDE,
  shrinkScale,
  shrinkTypeFor,
  UPLOAD_BODY_BUDGET_BYTES,
  UPLOAD_IMAGE_TYPES,
  UPLOAD_MAX_BYTES,
  UPLOAD_MAX_LABEL,
} from "../src/lib/media/photo-limits";
import { normalizeUpload } from "../src/lib/backend/storage";

const MB = 1024 * 1024;

test("photo limits: the server's 3 MB stays, and one save fits the request limit", () => {
  assert.equal(UPLOAD_MAX_BYTES, 3 * MB);
  assert.equal(PHOTO_MAX_SIDE, 1600);
  // Hints and the server's message read the limit from the same number.
  assert.equal(UPLOAD_MAX_LABEL, "3 MB");
  // One largest photo fits the budget, and the budget leaves room in the
  // request for the typed text (20,000-character body) and multipart overhead.
  assert.ok(UPLOAD_MAX_BYTES <= UPLOAD_BODY_BUDGET_BYTES);
  assert.ok(ACTION_BODY_LIMIT_BYTES - UPLOAD_BODY_BUDGET_BYTES >= 100_000);
});

test("photo limits: the size budget and the file-count rule", () => {
  assert.equal(newPhotosProblem([]), null);
  assert.equal(newPhotosProblem([0]), null, "an empty photo box is no file");
  assert.equal(newPhotosProblem([UPLOAD_MAX_BYTES]), null);
  assert.equal(newPhotosProblem([UPLOAD_MAX_BYTES + 1]), "too_big");
  assert.equal(
    newPhotosProblem(Array(MAX_NEW_PHOTOS_PER_SAVE).fill(400_000)),
    null,
  );
  assert.equal(
    newPhotosProblem(Array(MAX_NEW_PHOTOS_PER_SAVE + 1).fill(400_000)),
    "too_many",
  );
  assert.equal(newPhotosProblem([2 * MB, 2 * MB]), "over_budget");
  assert.equal(
    newPhotosProblem([UPLOAD_BODY_BUDGET_BYTES - 1_000_000, 1_000_000]),
    null,
    "exactly the budget is allowed",
  );
  // A file the server would refuse is named first, whatever else is chosen.
  assert.equal(newPhotosProblem([1, 1, 1, 1, UPLOAD_MAX_BYTES + 1]), "too_big");
});

test("photo limits: the shrunk copy replaces the chosen file only when it helps", () => {
  const jpeg = (size: number) => ({ size, type: "image/jpeg" });
  assert.equal(keepShrunk(jpeg(5 * MB), jpeg(420_000)), true);
  assert.equal(keepShrunk(jpeg(80_000), jpeg(90_000)), false, "not smaller");
  assert.equal(keepShrunk(jpeg(80_000), jpeg(0)), false, "empty result");
  // HEIC (refused by the server) is always replaced by the readable copy.
  assert.equal(
    keepShrunk({ size: 1_000, type: "image/heic" }, jpeg(2_000)),
    true,
  );
  // A browser that cannot write WebP may return PNG; still a server type.
  assert.equal(
    keepShrunk(
      { size: 4 * MB, type: "image/png" },
      { size: MB, type: "image/png" },
    ),
    true,
  );
  assert.equal(
    keepShrunk(jpeg(4 * MB), { size: MB, type: "image/gif" }),
    false,
    "never a type the server refuses",
  );
});

test("photo limits: transparent formats stay transparent, photos become JPEG", () => {
  assert.equal(shrinkTypeFor("image/jpeg"), "image/jpeg");
  assert.equal(shrinkTypeFor("image/heic"), "image/jpeg");
  assert.equal(shrinkTypeFor(""), "image/jpeg");
  assert.equal(shrinkTypeFor("image/png"), "image/webp");
  assert.equal(shrinkTypeFor("image/webp"), "image/webp");
  assert.equal(isUploadImageType("image/heic"), false);
  assert.equal(isUploadImageType("image/webp"), true);
});

test("photo limits: the longest side fits 1600 px and small photos keep their size", () => {
  assert.equal(shrinkScale(4032, 3024), PHOTO_MAX_SIDE / 4032);
  assert.equal(shrinkScale(3024, 4032), PHOTO_MAX_SIDE / 4032);
  assert.equal(shrinkScale(1600, 900), 1);
  assert.equal(shrinkScale(640, 480), 1);
});

test("photo limits: the server refuses over 3 MB and stores at most 1600 px", async () => {
  await assert.rejects(
    normalizeUpload(
      "image",
      new File([new Uint8Array(UPLOAD_MAX_BYTES + 1)], "big.jpg", {
        type: "image/jpeg",
      }),
    ),
    /3 MB or smaller/,
  );
  await assert.rejects(
    normalizeUpload(
      "image",
      new File([new Uint8Array(10)], "photo.heic", { type: "image/heic" }),
    ),
    /JPEG, PNG, or WebP/,
  );
  const wide = await sharp({
    create: { width: 2400, height: 1200, channels: 3, background: "#406080" },
  })
    .jpeg()
    .toBuffer();
  const stored = await normalizeUpload(
    "image",
    new File([new Uint8Array(wide)], "wide.jpg", { type: "image/jpeg" }),
  );
  const metadata = await sharp(stored!.bytes).metadata();
  assert.equal(metadata.width, PHOTO_MAX_SIDE);
  assert.equal(metadata.height, PHOTO_MAX_SIDE / 2);
});

test("photo limits: HEIC is recognised by its type, or by its name when the type is empty (D-29)", () => {
  assert.equal(isHeic({ type: "image/heic", name: "IMG_0001.HEIC" }), true);
  assert.equal(isHeic({ type: "image/heif", name: "photo" }), true);
  assert.equal(isHeic({ type: "IMAGE/HEIC", name: "photo" }), true);
  assert.equal(isHeic({ type: "image/heic-sequence", name: "photo" }), true);
  assert.equal(isHeic({ type: "image/heif-sequence", name: "photo" }), true);
  assert.equal(isHeic({ type: "image/heicx", name: "photo.heic" }), false);
  // Some browsers give no type for a HEIC file: the name decides.
  assert.equal(isHeic({ type: "", name: "IMG_0001.heic" }), true);
  assert.equal(isHeic({ type: "", name: "IMG_0001.HEIF" }), true);
  assert.equal(isHeic({ type: "", name: "IMG_0001.jpg" }), false);
  assert.equal(isHeic({ type: "", name: "heic" }), false);
  // A typed file is judged by its type, whatever its name says.
  assert.equal(isHeic({ type: "image/jpeg", name: "IMG_0001.heic" }), false);
  assert.equal(isHeic({ type: "image/png", name: "chart.png" }), false);
  // The server never accepts HEIC as it is (no converter, D-29).
  assert.equal(isUploadImageType("image/heic"), false);
  assert.equal(isUploadImageType("image/heif"), false);
});

test("photo limits: the photo box offers only JPEG, PNG and WebP (no HEIC, no image/*; D-29)", () => {
  assert.deepEqual(
    [...UPLOAD_IMAGE_TYPES],
    ["image/jpeg", "image/png", "image/webp"],
  );
  // The one image input reads its accept list from UPLOAD_IMAGE_TYPES.
  const field = readFileSync("src/features/admin/ImageField.tsx", "utf8");
  const accepts = [...field.matchAll(/accept=\{([^}]*)\}/g)].map((m) => m[1]);
  assert.deepEqual(accepts, ['UPLOAD_IMAGE_TYPES.join(",")']);
});
