/**
 * The community feed's rules, in one place for the /community page, its post
 * pages and the Home feed: which updates show, in what order, with which
 * cover. Pure (no reads), so the rules are unit-tested.
 */
import type { ContentImage } from "@/lib/content/schemas";
import type { CommunityRecord } from "@/lib/community/schema";
import type { Provenance } from "@/lib/community/providers/contract";

export type PostPath = "announcements" | "news_posts";

/** The kind words the feed prints. */
export const KIND_LABEL: Record<PostPath, string> = {
  announcements: "Announcement",
  news_posts: "Community news",
};

export type RecordsResult = {
  records: CommunityRecord[];
  unavailable: boolean;
  provenance: Provenance;
};

export type FeedItem = CommunityRecord & {
  kind: string;
  path: PostPath;
  href: string;
  excerpt: string;
  cover: ContentImage | null;
};

export type Feed = {
  /** Featured first, then newest; the first item is the lead story. */
  items: FeedItem[];
  /** Either read failed: show the alert, keep whatever did load. */
  unavailable: boolean;
  /** Both reads worked and nothing is published. */
  empty: boolean;
};

/** The uploaded photo as the cover; without one, none (the sandbox too). */
export function feedCover(row: CommunityRecord): ContentImage | null {
  if (!row.image_path) return null;
  return {
    src: `/media/${row.image_path}`,
    alt: row.image_alt,
    historical: false,
  };
}

export function buildFeed(
  announcements: RecordsResult,
  news: RecordsResult,
): Feed {
  const shape = (row: CommunityRecord, path: PostPath): FeedItem => ({
    ...row,
    kind: KIND_LABEL[path],
    path,
    href: `/community/${path}/${row.id}`,
    excerpt: row.summary || row.body.slice(0, 240),
    cover: feedCover(row),
  });
  const items = [
    ...announcements.records.map((row) => shape(row, "announcements")),
    ...news.records.map((row) => shape(row, "news_posts")),
  ].sort(
    (a, b) =>
      Number(b.featured) - Number(a.featured) || b.date.localeCompare(a.date),
  );
  const unavailable = announcements.unavailable || news.unavailable;
  return { items, unavailable, empty: !items.length && !unavailable };
}

/** A post body's paragraphs, split on blank lines. */
export const paragraphs = (body: string) => body.split(/\n\s*\n/);

/** "3 October 2026" for a stored `YYYY-MM-DD`; anything else prints as is. */
export function longDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(date);
}
