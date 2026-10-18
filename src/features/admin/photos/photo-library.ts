import "server-only";
import {
  listAdminFiles,
  listAdminPeople,
  listAdminRecords,
  readAdminPageText,
} from "@/lib/backend/admin-content";
import { listAdminSeasons } from "@/lib/backend/admin-payments";
import type { StoredFile } from "@/lib/backend/providers/contract";
import { collections } from "@/lib/community/schema";
import { pageTextKeys } from "@/lib/content/documents";
import { merchEditor } from "@/lib/runtime/providers";
import { fileUses, type FileUse } from "./photo-uses";

export type LibraryFile = StoredFile & {
  kind: "photo" | "pdf";
  uses: FileUse[];
};

/**
 * The Photos screen and the photo chooser (photo library, 2026-10-06): every
 * stored file, newest first, with where it is used and the space they take
 * together. Reads every item, person, page text, season and merch item,
 * current and archived, as any board member may; `unavailable` when any of
 * them cannot be read (a file must never look unused because a list failed
 * to load).
 */
export async function photoLibrary(): Promise<
  | { unavailable: true }
  | { unavailable: false; files: LibraryFile[]; bytes: number }
> {
  const views = ["current", "archived"] as const;
  const [stored, records, people, pages, seasons, merchItems] =
    await Promise.all([
      listAdminFiles(),
      Promise.all(
        collections.flatMap((kind) =>
          views.map(async (view) => ({
            kind,
            read: await listAdminRecords(kind, view),
          })),
        ),
      ),
      Promise.all(views.map((view) => listAdminPeople(view))),
      Promise.all(
        pageTextKeys.map(async (key) => ({
          key,
          read: await readAdminPageText(key),
        })),
      ),
      Promise.all(views.map((view) => listAdminSeasons(view))),
      Promise.all(views.map((view) => merchEditor().listItems(view))),
    ]);
  if (
    stored.unavailable ||
    records.some(({ read }) => read.unavailable) ||
    people.some((read) => read.unavailable) ||
    pages.some(({ read }) => !read) ||
    seasons.some((read) => read.unavailable) ||
    merchItems.some((read) => read.unavailable)
  )
    return { unavailable: true };
  const uses = fileUses({
    records: records.flatMap(({ kind, read }) =>
      read.records.map((record) => ({
        kind,
        id: record.id,
        title: record.title,
        image_path: record.image_path,
        file_path: record.file_path,
        archived_at: record.archived_at,
      })),
    ),
    people: people.flatMap((read) => read.people),
    pages: pages.map(({ key, read }) => ({ key, document: read!.document })),
    seasons: seasons.flatMap((read) => read.seasons),
    merchItems: merchItems.flatMap((read) => read.items),
  });
  return {
    unavailable: false,
    files: stored.files.map((file) => ({
      ...file,
      kind: file.name.endsWith(".pdf") ? "pdf" : "photo",
      uses: uses.get(file.name) ?? [],
    })),
    bytes: stored.files.reduce((sum, file) => sum + file.bytes, 0),
  };
}
