import { z } from "../validation/zod";

/**
 * Ordered photo lists (PR5c, D-9, D-27 c): a season page's photos and a
 * merch item's photos, each `{ src, alt }`, the first one the cover. The
 * database's mirror is `public.valid_photo_list` (202610150001_schema.sql). Pure: the
 * browser editor and the server action share it.
 */

/**
 * A stored photo: a starter image or an uploaded one (`/media/<uuid>.webp`,
 * lower case). The same rule as `valid_photo_list` in
 * `202610150001_schema.sql`.
 */
export const photoSourcePattern =
  /^(\/images\/[A-Za-z0-9/._-]+|\/media\/[a-f0-9-]{36}\.webp)$/;

/** The longest photo description. */
export const PHOTO_ALT_MAX = 250;

/** A photo in a list as it is posted before its file is stored: "new:<key>". */
export const NEW_PHOTO_PREFIX = "new:";

export type ListedPhoto = { src: string; alt: string };

const describeIt = "Photo description: describe the photo in one sentence.";

/** One stored photo of a list. */
export const listedPhotoSchema = z.object({
  src: z.string().regex(photoSourcePattern, "Photo: choose the photo again."),
  alt: z
    .string()
    .trim()
    .min(1, describeIt)
    .max(
      PHOTO_ALT_MAX,
      `Photo description: use ${PHOTO_ALT_MAX} characters or fewer.`,
    ),
});

/** A stored list of at most `max` photos. */
export const photoListSchema = (max: number) =>
  z
    .array(listedPhotoSchema)
    .max(max, `Photos: keep ${max} photos or fewer.`)
    .default([]);

/** The stored file name of an uploaded photo, or null for a starter image. */
export function uploadedName(src: string): string | null {
  return src.startsWith("/media/") ? src.slice("/media/".length) : null;
}

/** The uploaded files a list names. */
export const uploadedIn = (list: readonly ListedPhoto[]) =>
  list.flatMap((photo) => uploadedName(photo.src) ?? []);

/** The file box of a new photo in a list ("photo:<list>:<key>"). */
export const newPhotoBox = (list: string, key: string) =>
  `photo:${list}:${key}`;

/**
 * A photo list as typed (`posted`, the JSON the editor sends): each photo
 * stored ("/media/…", "/images/…") or new ("new:<key>", whose file is in
 * `newPhotoBox(list, key)`). New photos without a chosen file (a refused
 * save loses chosen files) must be chosen again. Problems are keyed
 * `<list>` or `<list>.<n>.alt`.
 */
export function photoListForm(input: {
  list: string;
  posted: string | undefined;
  max: number;
  /** The keys of new photos whose file is chosen. */
  chosen: ReadonlySet<string>;
}):
  | { ok: true; photos: ListedPhoto[]; added: string[] }
  | { ok: false; fields: Record<string, string> } {
  const { list, max, chosen } = input;
  let raw: unknown;
  try {
    raw = JSON.parse(input.posted || "[]");
  } catch {
    return { ok: false, fields: { [list]: "Photos: reload and try again." } };
  }
  if (!Array.isArray(raw))
    return { ok: false, fields: { [list]: "Photos: reload and try again." } };
  const fields: Record<string, string> = {};
  const photos: ListedPhoto[] = [];
  const added: string[] = [];
  raw.forEach((entry, index) => {
    const src =
      typeof entry === "object" && entry && typeof entry.src === "string"
        ? entry.src
        : "";
    const alt =
      typeof entry === "object" && entry && typeof entry.alt === "string"
        ? entry.alt.trim()
        : "";
    if (src.startsWith(NEW_PHOTO_PREFIX)) {
      const key = src.slice(NEW_PHOTO_PREFIX.length);
      if (!chosen.has(key)) {
        fields[`${list}.${index}.file`] ??= "Photo: choose the photo again.";
        return;
      }
      added.push(key);
    } else if (!photoSourcePattern.test(src)) {
      fields[`${list}.${index}.file`] ??= "Photo: choose the photo again.";
      return;
    }
    if (!alt) fields[`${list}.${index}.alt`] ??= describeIt;
    else if (alt.length > PHOTO_ALT_MAX)
      fields[`${list}.${index}.alt`] ??=
        `Photo description: use ${PHOTO_ALT_MAX} characters or fewer.`;
    photos.push({ src, alt });
  });
  if (raw.length > max) fields[list] = `Photos: keep ${max} photos or fewer.`;
  return Object.keys(fields).length
    ? { ok: false, fields }
    : { ok: true, photos, added };
}
