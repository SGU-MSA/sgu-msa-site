import {
  merchCollectionSchema,
  merchItemSchema,
  type MerchCollection,
  type MerchItem,
} from "@/lib/community/merch";
import { outOfDate } from "@/lib/system-text";
import { problemsOf, type FieldProblems } from "../form-check/problems";

/**
 * The Merch screens' forms as rows (PR5c). Pure, so the server actions,
 * the editors (as you type) and the tests share one reading of a form. The
 * order is set by dragging on the lists: a saved row keeps its place; a new
 * one takes the number the screen gave it. The database stays the authority.
 */

const positionOf = (value: string | undefined) => {
  const position = Number(value?.trim() || Number.NaN);
  return Number.isSafeInteger(position) ? position : null;
};

/** A collection as typed: "On sale now" makes it current, else past. */
export function collectionFromForm(
  values: Record<string, string>,
): { ok: true; row: MerchCollection } | { ok: false; fields: FieldProblems } {
  const position = positionOf(values.position);
  if (position === null) return { ok: false, fields: { name: outOfDate } };
  const parsed = merchCollectionSchema.safeParse({
    id: values.id,
    name: values.name ?? "",
    arabic: values.arabic ?? "",
    quote: values.quote ?? "",
    year: values.year ?? "",
    description: values.description ?? "",
    era: values.era,
    position,
  });
  return parsed.success
    ? { ok: true, row: parsed.data }
    : { ok: false, fields: problemsOf(parsed.error) };
}

/**
 * An item as typed; its photos are checked and stored on their own
 * (`photoListForm`) and passed in once stored.
 */
export function merchItemFromForm(
  values: Record<string, string>,
  photos: MerchItem["photos"] = [],
): { ok: true; row: MerchItem } | { ok: false; fields: FieldProblems } {
  const position = positionOf(values.position);
  if (position === null) return { ok: false, fields: { name: outOfDate } };
  const parsed = merchItemSchema.safeParse({
    id: values.id,
    collection_id: values.collection_id,
    name: values.name ?? "",
    description: values.description ?? "",
    garment: values.garment ?? "",
    colorway: values.colorway ?? "",
    photos,
    position,
  });
  return parsed.success
    ? { ok: true, row: parsed.data }
    : { ok: false, fields: problemsOf(parsed.error) };
}
