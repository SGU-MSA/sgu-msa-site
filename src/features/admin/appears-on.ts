import type { PageTextKey } from "@/lib/content/documents";
import { pageFields } from "@/lib/content/page-fields";
import { systemText } from "@/lib/system-text";

/**
 * Where each dashboard editor's changes show on the website (review fixes
 * P1, item 4; the review's "Tell users where their changes appear"). One
 * registry: each editor lists the public pages it feeds, by their key in the
 * Pages list, so a page's name and address come from `pageFields` and are
 * never written twice. Editors whose work stays inside the dashboard (New
 * board term, Photos, Recent changes) have no entry.
 */
export const appearsOnPages = {
  events: ["events", "home"],
  announcements: ["home", "community"],
  news_posts: ["community", "home"],
  newsletters: ["newsletters"],
  people: ["about"],
  groups: ["about"],
  funds: ["donate"],
  // A ticket is bought from its event's page.
  tickets: ["events"],
  prayer: ["prayer", "home"],
  musallah: ["prayer", "home", "contact"],
  merch: ["merch"],
  seasons: [],
  // Review fixes P3: the category and term filters, and the resource categories.
  lists: ["events", "resources"],
} as const satisfies Readonly<Record<string, readonly PageTextKey[]>>;

export type AppearsOnArea = keyof typeof appearsOnPages;

/**
 * The Pages-list entries with no public page of their own (`publicPath:
 * null`; review follow-ups, 2026-10-07): where their words show instead.
 * Site-wide (the name, tagline, email and social links in the header and
 * footer, and the search description) and the verses (one at the bottom of
 * every page, the others on their own pages) show on every page; the
 * Go2Pay receipt note shows only on Go2Pay receipts. Sign-up forms say
 * where each form shows beside the form itself.
 */
export const appearsOnElsewhere = {
  site: "everyPage",
  "reminder-places": "everyPage",
  integrations: "go2payReceipts",
} as const satisfies Partial<
  Record<PageTextKey, keyof typeof systemText.places>
>;

/** A public page an editor's changes show on. */
export type PublicPageLink = { label: string; href: string };

/** Where an editor's changes show: a public page, or a place with no one address ("every page"). */
export type PublicPlace = { label: string; href?: string };

/**
 * The public pages of an area, or of one page's own text (`page:<key>`),
 * each once: two pages at one address (the newsletter archive on Resources)
 * read as the first. `extra` adds a page that is not in the Pages list, such
 * as a season's own page.
 */
export function appearsOn(
  area: AppearsOnArea | `page:${PageTextKey}`,
  extra: readonly PublicPageLink[] = [],
): PublicPlace[] {
  const page = area.startsWith("page:")
    ? (area.slice("page:".length) as PageTextKey)
    : null;
  if (page && Object.hasOwn(appearsOnElsewhere, page))
    return [
      {
        label:
          systemText.places[
            appearsOnElsewhere[page as keyof typeof appearsOnElsewhere]
          ],
      },
    ];
  const keys: readonly PageTextKey[] = page
    ? [page]
    : appearsOnPages[area as AppearsOnArea];
  const links: PublicPlace[] = [];
  for (const key of keys) {
    const { title, publicPath } = pageFields[key];
    if (publicPath && !links.some((link) => link.href === publicPath))
      links.push({ label: title, href: publicPath });
  }
  for (const link of extra)
    if (!links.some((known) => known.href === link.href)) links.push(link);
  return links;
}
