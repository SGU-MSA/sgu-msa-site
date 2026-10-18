import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { cache } from "react";
import { contentProvider } from "@/lib/runtime/providers";
import { publicCacheTags, requestNow } from "@/lib/runtime/public-cache";
import { isVisible, type Collection } from "./schema";

/**
 * Announcement rows, kept for a minute at most and expired by every board
 * save (review fixes PR-C). `getRecords` still filters them by the clock on
 * every visit, so an urgent notice leaves the band at its exact end.
 */
async function announcementRows() {
  "use cache";
  cacheTag(publicCacheTags.announcements);
  const result = await contentProvider().getRecords("announcements");
  if (result.unavailable) cacheLife("seconds");
  else cacheLife("minutes");
  return result;
}

// Per visit: what is visible now on the server clock. Only announcement rows
// are cached; events, news and newsletters are read fresh each time.
export const getRecords = cache(async (kind: Collection) => {
  const now = await requestNow();
  const result =
    kind === "announcements"
      ? await announcementRows()
      : await contentProvider().getRecords(kind);
  return {
    ...result,
    records: result.records.filter((row) => isVisible(row, kind, now)),
  };
});

/**
 * The board's prayer settings, cached until a board save
 * (`publicCacheTags.prayerSettings`). A fallback read is kept only briefly.
 */
export async function getPrayerSettings() {
  "use cache";
  cacheTag(publicCacheTags.prayerSettings);
  const result = await contentProvider().getPrayerSettings();
  if (result.unavailable) cacheLife("minutes");
  else cacheLife("max");
  return result;
}

/** The public team list (`public_team_list()`). Read per visit. */
export const getTeam = cache(async () => {
  await connection();
  return contentProvider().getTeam();
});

/**
 * The Lists (review fixes P3): event categories, terms and resource
 * categories, for the public filters and the event tags. Read per visit, like
 * the team, so a board change shows on the next page load.
 */
export const getLists = cache(async () => {
  await connection();
  return contentProvider().getLists();
});

/**
 * One verse of the fixed verse library (PR5b D-24, Review 3 E). Cached with
 * no tag: the library never changes, so no board save expires it. A
 * fallback read is kept only briefly.
 */
export async function getVerse(reference: string) {
  "use cache";
  const result = await contentProvider().getVerse(reference);
  if (result.unavailable) cacheLife("minutes");
  else cacheLife("max");
  return result;
}

/** The whole fixed verse library, for the board's verse chooser and its preview; cached the same way. */
export async function getVerseLibrary() {
  "use cache";
  const result = await contentProvider().getVerseLibrary();
  if (result.unavailable) cacheLife("minutes");
  else cacheLife("max");
  return result;
}
