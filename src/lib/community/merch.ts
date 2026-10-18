import { z } from "../validation/zod";
import { MERCH_PHOTOS_MAX } from "../media/photo-limits";
import { photoListSchema, type ListedPhoto } from "../media/photo-list";

/**
 * Merch (PR5c, D-9, D-14, D-27; P-72 B): collections, their items with
 * ordered photos (the first is the cover), and each item's sizes, which are
 * priced items (`payment_items.merch_item_id`, one Go2Pay product each, made
 * by hand). Price, stock and Sold out live only in Go2Pay: the site shows
 * "See price and buy ↗" per size. Shapes and the public page's view; the
 * migration `202610150001_schema.sql` is the authority. Pure.
 */

const filled = (field: string) => `${field}: fill in this box.`;
const atMost = (field: string, count: number) =>
  `${field}: use ${count} characters or fewer.`;
const optional = (field: string, count: number) =>
  z.string().trim().max(count, atMost(field, count)).default("");

/** A collection is on sale now ("current") or shown as an archive ("past"). */
export const eras = ["current", "past"] as const;
export type Era = (typeof eras)[number];

export const merchCollectionSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1, filled("Name")).max(80, atMost("Name", 80)),
  arabic: optional("Arabic name", 80),
  quote: optional("Quote", 200),
  year: optional("Year", 20),
  description: optional("Description", 1000),
  era: z.enum(eras, { error: "On sale: choose Yes or No." }),
  position: z.number().int().min(-2147483648).max(2147483647),
});
export type MerchCollection = z.infer<typeof merchCollectionSchema>;

export const merchItemSchema = z.object({
  id: z.uuid(),
  collection_id: z.uuid({ error: "Collection: choose one." }),
  name: z.string().trim().min(1, filled("Name")).max(80, atMost("Name", 80)),
  description: optional("Description", 1000),
  garment: optional("Garment", 60),
  colorway: optional("Colour", 60),
  photos: photoListSchema(MERCH_PHOTOS_MAX),
  position: z.number().int().min(-2147483648).max(2147483647),
});
export type MerchItem = z.infer<typeof merchItemSchema>;

/** One size button: its label and its Give address (never a Go2Pay address). */
export type MerchSize = {
  label: string;
  giveHref: `/donate/${string}/give`;
};

/** An item as the public page draws it. */
export type MerchItemView = Pick<
  MerchItem,
  "id" | "name" | "description" | "garment" | "colorway"
> & {
  photos: ListedPhoto[];
  /** On sale now, in the board's order; empty for a past collection. */
  sizes: MerchSize[];
};

/** A collection as the public page draws it. */
export type MerchCollectionView = Pick<
  MerchCollection,
  "id" | "name" | "arabic" | "quote" | "year" | "description" | "era"
> & { items: MerchItemView[] };

/** The `/merch` page's data: the lead collection and every other one, in order. */
export type MerchPageData =
  | {
      state: "ready";
      /** The first current collection, which leads the page. */
      lead: MerchCollectionView | null;
      others: MerchCollectionView[];
    }
  | { state: "unavailable" };

type Ordered = { position: number; name: string };
const byOrder = (a: Ordered, b: Ordered) =>
  a.position - b.position || a.name.localeCompare(b.name);

/**
 * The public merch page (D-27): current collections and items in the
 * board's order; sizes only for items of a current collection, only the
 * ones open now (`openSizes`, by item id, already in order).
 */
export function merchPage(
  collections: readonly MerchCollection[],
  items: readonly MerchItem[],
  openSizes: ReadonlyMap<string, MerchSize[]>,
): MerchPageData {
  const views = [...collections]
    .sort(byOrder)
    .map((collection): MerchCollectionView => ({
      id: collection.id,
      name: collection.name,
      arabic: collection.arabic,
      quote: collection.quote,
      year: collection.year,
      description: collection.description,
      era: collection.era,
      items: items
        .filter((item) => item.collection_id === collection.id)
        .sort(byOrder)
        .map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          garment: item.garment,
          colorway: item.colorway,
          photos: item.photos,
          sizes:
            collection.era === "current" ? (openSizes.get(item.id) ?? []) : [],
        })),
    }));
  const lead = views.find((view) => view.era === "current") ?? null;
  return {
    state: "ready",
    lead,
    others: views.filter((view) => view !== lead),
  };
}

/**
 * The name a size is saved under (Payments, Recent changes): the item's
 * name and the size, at most 80 characters ("Shukr long-sleeve · M").
 */
export function sizeItemName(itemName: string, size: string): string {
  const suffix = ` · ${size.trim()}`;
  return (
    itemName
      .trim()
      .slice(0, 80 - suffix.length)
      .trimEnd() + suffix
  );
}
