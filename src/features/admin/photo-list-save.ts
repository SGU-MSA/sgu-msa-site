import "server-only";
import { MAX_NEW_PHOTOS_PER_SAVE } from "@/lib/media/photo-limits";
import {
  NEW_PHOTO_PREFIX,
  photoListForm,
  uploadedIn,
  type ListedPhoto,
} from "@/lib/media/photo-list";
import { contentEditor } from "@/lib/runtime/providers";
import {
  chooseFileAgain,
  systemText,
  unavailableMessage,
} from "@/lib/system-text";
import { removeUnusedFiles } from "./file-cleanup";

/** The keys of the new photos whose file was chosen in `list`'s boxes. */
function chosenFiles(form: FormData, list: string) {
  const files = new Map<string, File>();
  const prefix = `photo:${list}:`;
  for (const [name, value] of form)
    if (name.startsWith(prefix) && value instanceof File && value.size)
      files.set(name.slice(prefix.length), value);
  return files;
}

/**
 * A form with a photo list (season page, merch item), checked together with
 * the rest of its boxes (`parsed`) before anything is stored: every box's
 * problem in one refusal. `again` asks for the chosen files again, since
 * browsers cannot keep them after a refused save; a later refusal shows it
 * too.
 */
export function checkedPhotoList<Row>(
  form: FormData,
  list: string,
  max: number,
  parsed:
    { ok: true; row: Row } | { ok: false; fields: Record<string, string> },
):
  | {
      ok: true;
      row: Row;
      photos: ListedPhoto[];
      files: Map<string, File>;
      again: string | null;
    }
  | { ok: false; error: string | null; fields?: Record<string, string> } {
  const files = chosenFiles(form, list);
  const again = [...form.values()].some(
    (value) => value instanceof File && value.size > 0,
  )
    ? chooseFileAgain("new photos")
    : null;
  const posted = form.get(list);
  const result = photoListForm({
    list,
    posted: typeof posted === "string" ? posted : undefined,
    max,
    chosen: new Set(files.keys()),
  });
  if (result.ok && result.added.length > MAX_NEW_PHOTOS_PER_SAVE)
    return {
      ok: false,
      error: systemText.pages.tooManyPhotos(MAX_NEW_PHOTOS_PER_SAVE),
    };
  if (!result.ok || !parsed.ok)
    return {
      ok: false,
      error: again,
      fields: {
        ...(result.ok ? {} : result.fields),
        ...(parsed.ok ? {} : parsed.fields),
      },
    };
  return { ok: true, row: parsed.row, photos: result.photos, files, again };
}

/**
 * Stores the new photos of a checked list through the upload pipeline (made
 * smaller and turned into WebP by `normalizeUpload`) and returns the list
 * with their addresses, and the stored names (to remove again if the save
 * fails). Throws nothing: a refused upload is its message.
 */
export async function storeNewPhotos(
  photos: readonly ListedPhoto[],
  files: ReadonlyMap<string, File>,
): Promise<
  | { ok: true; photos: ListedPhoto[]; uploaded: string[] }
  | { ok: false; error: string }
> {
  const uploaded: string[] = [];
  try {
    const stored: ListedPhoto[] = [];
    for (const photo of photos) {
      if (!photo.src.startsWith(NEW_PHOTO_PREFIX)) {
        stored.push(photo);
        continue;
      }
      const file = files.get(photo.src.slice(NEW_PHOTO_PREFIX.length));
      const name = file ? await contentEditor().upload("image", file) : null;
      if (!name) throw new Error(unavailableMessage("save"));
      uploaded.push(name);
      stored.push({ src: `/media/${name}`, alt: photo.alt });
    }
    return { ok: true, photos: stored, uploaded };
  } catch (error) {
    await removeUnusedFiles(uploaded);
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : unavailableMessage("save"),
    };
  }
}

/** After a save: the uploads the old list named and the new one no longer does. */
export async function removeDroppedPhotos(
  before: readonly ListedPhoto[],
  after: readonly ListedPhoto[],
) {
  const kept = new Set(uploadedIn(after));
  await removeUnusedFiles(uploadedIn(before).filter((name) => !kept.has(name)));
}
