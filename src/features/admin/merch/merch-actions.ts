"use server";
import { redirect } from "next/navigation";
import { redirectSaved } from "../save-state/saved-flash";
import { z } from "@/lib/validation/zod";
import { currentAdmin } from "@/lib/backend/server";
import { MERCH_PHOTOS_MAX } from "@/lib/media/photo-limits";
import { merchEditor } from "@/lib/runtime/providers";
import {
  systemText,
  sessionExpired,
  staleScreen,
  unavailableMessage,
} from "@/lib/system-text";
import type { EditorState } from "../actions";
import { refuse } from "../fields";
import { removeUnusedFiles } from "../file-cleanup";
import { keepTyped, typedValues, type KeptFormState } from "../form-state";
import {
  checkedPhotoList,
  removeDroppedPhotos,
  storeNewPhotos,
} from "../photo-list-save";
import { publicDataChanged } from "../public-refresh";
import { collectionFromForm, merchItemFromForm } from "./merch-forms";

/**
 * Merch collections and items (PR5c, D-9, D-27 b): any board member adds,
 * edits, archives and restores them; an item's photos go through the upload
 * pipeline, and photos it no longer names are deleted afterwards. Sizes are
 * priced items (`payment-actions.ts`). The database decides (RLS, the
 * version check, the photo list check) and logs every change.
 */

const merchHome = "/admin/merch";
const collectionPath = (id: string) => `${merchHome}/collections/${id}`;
const itemPath = (id: string) => `${merchHome}/items/${id}`;

const failed = (verb: string, reason: "conflict" | "unavailable" | "in_use") =>
  reason === "in_use"
    ? systemText.sguCodes.SGU16
    : reason === "conflict"
      ? staleScreen
      : unavailableMessage(verb);

export async function saveCollectionAction(
  previous: KeptFormState,
  form: FormData,
): Promise<KeptFormState> {
  const values = typedValues(form);
  const refuseKeeping = keepTyped(previous, values);
  if (!(await currentAdmin())) return refuseKeeping(sessionExpired);
  const parsed = collectionFromForm(values);
  if (!parsed.ok) return refuseKeeping(null, parsed.fields);
  const saved = await merchEditor().saveCollection(
    parsed.row,
    values.version || null,
  );
  if (!saved.ok) return refuseKeeping(failed("save", saved.reason));
  publicDataChanged();
  return redirectSaved(collectionPath(parsed.row.id));
}

export async function saveMerchItemAction(
  previous: KeptFormState,
  form: FormData,
): Promise<KeptFormState> {
  const values = typedValues(form);
  const refuseKeeping = keepTyped(previous, values);
  if (!(await currentAdmin())) return refuseKeeping(sessionExpired);
  const checked = checkedPhotoList(
    form,
    "photos",
    MERCH_PHOTOS_MAX,
    merchItemFromForm(values),
  );
  if (!checked.ok) return refuseKeeping(checked.error, checked.fields);
  const { row } = checked;
  const version = values.version || null;
  const [items, collections] = await Promise.all([
    merchEditor().listItems(),
    merchEditor().listCollections(),
  ]);
  if (items.unavailable || collections.unavailable)
    return refuseKeeping(unavailableMessage("save"));
  const before = items.items.find((known) => known.id === row.id);
  // An item stays in its collection, which must be current.
  if (
    (version
      ? !before || before.collection_id !== row.collection_id
      : before) ||
    !collections.collections.some((known) => known.id === row.collection_id)
  )
    return refuseKeeping(staleScreen);
  const stored = await storeNewPhotos(checked.photos, checked.files);
  if (!stored.ok) return refuseKeeping(stored.error);
  const saved = await merchEditor().saveItem(
    { ...row, photos: stored.photos },
    version,
  );
  if (!saved.ok) {
    await removeUnusedFiles(stored.uploaded);
    return refuseKeeping(failed("save", saved.reason));
  }
  await removeDroppedPhotos(before?.photos ?? [], stored.photos);
  publicDataChanged();
  return redirectSaved(itemPath(row.id));
}

/** The row an archive or restore form posts, and where to go after it. */
function postedTarget(form: FormData) {
  const id = z.uuid().safeParse(form.get("id"));
  const version = z.string().min(1).safeParse(form.get("version"));
  return id.success && version.success
    ? { id: id.data, version: version.data }
    : null;
}

type Target = "collection" | "item";
async function setArchived(
  form: FormData,
  target: Target,
  archive: boolean,
): Promise<EditorState> {
  if (!(await currentAdmin())) return refuse(sessionExpired);
  const posted = postedTarget(form);
  if (!posted) return refuse(staleScreen);
  const editor = merchEditor();
  const write =
    target === "collection"
      ? archive
        ? editor.archiveCollection
        : editor.restoreCollection
      : archive
        ? editor.archiveItem
        : editor.restoreItem;
  const result = await write(posted.id, posted.version);
  if (!result.ok)
    return refuse(failed(archive ? "archive" : "restore", result.reason));
  publicDataChanged();
  const done = archive ? "archived=1" : "restored=1";
  // An item goes back to its collection; a collection to the Merch list.
  const back = z.uuid().safeParse(form.get("collection_id"));
  redirect(
    target === "item" && back.success
      ? `${collectionPath(back.data)}?${done}`
      : `${merchHome}?${done}`,
  );
}

/** Archives a collection: it leaves the Merch page with its items. */
export async function archiveCollectionAction(
  _previous: EditorState,
  form: FormData,
): Promise<EditorState> {
  return setArchived(form, "collection", true);
}

export async function restoreCollectionAction(
  _previous: EditorState,
  form: FormData,
): Promise<EditorState> {
  return setArchived(form, "collection", false);
}

/** Archives an item: it leaves the Merch page. Refused while it has current sizes (SGU16). */
export async function archiveMerchItemAction(
  _previous: EditorState,
  form: FormData,
): Promise<EditorState> {
  return setArchived(form, "item", true);
}

export async function restoreMerchItemAction(
  _previous: EditorState,
  form: FormData,
): Promise<EditorState> {
  return setArchived(form, "item", false);
}
