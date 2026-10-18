import "server-only";
import {
  currentLinks,
  paymentItemFromRow,
  paymentItemLinkSchema,
  paymentItemToRow,
  type PaymentItemLink,
} from "../../community/payments";
import type { Clock } from "../../runtime/clock";
import { adminClient } from "../server";
import type { PaymentItemEditor, VersionedPaymentItem } from "./contract";
import { inView, outcome, unavailable } from "./supabase";

/**
 * Funds, priced items and their Go2Pay links on Supabase (PR6 WP-4), with the
 * person's own session cookie client: RLS (`is_admin()`), the checks, the
 * category lock (`fund_category_lock`, SGU10), `archived_read_only` (SGU06)
 * and the log trigger decide (migration 202610150001_schema.sql). No Go2Pay call.
 */
const versioned = (row: Record<string, unknown>): VersionedPaymentItem => ({
  ...paymentItemFromRow(row),
  updated_at: String(row.updated_at),
  archived_at: row.archived_at ? String(row.archived_at) : null,
});
const linkFrom = (row: Record<string, unknown>) =>
  paymentItemLinkSchema.parse(row);

const itemRefusals = {
  "23505": "slug_taken",
  "42501": "forbidden",
  SGU10: "fund_locked",
  SGU06: "conflict",
} as const;

/** `clock` stamps `archived_at`; it comes from the composition point. */
export function createSupabasePaymentItemEditor(
  clock: Clock,
): PaymentItemEditor {
  const readLinks = async (
    client: NonNullable<Awaited<ReturnType<typeof adminClient>>>,
    itemIds: string[],
  ): Promise<PaymentItemLink[] | null> => {
    if (!itemIds.length) return [];
    const { data, error } = await client
      .from("payment_item_links")
      .select("*")
      .in("payment_item_id", itemIds)
      .order("added_at", { ascending: false });
    return error ? null : (data ?? []).map(linkFrom);
  };
  const setArchived = async (id: string, version: string, archive: boolean) => {
    const client = await adminClient();
    if (!client) return unavailable;
    const query = client
      .from("payment_items")
      .update({ archived_at: archive ? clock.now().toISOString() : null })
      .eq("id", id)
      .eq("updated_at", version);
    return outcome(
      await (
        archive
          ? query.is("archived_at", null)
          : query.not("archived_at", "is", null)
      ).select("id"),
    );
  };
  return {
    async listItems(view) {
      const client = await adminClient();
      if (!client) return { items: [], links: [], unavailable: true };
      const { data, error } = await inView(
        client.from("payment_items").select("*"),
        view,
      )
        .order("position")
        .order("name")
        .limit(500);
      if (error) return { items: [], links: [], unavailable: true };
      const items = (data ?? []).map(versioned);
      const links = await readLinks(
        client,
        items.map((item) => item.id),
      );
      return links
        ? { items, links, unavailable: false }
        : { items: [], links: [], unavailable: true };
    },
    async readItem(id) {
      const client = await adminClient();
      if (!client) return { item: null, links: [], unavailable: true };
      const { data, error } = await client
        .from("payment_items")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) return { item: null, links: [], unavailable: true };
      if (!data) return { item: null, links: [], unavailable: false };
      const links = await readLinks(client, [id]);
      return links
        ? { item: versioned(data), links, unavailable: false }
        : { item: null, links: [], unavailable: true };
    },
    async saveItem(row, version, link) {
      const client = await adminClient();
      if (!client) return unavailable;
      if (link !== null) {
        // D-17: a product already linked to an item is refused before anything is written.
        const { data, error } = await client
          .from("payment_item_links")
          .select("*")
          .eq("go2pay_product_id", link)
          .maybeSingle();
        if (error) return unavailable;
        if (data) {
          const owned = linkFrom(data);
          if (owned.payment_item_id !== row.id)
            return { ok: false, reason: "link_taken" };
          const links = await readLinks(client, [row.id]);
          if (!links) return unavailable;
          if (currentLinks(links).get(row.id)?.go2pay_product_id !== link)
            return { ok: false, reason: "link_used_before" };
          link = null; // Already this item's current link.
        }
      }
      const payload = paymentItemToRow(row);
      // The Give address is made once and never sent again (the trigger refuses a change).
      if (version) delete payload.slug;
      const saved = outcome(
        await (version
          ? client
              .from("payment_items")
              .update(payload)
              .eq("id", row.id)
              .eq("updated_at", version)
              .select("id")
          : client.from("payment_items").insert(payload).select("id")),
        itemRefusals,
      );
      if (!saved.ok || link === null) return saved;
      return outcome(
        await client
          .from("payment_item_links")
          .insert({ go2pay_product_id: link, payment_item_id: row.id })
          .select("go2pay_product_id"),
        { "23505": "link_taken", "42501": "forbidden" } as const,
      );
    },
    archiveItem: (id, version) => setArchived(id, version, true),
    restoreItem: (id, version) => setArchived(id, version, false),
  };
}
