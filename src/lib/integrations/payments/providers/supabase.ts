import "server-only";
import { publicClient } from "@/lib/backend/server";
import {
  currentLinks,
  paymentItemFromRow,
  paymentItemLinkSchema,
  slugPattern,
} from "../../../community/payments";
import { seasonFromRow } from "../../../community/seasons";
import {
  merchCollectionSchema,
  merchItemSchema,
} from "../../../community/merch";
import type { PaymentsProvider } from "./contract";

/**
 * The giving rows on Supabase (PR6) with the anonymous client: the read
 * policies decide (current listed items and their links, current seasons).
 * The same filters are repeated here so a looser policy never widens a read.
 * Every read is fresh (`no-store`, 3 s); no client or an error reads as
 * unavailable, never as an empty but healthy source.
 */
const provenance = "live" as const;

export const supabasePaymentsProvider: PaymentsProvider = {
  async items() {
    const client = publicClient();
    if (!client) return { items: [], links: [], unavailable: true, provenance };
    try {
      const [items, links] = await Promise.all([
        client
          .from("payment_items")
          .select("*")
          .is("archived_at", null)
          .eq("listed", true)
          .order("position")
          .limit(500),
        client.from("payment_item_links").select("*").limit(2000),
      ]);
      if (items.error || links.error) throw items.error ?? links.error;
      return {
        items: (items.data ?? []).map(paymentItemFromRow),
        links: (links.data ?? []).map((row) =>
          paymentItemLinkSchema.parse(row),
        ),
        unavailable: false,
        provenance,
      };
    } catch {
      return { items: [], links: [], unavailable: true, provenance };
    }
  },
  async itemBySlug(slug) {
    if (!slugPattern.test(slug)) return { found: null, unavailable: false };
    const client = publicClient();
    if (!client) return { found: null, unavailable: true };
    try {
      const { data, error } = await client
        .from("payment_items")
        .select("*")
        .eq("slug", slug)
        .is("archived_at", null)
        .eq("listed", true)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { found: null, unavailable: false };
      const item = paymentItemFromRow(data);
      const links = await client
        .from("payment_item_links")
        .select("*")
        .eq("payment_item_id", item.id);
      if (links.error) throw links.error;
      const link =
        currentLinks(
          (links.data ?? []).map((row) => paymentItemLinkSchema.parse(row)),
        ).get(item.id) ?? null;
      return { found: { item, link }, unavailable: false };
    } catch {
      return { found: null, unavailable: true };
    }
  },
  async seasons() {
    const client = publicClient();
    if (!client) return { seasons: [], unavailable: true, provenance };
    try {
      const { data, error } = await client
        .from("seasons")
        .select("*")
        .is("archived_at", null)
        .order("name")
        .limit(200);
      if (error) throw error;
      return {
        seasons: (data ?? []).map(seasonFromRow),
        unavailable: false,
        provenance,
      };
    } catch {
      return { seasons: [], unavailable: true, provenance };
    }
  },
  async merch() {
    const none = { collections: [], items: [], unavailable: true };
    const client = publicClient();
    if (!client) return none;
    try {
      const [collections, items] = await Promise.all([
        client
          .from("merch_collections")
          .select("*")
          .is("archived_at", null)
          .order("position")
          .limit(200),
        client
          .from("merch_items")
          .select("*")
          .is("archived_at", null)
          .order("position")
          .limit(500),
      ]);
      if (collections.error || items.error)
        throw collections.error ?? items.error;
      const current = (collections.data ?? []).map((row) =>
        merchCollectionSchema.parse(row),
      );
      const ids = new Set(current.map((row) => row.id));
      return {
        collections: current,
        items: (items.data ?? [])
          .map((row) => merchItemSchema.parse(row))
          .filter((item) => ids.has(item.collection_id)),
        unavailable: false,
      };
    } catch {
      return none;
    }
  },
};
