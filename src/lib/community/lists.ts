import { z } from "../validation/zod";

/**
 * Lists (review fixes P3, the approved plan of 2026-10-07): the board's own
 * choices for an event's Category and Term and a resource's Category,
 * edited on Dashboard → Lists (add, rename, drag to order; delete only while
 * nothing uses an option). The public filters show only the options that
 * have items. The migration `202610160002_lists.sql` is the authority. Pure.
 */

export const listNames = [
  "event_categories",
  "terms",
  "resource_categories",
] as const;
export type ListName = (typeof listNames)[number];

/** Each list's name on the Lists screen, and what one of its options is. */
export const listInfo = {
  event_categories: {
    title: "Event categories",
    item: "category",
    hint: "The Category box of an event, and the category buttons on the Events page.",
  },
  terms: {
    title: "Terms",
    item: "term",
    hint: "The Term box of an event, and the Term filter on the Events page.",
  },
  resource_categories: {
    title: "Resource categories",
    item: "category",
    hint: "The Category of a resource (Pages → Resources), and the categories on the Resources page.",
  },
} as const satisfies Record<
  ListName,
  { title: string; item: string; hint: string }
>;

/** An option's name: what the board types and visitors read. */
export const LIST_NAME_MAX = 60;
const nameSchema = z
  .string()
  .trim()
  .min(1, "Name: fill in this box.")
  .max(LIST_NAME_MAX, `Name: use ${LIST_NAME_MAX} characters or fewer.`);

/** A slug: lower-case words joined by "-" (`list_options.slug`). */
export const listSlugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const listOptionSchema = z.object({
  id: z.uuid(),
  list: z.enum(listNames),
  name: nameSchema,
  slug: z.string().max(LIST_NAME_MAX).regex(listSlugPattern),
  position: z.number().int(),
});
export type ListOption = z.infer<typeof listOptionSchema>;
/** An option with its version, as the board reads it. */
export type VersionedListOption = ListOption & { updated_at: string };

/** Every list, each in its order. */
export type Lists = Record<ListName, ListOption[]>;
export const emptyLists = (): Lists => ({
  event_categories: [],
  terms: [],
  resource_categories: [],
});

/** Rows of every list (any order) grouped by list, each in position order. */
export function groupLists<T extends ListOption>(
  rows: readonly T[],
): Record<ListName, T[]> {
  const lists = {
    event_categories: [],
    terms: [],
    resource_categories: [],
  } as Record<ListName, T[]>;
  for (const row of rows) lists[row.list]?.push(row);
  for (const name of listNames)
    lists[name].sort(
      (a, b) => a.position - b.position || a.name.localeCompare(b.name),
    );
  return lists;
}

/** The typed name of a new or renamed option ("Name: fill in this box."). */
export const typedListName = (value: unknown) => nameSchema.safeParse(value);

/**
 * The slug of a new option, made once from its name and kept when it is
 * renamed (`list_options.slug`): "2026 Fall" → "2026-fall"; a slug the list
 * already has gets "-2", "-3" …; a name with no letters or digits is "option".
 */
export function slugFor(name: string, taken: readonly string[]): string {
  const base =
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, LIST_NAME_MAX - 4)
      .replace(/-+$/g, "") || "option";
  let slug = base;
  for (let n = 2; taken.includes(slug); n += 1) slug = `${base}-${n}`;
  return slug;
}

/** Whether a name is already in the list, as the database compares it (case and spaces aside). */
export function nameTaken(
  options: readonly Pick<ListOption, "id" | "name">[],
  name: string,
  except?: string,
) {
  const key = name.trim().toLowerCase();
  return options.some(
    (option) =>
      option.id !== except && option.name.trim().toLowerCase() === key,
  );
}

/** The words of the Lists screen and its refusals. */
export const listWords = {
  add: "Add",
  adding: "Adding…",
  rename: "Save name",
  newName: (item: string) => `New ${item}`,
  nameTaken: "Name: this list already has an option with this name.",
  delete: "Delete",
  deleting: "Deleting…",
  /** The plan's words: an option in use cannot be deleted. */
  usedBy: (count: number, noun: string) =>
    `Used by ${count} ${count === 1 ? noun : `${noun}s`}. Move them first.`,
  /** The database found a use the screen did not count (someone saved meanwhile). */
  inUse:
    "Something uses this option now. Reload to see what, then move it first.",
  empty: "None yet.",
  added: "Added.",
  renamed: "Saved.",
  deleted: "Deleted.",
  noCategory: "No category",
  noTerm: "No term",
  unavailable:
    "The lists could not be loaded. Check your connection and reload.",
} as const;

/**
 * The options that have items, in the list's order: the public filters
 * hide an option nothing uses (the plan's "hidden when empty").
 */
export function optionsWithItems<T extends Pick<ListOption, "id" | "slug">>(
  options: readonly T[],
  used: ReadonlySet<string>,
): T[] {
  return options.filter(
    (option) => used.has(option.id) || used.has(option.slug),
  );
}

/**
 * The five category colours (`--category-*` tokens), given to the event
 * categories in their list order and starting again after five.
 */
export const categoryTones = [
  "msa",
  "academic",
  "informational",
  "faith",
  "social",
] as const;
export type CategoryTone = (typeof categoryTones)[number];
export function categoryTone(index: number): CategoryTone {
  return categoryTones[
    ((index % categoryTones.length) + categoryTones.length) %
      categoryTones.length
  ];
}

/**
 * The resource category slugs the Resources page's text uses (archived
 * resources too), read loosely: the mirror of `list_options_guard`.
 */
export function resourceCategoriesInUse(document: unknown): Set<string> {
  const items =
    typeof document === "object" && document !== null
      ? (document as { items?: unknown }).items
      : undefined;
  return new Set(
    Array.isArray(items)
      ? items.flatMap((item) =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as { category?: unknown }).category === "string" &&
          (item as { category: string }).category
            ? [(item as { category: string }).category]
            : [],
        )
      : [],
  );
}
