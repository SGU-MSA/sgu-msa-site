import type { Collection } from "@/lib/community/schema";
import type { PageTextKey } from "@/lib/content/documents";
import { pageFields, photosIn } from "@/lib/content/page-fields";
import { systemText } from "@/lib/system-text";
import { pageScreenPath } from "../pages/pages-list";

const words = systemText.photos;

/** One place a stored file is used, as the Photos screen names and links it. */
export type FileUse = { label: string; href: string };

/**
 * Every row that can name a stored file, current and archived: the same
 * places `community_file_in_use()` checks (the storage rule that keeps a
 * used file from being deleted).
 */
export type UseSources = {
  records: readonly {
    kind: Collection;
    id: string;
    title: string;
    image_path: string;
    file_path: string;
    archived_at: string | null;
  }[];
  people: readonly {
    id: string;
    full_name: string;
    photo_path: string | null;
    archived_at: string | null;
  }[];
  pages: readonly { key: PageTextKey; document: unknown }[];
  /** PR5c: season pages' and merch items' photo lists. */
  seasons: readonly PhotoListRow[];
  merchItems: readonly PhotoListRow[];
};

type PhotoListRow = {
  id: string;
  name: string;
  photos: unknown;
  archived_at: string | null;
};

/**
 * Where each stored file is used (photo library, 2026-10-06), by file name:
 * an item's picture or PDF, a person's photo, or a photo a page's text
 * names, or a season page's or merch item's photo. Pure; a file no row
 * names is not in the map.
 */
export function fileUses(sources: UseSources): Map<string, FileUse[]> {
  const uses = new Map<string, FileUse[]>();
  const add = (name: string | null, use: FileUse) => {
    if (!name) return;
    const list = uses.get(name) ?? [];
    if (!list.some((known) => known.href === use.href)) list.push(use);
    uses.set(name, list);
  };
  const named = (kind: string, name: string, archived: boolean) =>
    `${kind}: ${name}${archived ? ` ${words.archived}` : ""}`;
  for (const record of sources.records) {
    const use = {
      label: named(words.use[record.kind], record.title, !!record.archived_at),
      href: `/admin/content/${record.kind}/${record.id}`,
    };
    add(record.image_path, use);
    add(record.file_path, use);
  }
  for (const person of sources.people)
    add(person.photo_path, {
      label: named(words.use.person, person.full_name, !!person.archived_at),
      href: `/admin/people/${person.id}`,
    });
  for (const page of sources.pages)
    for (const name of photosIn(page.document))
      add(name, {
        label: named(words.use.page, pageFields[page.key].title, false),
        href: pageScreenPath(page.key),
      });
  const lists = [
    { rows: sources.seasons, kind: words.use.season, at: "/admin/seasons" },
    {
      rows: sources.merchItems,
      kind: words.use.merch,
      at: "/admin/merch/items",
    },
  ];
  for (const { rows, kind, at } of lists)
    for (const row of rows)
      for (const name of photosIn(row.photos))
        add(name, {
          label: named(kind, row.name, !!row.archived_at),
          href: `${at}/${row.id}`,
        });
  return uses;
}
