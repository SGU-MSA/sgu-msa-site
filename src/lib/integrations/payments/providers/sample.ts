import "server-only";
import { currentLinks, slugPattern } from "../../../community/payments";
import { sandboxStore } from "../../../demo/store";
import type { PaymentsProvider } from "./contract";

/**
 * The sandbox's giving rows (PR6), read from the in-memory store, as a
 * visitor's read policies would: current listed items and their links,
 * current seasons, current merch collections and their current items.
 */
export function createSamplePaymentsProvider(seed: Date): PaymentsProvider {
  const instant = new Date(seed);
  const store = () => sandboxStore(instant);
  const current = () =>
    [...store().paymentItems.values()].filter(
      (row) => !row.archived_at && row.listed,
    );
  const strip = <T extends { updated_at: string; archived_at: unknown }>(
    row: T,
  ) => {
    const copy = structuredClone(row) as Partial<T>;
    delete copy.updated_at;
    delete copy.archived_at;
    return copy as Omit<T, "updated_at" | "archived_at">;
  };
  return {
    async items() {
      const items = current();
      const ids = new Set(items.map((item) => item.id));
      return {
        items: items.map(strip),
        links: store()
          .paymentLinks.filter((link) => ids.has(link.payment_item_id))
          .map((link) => ({ ...link })),
        unavailable: false,
        provenance: "sample",
      };
    },
    async itemBySlug(slug) {
      const item = slugPattern.test(slug)
        ? current().find((row) => row.slug === slug)
        : undefined;
      if (!item) return { found: null, unavailable: false };
      const link =
        currentLinks(
          store().paymentLinks.filter((l) => l.payment_item_id === item.id),
        ).get(item.id) ?? null;
      return {
        found: { item: strip(item), link: link && { ...link } },
        unavailable: false,
      };
    },
    async seasons() {
      return {
        seasons: [...store().seasons.values()]
          .filter((row) => !row.archived_at)
          .map(strip),
        unavailable: false,
        provenance: "sample",
      };
    },
    async merch() {
      const collections = [...store().merchCollections.values()].filter(
        (row) => !row.archived_at,
      );
      const ids = new Set(collections.map((row) => row.id));
      return {
        collections: collections.map(strip),
        items: [...store().merchItems.values()]
          .filter((row) => !row.archived_at && ids.has(row.collection_id))
          .map(strip),
        unavailable: false,
      };
    },
  };
}
