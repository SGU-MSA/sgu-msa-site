import "server-only";
import { merchCollectionSchema, merchItemSchema } from "../../community/merch";
import type { Clock } from "../../runtime/clock";
import { adminClient } from "../server";
import type {
  MerchEditor,
  VersionedCollection,
  VersionedMerchItem,
} from "./contract";
import { inView, outcome, unavailable } from "./supabase";

/**
 * Merch on Supabase (PR5c), with the person's own session cookie client:
 * RLS (`is_admin()`), the checks (`valid_photo_list`), `archived_read_only`
 * (SGU06), `merch_items_archive_check` (SGU16) and the log trigger decide
 * (migration 202610150001_schema.sql).
 */
const stamps = (row: Record<string, unknown>) => ({
  updated_at: String(row.updated_at),
  archived_at: row.archived_at ? String(row.archived_at) : null,
});
const collectionFrom = (row: Record<string, unknown>): VersionedCollection => ({
  ...merchCollectionSchema.parse(row),
  ...stamps(row),
});
const itemFrom = (row: Record<string, unknown>): VersionedMerchItem => ({
  ...merchItemSchema.parse(row),
  ...stamps(row),
});

type Table = "merch_collections" | "merch_items";

/** `clock` stamps `archived_at`; it comes from the composition point. */
export function createSupabaseMerchEditor(clock: Clock): MerchEditor {
  const setArchived = async <R extends string = never>(
    table: Table,
    id: string,
    version: string,
    archive: boolean,
    refusals: Record<string, R> = {},
  ) => {
    const client = await adminClient();
    if (!client) return unavailable;
    const query = client
      .from(table)
      .update({ archived_at: archive ? clock.now().toISOString() : null })
      .eq("id", id)
      .eq("updated_at", version);
    return outcome(
      await (
        archive
          ? query.is("archived_at", null)
          : query.not("archived_at", "is", null)
      ).select("id"),
      { SGU06: "conflict", ...refusals } as Record<string, R | "conflict">,
    );
  };
  const save = async (
    table: Table,
    row: Record<string, unknown>,
    version: string | null,
  ) => {
    const client = await adminClient();
    if (!client) return unavailable;
    return outcome(
      await (version
        ? client
            .from(table)
            .update(row)
            .eq("id", String(row.id))
            .eq("updated_at", version)
            .select("id")
        : client.from(table).insert(row).select("id")),
      { SGU06: "conflict" } as const,
    );
  };
  return {
    async listCollections(view) {
      const client = await adminClient();
      if (!client) return { collections: [], unavailable: true };
      const { data, error } = await inView(
        client.from("merch_collections").select("*"),
        view,
      )
        .order("position")
        .order("name")
        .limit(200);
      return error
        ? { collections: [], unavailable: true }
        : { collections: (data ?? []).map(collectionFrom), unavailable: false };
    },
    saveCollection: (row, version) => save("merch_collections", row, version),
    archiveCollection: (id, version) =>
      setArchived("merch_collections", id, version, true),
    restoreCollection: (id, version) =>
      setArchived("merch_collections", id, version, false),
    async listItems(view) {
      const client = await adminClient();
      if (!client) return { items: [], unavailable: true };
      const { data, error } = await inView(
        client.from("merch_items").select("*"),
        view,
      )
        .order("position")
        .order("name")
        .limit(500);
      return error
        ? { items: [], unavailable: true }
        : { items: (data ?? []).map(itemFrom), unavailable: false };
    },
    saveItem: (row, version) => save("merch_items", row, version),
    // An item with current sizes is refused (SGU16).
    archiveItem: (id, version) =>
      setArchived("merch_items", id, version, true, {
        SGU16: "in_use",
      } as const),
    restoreItem: (id, version) =>
      setArchived("merch_items", id, version, false),
  };
}
