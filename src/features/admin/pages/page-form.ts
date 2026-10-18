import {
  mergePageText,
  pageTextSaveSchema,
  withChosenPhotos,
  type PageTextKey,
} from "@/lib/content/page-fields";
import {
  hiddenSections,
  sharedTexts,
  type LayoutKey,
} from "@/lib/content/page-layouts";
import { outOfDate } from "@/lib/system-text";
import { problemsOf, type FieldProblems } from "../form-check/problems";

/**
 * A page's text as typed, checked by the page's save rules (PR5b D-22;
 * review 2, 2026-10-05): the posted document over the stored one, with the
 * photos chosen in this save. Each problem is keyed by its box's path
 * ("faq.items.1.answer"); a document that does not fit this screen any more
 * is `outOfDate`. `hiddenElsewhere`: this document's sections another page
 * hides (review 3 B; the page's own `sections` are read from `posted`).
 * Pure, so the save and the editor (as you type) agree.
 */
export function pageTextForm<K extends PageTextKey>(
  key: K,
  stored: unknown,
  posted: unknown,
  chosen: readonly string[],
  hiddenElsewhere: readonly string[] = [],
):
  | { ok: true; document: unknown }
  | { ok: false; fields: FieldProblems }
  | { ok: false; outOfDate: string } {
  const withPhotos = withChosenPhotos(key, posted, chosen);
  if (!withPhotos) return { ok: false, outOfDate };
  const hidden = new Set([...hiddenSections(key, posted), ...hiddenElsewhere]);
  const merged = mergePageText(key, stored, withPhotos, hidden);
  if (!merged.ok) return { ok: false, outOfDate };
  const parsed = pageTextSaveSchema(key, hidden).safeParse(merged.document);
  return parsed.success
    ? { ok: true, document: parsed.data }
    : { ok: false, fields: problemsOf(parsed.error) };
}

/** Page texts by key: a page's own and the ones whose sections it shows. */
export type PageTexts = Partial<Record<PageTextKey, unknown>>;

/**
 * A box of another page text shown on this page, by the key its problem and
 * photo use ("musallah:facilities.heading"); a box of the page's own text
 * keeps its plain path. Paths never hold a ":".
 */
export const textPath = (
  owner: PageTextKey,
  page: PageTextKey,
  path: string,
) => (owner === page ? path : `${owner}:${path}`);

/** The page text and path a problem key names (`textPath` read back). */
export function textOfPath(
  page: PageTextKey,
  key: string,
): { owner: PageTextKey; path: string } {
  const at = key.indexOf(":");
  return at < 0
    ? { owner: page, path: key }
    : { owner: key.slice(0, at) as PageTextKey, path: key.slice(at + 1) };
}

/**
 * The sections of a shared page text (`sharedTexts`) that `page` hides, by
 * the page's typed `sections`: their required boxes may stay empty.
 */
export const hiddenOnPage = (
  shared: PageTextKey,
  page: PageTextKey,
  pageDocument: unknown,
): string[] => [
  ...hiddenSections(
    shared,
    {},
    {
      [page as LayoutKey]: pageDocument,
    },
  ),
];

/**
 * A page's text with the sections of other page texts it shows (Jumu'ah and
 * Musallah directions on Prayer & Musallah; dashboard polish, 2026-10-06),
 * as typed: each document checked by its own save rules (`pageTextForm`),
 * a shared one with the sections this page hides as hidden. Problems of a
 * shared text are keyed by `textPath`. The page's own document comes first.
 * Pure, so the save and the editor (as you type) agree.
 */
export function pageTextsForm(
  page: PageTextKey,
  stored: PageTexts,
  posted: PageTexts,
  chosen: (owner: PageTextKey) => readonly string[],
  hiddenElsewhere: readonly string[] = [],
):
  | { ok: true; documents: { key: PageTextKey; document: unknown }[] }
  | { ok: false; fields: FieldProblems }
  | { ok: false; outOfDate: string } {
  const documents: { key: PageTextKey; document: unknown }[] = [];
  const fields: FieldProblems = {};
  for (const key of [page, ...sharedTexts(page)]) {
    const result = pageTextForm(
      key,
      stored[key],
      posted[key],
      chosen(key),
      key === page ? hiddenElsewhere : hiddenOnPage(key, page, posted[page]),
    );
    if (result.ok) documents.push({ key, document: result.document });
    else if ("outOfDate" in result) return result;
    else
      for (const [path, message] of Object.entries(result.fields))
        fields[textPath(key, page, path)] = message;
  }
  return Object.keys(fields).length
    ? { ok: false, fields }
    : { ok: true, documents };
}

/**
 * The form's hidden fields that carry a page text as typed and the version
 * the screen read: "document" and "version" for the page's own text,
 * "document:<text>" and "version:<text>" for a shared one.
 */
export const documentField = (owner: PageTextKey, page: PageTextKey) =>
  owner === page ? "document" : `document:${owner}`;
export const versionField = (owner: PageTextKey, page: PageTextKey) =>
  owner === page ? "version" : `version:${owner}`;

/**
 * The name of a photo's file box: "photo:<path>" for the page's own text,
 * "photo:<text>:<path>" for a shared one.
 */
export const photoBox = (owner: PageTextKey, page: PageTextKey, path: string) =>
  `photo:${textPath(owner, page, path)}`;

/**
 * The photos chosen on `page`'s screen for one of its page texts (`owner`,
 * the page's own by default): its file boxes (`photoBox`) with a file, by
 * path in that text.
 */
export function chosenPhotos(
  form: FormData,
  page: PageTextKey,
  owner: PageTextKey = page,
) {
  const chosen: { path: string; file: File }[] = [];
  for (const [name, value] of form) {
    if (!name.startsWith("photo:") || !(value instanceof File) || !value.size)
      continue;
    const at = textOfPath(page, name.slice("photo:".length));
    if (at.owner === owner) chosen.push({ path: at.path, file: value });
  }
  return chosen;
}
