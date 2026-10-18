import { z } from "../validation/zod";
import { dateSchema } from "../validation/date-time";
import { outOfDate } from "../system-text";

/**
 * Funds and priced items (PR6 contract, D-58, D-59, D-65, D-77; ADR 0019):
 * the board's rows, the Go2Pay product each links to, the Go2Pay orders read
 * live for money holders, and the data shape the Donate page renders (the
 * "Track B data shape"). Shapes only: the fixed rules are in
 * `payment-policy.ts`, and the migration `202610150001_schema.sql`
 * is the authority. Pure: no clock, no I/O.
 */

export const categories = [
  "zakat_al_fitr",
  "zakat_al_mal",
  "sadaqah",
  "general",
] as const;
export const categorySchema = z.enum(categories);
export type Category = z.infer<typeof categorySchema>;

/** A fund (any amount, in Go2Pay's donation box) or a priced item (tickets, merch sizes). */
export const kinds = ["fund", "priced"] as const;
export type Kind = (typeof kinds)[number];

const filled = (field: string) => `${field}: fill in this box.`;
const atMost = (field: string, count: number) =>
  `${field}: use ${count} characters or fewer.`;
/** "" in the app, null in the database. */
const optionalDate = dateSchema.or(z.literal("")).default("");
/** Lowercase letters and digits joined by single hyphens; made once by `slugFor`. */
export const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const SLUG_MAX = 60;

export const paymentItemSchema = z
  .object({
    id: z.uuid(),
    /** The Give address `/donate/<slug>/give`; never changes (database trigger). */
    slug: z.string().regex(slugPattern, outOfDate).max(SLUG_MAX, outOfDate),
    name: z.string().trim().min(1, filled("Name")).max(80, atMost("Name", 80)),
    // No defaults (D-29): the board chooses both.
    kind: z.enum(kinds),
    category: categorySchema,
    /** "About this fund": one short sentence; required for both zakat categories (`readyToList`). */
    about: z.string().trim().max(300, atMost("About this fund", 300)),
    /** Optional heading above the slip (D-77); "" = no heading. Funds only. */
    heading: z.string().trim().max(40, atMost("Heading", 40)).default(""),
    listed: z.boolean(),
    position: z.number().int().min(-2147483648).max(2147483647),
    season_id: z.uuid().or(z.literal("")).default(""),
    /** The Hijri year of the season occurrence it runs for (D-14); null = the current one. */
    season_year: z.number().int().min(1400).max(1600).nullable().default(null),
    shows_from: optionalDate,
    shows_until: optionalDate,
    /** Set only by the database the first time a fund is listed (the category lock, D-61). */
    first_shown_at: z.string().nullable().default(null),
    /** A merch size (PR5c, D-27 a): the merch item it is a size of, or "". */
    merch_item_id: z.uuid().or(z.literal("")).default(""),
    /** The size's label ("M"); "" for anything that is not a merch size. */
    size_label: z.string().trim().max(20, atMost("Size", 20)).default(""),
  })
  .refine((item) => item.kind === "fund" || item.category === "general", {
    message: "Tickets and merch are always General money.",
    path: ["category"],
  })
  .refine((item) => item.kind === "fund" || item.heading === "", {
    message: "Headings are for Donate page funds only.",
    path: ["heading"],
  })
  .refine(
    (item) =>
      !item.shows_from ||
      !item.shows_until ||
      item.shows_until >= item.shows_from,
    {
      message: "Show until: choose a day on or after Show from.",
      path: ["shows_until"],
    },
  )
  .refine((item) => !item.merch_item_id || item.size_label !== "", {
    message: filled("Size"),
    path: ["size_label"],
  })
  .refine((item) => item.merch_item_id !== "" || item.size_label === "", {
    message: "Size: only a merch item has sizes.",
    path: ["size_label"],
  })
  .refine(
    (item) =>
      !item.merch_item_id || (item.kind === "priced" && !item.season_id),
    { message: "A merch size is sold like a ticket.", path: ["kind"] },
  );
export type PaymentItem = z.infer<typeof paymentItemSchema>;

const nullableItemColumns = [
  "season_id",
  "shows_from",
  "shows_until",
  "merch_item_id",
  "size_label",
] as const;

/** The one parse of a `payment_items` row: null season and days read as "". */
export function paymentItemFromRow(row: Record<string, unknown>): PaymentItem {
  const values: Record<string, unknown> = { ...row };
  for (const column of nullableItemColumns) values[column] = row[column] ?? "";
  return paymentItemSchema.parse(values);
}

/**
 * An item as the board writes it: "" becomes null, and `first_shown_at` is
 * never sent (the database sets it).
 */
export function paymentItemToRow(item: PaymentItem): Record<string, unknown> {
  const row: Record<string, unknown> = { ...item };
  delete row.first_shown_at;
  for (const column of nullableItemColumns) row[column] = item[column] || null;
  return row;
}

