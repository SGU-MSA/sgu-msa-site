import "server-only";
import { connection } from "next/server";
import { clock } from "./providers";

/**
 * The public reads that are cached (Cache Components, review fixes PR-C).
 * Each cached read carries its tag; every board save expires them all
 * (`publicDataChanged` in src/features/admin/public-refresh.ts), so a board
 * edit shows on the next page load. Everything else a page reads (events,
 * news, the team, funds) is read fresh on every visit.
 */
export const publicCacheTags = {
  /** Page text documents (`getSite`, `getHome`, …; src/lib/content). */
  pageText: "page-text",
  /** The board's prayer settings (`getPrayerSettings`). */
  prayerSettings: "prayer-settings",
  /** The musallah pin (`musallahPin`). */
  musallahPin: "musallah-pin",
  /** Announcement rows; the urgent band filters them by the clock per visit. */
  announcements: "announcements",
} as const;

/**
 * "Now" for a read that must happen per visit: marks the render as
 * request-time first (`connection()`), so it never ends up in a page built
 * ahead of time, in the sandbox as on the live site.
 */
export async function requestNow(): Promise<Date> {
  await connection();
  return clock().now();
}
