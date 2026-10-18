import {
  developerOwnedPaths,
  isPageTextKey,
  parseEditorialDocument,
  withDeveloperParts,
  unreadableEditorialDocument,
  type EditorialKey,
} from "../documents";
import type { EditorialSource } from "./contract";

/** The part of a Supabase client this adapter uses (a test passes a stub). */
export type PageTextReader = {
  from(table: "page_texts"): {
    select(columns: "key, document"): PromiseLike<{
      data: { key: string; document: unknown }[] | null;
      error: unknown;
    }>;
  };
};

/**
 * Page text from Supabase (PR5b): one `public.page_texts` row per document,
 * read with the public client (3 s, no-store; RLS lets everyone read). All
 * rows come in one request, once per source; the composition point makes a
 * source per request, so every page reads current text without a rebuild.
 * The document that is not page text (`reminders`, the dhikr and tasbih)
 * come from `others`, the YAML adapter, as do the developer-owned parts of
 * page text (menu, footer, logo, filter lists: `developerOwnedPaths`), so a
 * developer changes them in YAML and they show even while the database is
 * down. A missing table, row or connection gives the documented fallback
 * with `unavailable` (Failure Modes).
 */
export function createSupabaseEditorialSource(
  client: () => PageTextReader | null,
  others: EditorialSource,
): EditorialSource {
  let rows: Promise<Map<string, unknown> | null> | null = null;
  const load = () =>
    (rows ??= (async () => {
      const reader = client();
      if (!reader) return null;
      try {
        const { data, error } = await reader
          .from("page_texts")
          .select("key, document");
        if (error || !data) return null;
        return new Map(data.map((row) => [row.key, row.document]));
      } catch {
        return null;
      }
    })());
  return {
    async get<K extends EditorialKey>(key: K) {
      if (!isPageTextKey(key)) return others.get(key);
      const source = `page_texts "${key}"`;
      const all = await load();
      const read = !all
        ? unreadableEditorialDocument(
            key,
            source,
            "the database could not be read",
          )
        : all.has(key)
          ? parseEditorialDocument(key, all.get(key), source)
          : unreadableEditorialDocument(key, source, "no row");
      if (!developerOwnedPaths[key]) return { ...read, provenance: "live" };
      const developer = await others.get(key);
      return {
        ...read,
        document: developer.unavailable
          ? read.document
          : withDeveloperParts(key, read.document, developer.document),
        provenance: "live" as const,
      };
    },
  };
}
