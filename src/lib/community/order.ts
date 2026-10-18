import { z } from "../validation/zod";

/**
 * Board-ordered lists (review fixes PR-2): the board drags rows into order
 * and saves the whole list at once; the rows then hold order numbers 1, 2,
 * 3 … (`public.save_order`, `supabase/migrations/202610150001_schema.sql`).
 * Nobody types an order number. Pure: no clock, no I/O.
 */

/** The tables a "Save order" may change, as `public.save_order` names them. */
export const orderedLists = [
  "people",
  "people_sections",
  "payment_items",
  "handover_steps",
  "merch_collections",
  "merch_items",
  // Review fixes P3: the Lists (`202610160002_lists.sql`).
  "list_options",
] as const;
export type OrderedList = (typeof orderedLists)[number];

/** The most rows one save may order (the database refuses more). */
export const MAX_ORDERED_ROWS = 500;

/**
 * A saved order as the screen posts it: every row once, top to bottom, with
 * the version the screen showed (`updated_at`), so a list someone else
 * changed meanwhile is refused instead of overwritten.
 */
export const savedOrderSchema = z
  .array(z.object({ id: z.uuid(), version: z.string().min(1) }))
  .min(1)
  .max(MAX_ORDERED_ROWS)
  .refine(
    (rows) => new Set(rows.map((row) => row.id)).size === rows.length,
    "Each row once.",
  );
export type SavedOrder = z.infer<typeof savedOrderSchema>;

/**
 * The order number for a new row: after every other row of its list (pass
 * archived rows too, so a new row also comes after them).
 */
export function nextPosition(rows: readonly { position: number }[]): number {
  return rows.reduce((last, row) => Math.max(last, row.position), 0) + 1;
}

/** `items` with the one at `from` moved to `to` (both kept inside the list). */
export function moveItem<T>(
  items: readonly T[],
  from: number,
  to: number,
): T[] {
  const next = [...items];
  if (from < 0 || from >= next.length) return next;
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
  return next;
}
