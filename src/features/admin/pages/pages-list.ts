import { pageTextKeys, type PageTextKey } from "@/lib/content/documents";
import { pageFields } from "@/lib/content/page-fields";
import {
  isLayoutKey,
  pagesShowing,
  type LayoutKey,
} from "@/lib/content/page-layouts";

/**
 * The pages the Pages screens edit. "Verse on each page" (`reminder-places`)
 * is edited on the Qur'an verses screen with the verse library (PR5b-WP7).
 * `donate` stays off the list until the Donate page reads its opening words
 * (PR5b WP5, after PR6's Donate page; E-19): a save there would change
 * nothing on the site.
 */
const notOnScreen: readonly PageTextKey[] = ["reminder-places", "donate"];

export const pagesOnScreen: readonly PageTextKey[] = pageTextKeys.filter(
  (key) => !notOnScreen.includes(key),
);

/**
 * The pages a page text's words show on, when it has no page of its own and
 * every section of it is drawn on other pages (Jumu'ah, Musallah directions,
 * Newsletter archive; shared text, option A, 2026-10-06), else null. Its
 * words are edited on those pages, so it is not in the Pages list; its own
 * screen keeps its History.
 */
export function editedOn(key: PageTextKey): LayoutKey[] | null {
  if (isLayoutKey(key)) return null;
  const { sections } = pageFields[key];
  const pages = sections.map((section) => pagesShowing(key, section.id));
  if (!sections.length || pages.some((shown) => !shown.length)) return null;
  return [...new Set(pages.flat())];
}

/** The Pages list: every page edited on its own screen. */
export const pagesListed: readonly PageTextKey[] = pagesOnScreen.filter(
  (key) => !editedOn(key),
);

/** The verse screen (PR5b WP7): the library and "Verse on each page". */
export const verseScreenPath = "/admin/pages/verses";

/** The dashboard screen that edits a page's text. */
export const pageScreenPath = (key: PageTextKey) =>
  key === "reminder-places" ? verseScreenPath : `/admin/pages/${key}`;
