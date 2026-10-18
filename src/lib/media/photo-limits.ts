/**
 * Photo size rules shared by the board's browser (`ImageField` shrinks before
 * upload) and the server (`normalizeUpload`, the authority). Fixed safety
 * rules, not board settings (PR5 plan, Capability). No `server-only` import:
 * the browser bundle uses the same numbers.
 */

/** Longest side, in pixels, of a stored photo; the browser shrinks to it too. */
export const PHOTO_MAX_SIDE = 1600;
/**
 * Longest side of a newsletter uploaded as an image (review fixes P3): a
 * page of text stays readable, still within the upload size.
 */
export const DOCUMENT_IMAGE_MAX_SIDE = 3200;
/** Largest single upload the server accepts (3 MB). */
export const UPLOAD_MAX_BYTES = 3 * 1024 * 1024;
/** `UPLOAD_MAX_BYTES` as the board reads it in hints and messages: "3 MB". */
export const UPLOAD_MAX_LABEL = `${UPLOAD_MAX_BYTES / 1024 / 1024} MB`;
/** The most new file bytes one save may carry, leaving room for the typed text. */
export const UPLOAD_BODY_BUDGET_BYTES = 3_500_000;
/** The most new photos one save may carry. */
export const MAX_NEW_PHOTOS_PER_SAVE = 3;
/** The most photos one merch item may list (PR5c). */
export const MERCH_PHOTOS_MAX = 12;
/** The most photos one season page may list (PR5c). */
export const SEASON_PHOTOS_MAX = 12;
/**
 * The server-action request limit (`next.config.ts`): the budget plus the
 * typed text (up to about 21,000 characters) and the multipart overhead.
 */
export const ACTION_BODY_LIMIT_BYTES = 4 * 1024 * 1024;

/** The only image types the server accepts; the browser's file picker offers these. */
export const UPLOAD_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/**
 * Whether a chosen file is a HEIC or HEIF photo (the iPhone camera's default
 * format), by its type, or by its name when the browser gives no type (PR5a
 * D-29). The server never accepts HEIC: a browser that can open it sends a
 * JPEG copy instead, and one that cannot shows `heicCannotOpen`.
 */
export function isHeic(file: { type: string; name: string }): boolean {
  const type = file.type.toLowerCase();
  // Also the "-sequence" types some systems give burst or live photos.
  if (/^image\/hei[cf](-sequence)?$/.test(type)) return true;
  return type === "" && /\.hei[cf]$/i.test(file.name);
}

/** Whether the server accepts this image type as it is. */
export function isUploadImageType(type: string): boolean {
  return (UPLOAD_IMAGE_TYPES as readonly string[]).includes(type);
}

/**
 * The type the browser asks the canvas for: JPEG for photos (and for types the
 * server refuses, such as HEIC), WebP for PNG and WebP so transparency stays.
 * A browser that cannot write WebP returns PNG instead.
 */
export function shrinkTypeFor(type: string): "image/jpeg" | "image/webp" {
  return type === "image/png" || type === "image/webp"
    ? "image/webp"
    : "image/jpeg";
}

/** A file as far as the size rules care. */
export type FileFacts = { size: number; type: string };

/**
 * Whether the shrunk copy replaces the chosen file: always when the server
 * would refuse the original's type, otherwise only when it is smaller and of
 * an accepted type.
 */
export function keepShrunk(original: FileFacts, shrunk: FileFacts): boolean {
  if (!shrunk.size || !isUploadImageType(shrunk.type)) return false;
  if (!isUploadImageType(original.type)) return true;
  return shrunk.size < original.size;
}

/** Why the files chosen in one form cannot be sent, or null when they can. */
export type NewPhotosProblem = "too_big" | "too_many" | "over_budget";

/**
 * The browser's check before a save (the server still checks each file):
 * any file over `UPLOAD_MAX_BYTES`, more than `MAX_NEW_PHOTOS_PER_SAVE`
 * files, or more than `UPLOAD_BODY_BUDGET_BYTES` in total.
 */
export function newPhotosProblem(
  sizes: readonly number[],
): NewPhotosProblem | null {
  const chosen = sizes.filter((size) => size > 0);
  if (chosen.some((size) => size > UPLOAD_MAX_BYTES)) return "too_big";
  if (chosen.length > MAX_NEW_PHOTOS_PER_SAVE) return "too_many";
  if (
    chosen.reduce((total, size) => total + size, 0) > UPLOAD_BODY_BUDGET_BYTES
  )
    return "over_budget";
  return null;
}

/** The scale that fits a width and height inside `PHOTO_MAX_SIDE`, never enlarging. */
export function shrinkScale(width: number, height: number): number {
  const longest = Math.max(width, height);
  return longest > PHOTO_MAX_SIDE ? PHOTO_MAX_SIDE / longest : 1;
}
