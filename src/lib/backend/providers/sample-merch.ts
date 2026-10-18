import "server-only";
import { merchCollectionSchema, merchItemSchema } from "../../community/merch";
import {
  nextVersion,
  recordActivity,
  sandboxActor,
  sandboxStore,
} from "../../demo/store";
import type { ListView, MerchEditor, WriteResult } from "./contract";

/**
 * Sandbox merch over the in-memory store (PR5c), with the declared mirrors
 * of the database rules: admins only, the `updated_at` check, archived rows
 * read-only until restored, no delete; and activity appended as the trigger
 * does.
 */
const conflict = { ok: false, reason: "conflict" } as const;

const inView = (row: { archived_at: string | null }, view: ListView) =>
  Boolean(row.archived_at) === (view === "archived");

type Row = { id: string; updated_at: string; archived_at: string | null };

export function createSampleMerchEditor(seed: Date): MerchEditor {
  const instant = new Date(seed);
  const store = () => sandboxStore(instant);
  const tables = () => ({
    merch_collections: store().merchCollections as Map<string, Row>,
    merch_items: store().merchItems as Map<string, Row>,
  });

  function save<T extends { id: string }>(
    table: "merch_collections" | "merch_items",
    row: T,
    version: string | null,
  ): WriteResult {
    const sandbox = store();
    if (!sandboxActor(sandbox)) return conflict;
    const map = tables()[table];
    const existing = map.get(row.id) ?? null;
    if (
      version === null
        ? existing
        : existing?.updated_at !== version || existing.archived_at
    )
      return conflict;
    const after = {
      ...structuredClone(row),
      archived_at: null,
      updated_at: nextVersion(),
    };
    map.set(row.id, after);
    recordActivity(sandbox, instant, table, existing, after);
    return { ok: true };
  }

  function setArchived(
    table: "merch_collections" | "merch_items",
    id: string,
    version: string,
    archive: boolean,
  ): WriteResult {
    const sandbox = store();
    const map = tables()[table];
    const existing = map.get(id);
    if (
      !sandboxActor(sandbox) ||
      existing?.updated_at !== version ||
      Boolean(existing.archived_at) === archive
    )
      return conflict;
    const after = {
      ...existing,
      archived_at: archive ? instant.toISOString() : null,
      updated_at: nextVersion(),
    };
    map.set(id, after);
    recordActivity(sandbox, instant, table, existing, after);
    return { ok: true };
  }

  const ordered = <T extends { position: number; name: string }>(rows: T[]) =>
    rows.sort(
      (a, b) => a.position - b.position || a.name.localeCompare(b.name),
    );

  return {
    async listCollections(view = "current") {
      return {
        collections: ordered(
          [...store().merchCollections.values()]
            .filter((row) => inView(row, view))
            .map((row) => structuredClone(row)),
        ),
        unavailable: false,
      };
    },
    async saveCollection(row, version) {
      const parsed = merchCollectionSchema.safeParse(row);
      if (!parsed.success) return { ok: false, reason: "unavailable" };
      return save("merch_collections", parsed.data, version);
    },
    archiveCollection: async (id, version) =>
      setArchived("merch_collections", id, version, true),
    restoreCollection: async (id, version) =>
      setArchived("merch_collections", id, version, false),
    async listItems(view = "current") {
      return {
        items: ordered(
          [...store().merchItems.values()]
            .filter((row) => inView(row, view))
            .map((row) => structuredClone(row)),
        ),
        unavailable: false,
      };
    },
    async saveItem(row, version) {
      const parsed = merchItemSchema.safeParse(row);
      if (!parsed.success) return { ok: false, reason: "unavailable" };
      if (!store().merchCollections.has(parsed.data.collection_id))
        return { ok: false, reason: "unavailable" };
      return save("merch_items", parsed.data, version);
    },
    // SGU16: an item with current sizes stays until its sizes are archived.
    archiveItem: async (id, version) =>
      [...store().paymentItems.values()].some(
        (size) => size.merch_item_id === id && !size.archived_at,
      ) && store().merchItems.get(id)?.updated_at === version
        ? { ok: false, reason: "in_use" }
        : setArchived("merch_items", id, version, true),
    restoreItem: async (id, version) =>
      setArchived("merch_items", id, version, false),
  };
}
