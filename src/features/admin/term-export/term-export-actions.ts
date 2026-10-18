"use server";
import { currentAdmin } from "@/lib/backend/server";
import { sizeLabel } from "@/lib/media/storage-space";
import { contentEditor } from "@/lib/runtime/providers";
import {
  sessionExpired,
  systemText,
  unavailableMessage,
} from "@/lib/system-text";
import { photoLibrary } from "../photos/photo-library";
import { datedLists } from "./term-contents";
import { termRangeSchema } from "./term-form";

const words = systemText.termExport;

/** What "Free up space" would remove for the chosen days, before it asks. */
export type FreeUpCheck =
  | {
      ok: true;
      /** Files only these archived items use: the ones that will go. */
      files: number;
      size: string;
      /** Archived items in the days that lose a photo or PDF. */
      items: number;
      /** Their files that something else still uses: they stay, on the item too. */
      kept: number;
    }
  | { ok: false; error: string };

export type FreeUpResult =
  { ok: true; message: string; partly: boolean } | { ok: false; error: string };

const forbidden = { ok: false, error: words.managersOnly } as const;

async function manager() {
  const admin = await currentAdmin();
  if (!admin) return { ok: false, error: sessionExpired } as const;
  if (!admin.canManagePeople) return forbidden;
  return null;
}

/**
 * The archived events, community news and newsletters dated in the days,
 * and which of their files nothing else uses (the Photos screen's "Used
 * on", the same places `community_file_in_use()` checks). Null when a list
 * cannot be read.
 */
async function freeable(range: { from: string; until: string }) {
  const [lists, library] = await Promise.all([
    Promise.all(
      datedLists.map(async (kind) => ({
        kind,
        read: await contentEditor().listRecordsDated(kind, range),
      })),
    ),
    photoLibrary(),
  ]);
  if (library.unavailable || lists.some(({ read }) => read.unavailable))
    return null;
  const items = lists.flatMap(({ kind, read }) =>
    read.records
      .filter(
        (record) =>
          record.archived_at && (record.image_path || record.file_path),
      )
      .map((record) => ({
        ...record,
        href: `/admin/content/${kind}/${record.id}`,
      })),
  );
  const theirs = new Set(items.map((item) => item.href));
  const named = new Set(
    items.flatMap((item) => [item.image_path, item.file_path]).filter(Boolean),
  );
  const files = library.files.filter((file) => named.has(file.name));
  const going = files.filter((file) =>
    file.uses.every((use) => theirs.has(use.href)),
  );
  const gone = new Set(going.map((file) => file.name));
  return {
    items: items.filter(
      (item) => gone.has(item.image_path) || gone.has(item.file_path),
    ).length,
    going,
    kept: files.length - going.length,
  };
}

/** Step 1 of "Free up space": what would go, for the confirmation. */
export async function checkFreeUpAction(input: {
  from: string;
  until: string;
}): Promise<FreeUpCheck> {
  const refused = await manager();
  if (refused) return refused;
  const range = termRangeSchema.safeParse(input);
  if (!range.success)
    return { ok: false, error: range.error.issues[0].message };
  const found = await freeable(range.data);
  if (!found) return { ok: false, error: words.unavailable };
  return {
    ok: true,
    files: found.going.length,
    size: sizeLabel(found.going.reduce((sum, file) => sum + file.bytes, 0)),
    items: found.items,
    kept: found.kept,
  };
}

/**
 * Step 2: clears the archived items' photos and PDFs in one database step
 * (`release_archived_files()`, logged per item), then deletes the files
 * nothing names any more; the storage rule keeps any file still in use.
 * "Manage people" only, here and in the database. Only once the board
 * ticked "I opened the zip and can see the photos" (`opened`).
 */
export async function freeUpSpaceAction(input: {
  from: string;
  until: string;
  opened: boolean;
}): Promise<FreeUpResult> {
  const refused = await manager();
  if (refused) return refused;
  if (input.opened !== true) return { ok: false, error: words.openFirst };
  const range = termRangeSchema.safeParse(input);
  if (!range.success)
    return { ok: false, error: range.error.issues[0].message };
  const sizes = await contentEditor().listFiles();
  const released = await contentEditor().releaseArchivedFiles(range.data);
  if (!released.ok)
    return released.reason === "forbidden"
      ? forbidden
      : { ok: false, error: unavailableMessage("free up space") };
  for (const name of released.files) await contentEditor().removeFile(name);
  // Storage answers "ok" even when its rule kept a file: count what is gone.
  const after = await contentEditor().listFiles();
  if (after.unavailable)
    return { ok: true, message: words.freedUncounted, partly: false };
  const left = new Set(after.files.map((file) => file.name));
  const removed = released.files.filter((name) => !left.has(name));
  const bytes = removed.reduce(
    (sum, name) =>
      sum + (sizes.files.find((file) => file.name === name)?.bytes ?? 0),
    0,
  );
  return {
    ok: true,
    message: words.freed(removed.length, sizeLabel(bytes)),
    partly: removed.length < released.files.length,
  };
}