/** One `payment_item_links` row: add-only; an item's newest row is its current Go2Pay page (D-17). */
export const paymentItemLinkSchema = z.object({
  go2pay_product_id: z.coerce.number().int().positive(),
  payment_item_id: z.uuid(),
  added_at: z.string(),
});
export type PaymentItemLink = z.infer<typeof paymentItemLinkSchema>;

/** Each item's current link: its newest row. */
export function currentLinks(
  links: readonly PaymentItemLink[],
): Map<string, PaymentItemLink> {
  const current = new Map<string, PaymentItemLink>();
  for (const link of links) {
    const known = current.get(link.payment_item_id);
    if (!known || Date.parse(link.added_at) > Date.parse(known.added_at))
      current.set(link.payment_item_id, link);
  }
  return current;
}

// Go2Pay sends amounts as text ("4.00"); kept in whole cents.
const cents = z
  .union([z.string(), z.number()])
  .nullable()
  .transform((value, ctx) => {
    if (value === null || value === "") return 0;
    const amount = Math.round(Number(value) * 100);
    if (Number.isFinite(amount)) return amount;
    ctx.addIssue({ code: "custom", message: "not an amount" });
    return z.NEVER;
  });
const text = z
  .string()
  .nullable()
  .optional()
  .transform((value) => value?.trim() ?? "");

/**
 * The fields of a Go2Pay order the Payments screen needs, and nothing else:
 * every other field (address, IP, payment secrets, bank ids) is dropped at
 * the parse. Names and notes are shown to money holders on screen only and
 * are never stored, cached or logged (D-2, D-3, D-64).
 */
export const go2payOrderSchema = z.object({
  id: z.coerce.number().int(),
  product_id: z.coerce.number().int(),
  first_name: text,
  last_name: text,
  qty: z.coerce.number().int().catch(1),
  /** price × qty + donation: the gift (D-38). */
  subtotal: cents,
  /** What the buyer paid, card fee included. */
  customer_total: cents,
  refunded: cents,
  status: z.string(),
  /** The giver's optional "Note for Vendor" (D-64). */
  note: text,
  /** Grenada time, for example "2026-10-04 10:30:00" or with a -04:00 offset. */
  created: z.string(),
  test_mode: z
    .union([z.boolean(), z.number(), z.string()])
    .nullable()
    .optional()
    .transform((value) => value === true || value === 1 || value === "1"),
});
export type Go2PayOrder = z.infer<typeof go2payOrderSchema>;

/**
 * One slip on the Donate page: every word is worked out by `donateSlip`, so
 * the slip component computes nothing and never branches on the category for
 * wording (the category only picks the tag style).
 */
export const donateSlipSchema = z.object({
  slug: z.string(),
  title: z.string(),
  category: categorySchema,
  /** "Zakat al-Fitr" | "Zakat al-Mal" | "Sadaqah" | "General". */
  tag: z.string(),
  /** Zakat categories only. */
  ruleLine: z.string().nullable(),
  /** The board's sentence ("About this fund"), or null. */
  about: z.string().nullable(),
  /** D-77: null = no heading (the default). */
  heading: z.string().nullable(),
  /** "Closes today" | "Closes tomorrow" | "Closes in 2 days", shown with a clock icon. */
  closingSoon: z.string().nullable(),
  /** Open in a new tab (`target="_blank" rel="noopener"`); never a Go2Pay address. */
  giveHref: z.templateLiteral(["/donate/", z.string(), "/give"]),
});
export type DonateSlip = z.infer<typeof donateSlipSchema>;

/** A run of slips under one heading (null = no heading drawn), in `donateOrder`. */
export const donateGroupSchema = z.object({
  heading: z.string().nullable(),
  slips: z.array(donateSlipSchema),
});
export type DonateGroup = z.infer<typeof donateGroupSchema>;

export const donatePageDataSchema = z.discriminatedUnion("state", [
  z.object({
    state: z.literal("ready"),
    /** "Payments are made on Go2Pay, …" near the top (review fixes P4; `FEE_LINE`). */
    notice: z.string(),
    intentionLine: z.string(),
    groups: z.array(donateGroupSchema),
    /** The giving fine print (D-31). */
    finePrint: z.array(z.string()),
  }),
  z.object({ state: z.literal("empty"), finePrint: z.array(z.string()) }),
  /** "Giving details could not be loaded right now." */
  z.object({ state: z.literal("unavailable") }),
]);
export type DonatePageData = z.infer<typeof donatePageDataSchema>;

/**
 * A ticket's button on its event page (P-72 B): no price and no "Sold out"
 * on our pages; the button reads "See price and buy ↗" and opens Give in a
 * new tab, where Go2Pay shows the price and stock.
 */
export type PricedItemButton = {
  slug: string;
  title: string;
  giveHref: `/donate/${string}/give`;
};
