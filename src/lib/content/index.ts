/**
 * Editorial page copy for routes and lib functions.
 *
 * Components never touch the filesystem, js-yaml or a database directly — they
 * receive validated, typed documents from these functions, which read through
 * the composition point's `EditorialSource` (ADR 0012). Adding a document
 * means a schema and fallback in `documents.ts` plus one function here.
 */
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getVerse } from "@/lib/community/queries";
import type { QuranVerse } from "@/lib/quran/verse";
import { localYear } from "@/lib/community/schema";
import { clock, editorialSource } from "@/lib/runtime/providers";
import { publicCacheTags } from "@/lib/runtime/public-cache";
import type { EditorialDocuments, EditorialKey } from "./documents";
import { placedVerse, verseReminder } from "./reminders";
import type { Reminder, ReminderPlace } from "./schemas";

export * from "./schemas";

/**
 * One page text document, cached until a board save expires it
 * (`publicCacheTags.pageText`; review fixes PR-C). A read that fell back
 * because the database could not be reached is kept only briefly, so the
 * real text comes back by itself.
 */
async function getDocument<K extends EditorialKey>(
  key: K,
): Promise<EditorialDocuments[K]> {
  "use cache";
  cacheTag(publicCacheTags.pageText);
  const read = await editorialSource().get(key);
  if (read.unavailable) cacheLife("minutes");
  else cacheLife("max");
  return read.document;
}

export const getSite = () => getDocument("site");
export const getPrayer = () => getDocument("prayer");
export const getJumuah = () => getDocument("jumuah");
export const getMusallah = () => getDocument("musallah");
export const getEvents = () => getDocument("events");
export const getFAQ = () => getDocument("faq");
export const getResources = () => getDocument("resources");
export const getNewsletters = () => getDocument("newsletters");
export const getMerch = () => getDocument("merch");
export const getSupport = () => getDocument("support");
export const getForms = () => getDocument("forms");
export const getHome = () => getDocument("home");
export const getAbout = () => getDocument("about");
export const getGetInvolved = () => getDocument("get-involved");
export const getIntegrations = () => getDocument("integrations");
export const getDonate = () => getDocument("donate");
export const getContact = () => getDocument("contact");
export const getCommunity = () => getDocument("community");
/** Arabic reminders (ADR 0018): the dhikr of the hour and the tasbih phrases. */
export const loadReminders = () => getDocument("reminders");

/**
 * The Qur'an verse placed in one place of the site (PR5b D-24), from the
 * fixed verse library, or null for no verse. Reads only our database (page
 * text `reminder-places` and `quran_verses`), never the Qur'an service.
 */
export async function reminderFor(
  place: ReminderPlace,
): Promise<QuranVerse | null> {
  const { places } = await getDocument("reminder-places");
  const reference = places[place];
  return reference
    ? placedVerse(place, reference, await getVerse(reference))
    : null;
}

/** The verse placed in `place` as the reminder primitives draw it, or null. */
export async function placedReminder(
  place: ReminderPlace,
): Promise<Reminder | null> {
  const verse = await reminderFor(place);
  return verse ? verseReminder(verse) : null;
}

/**
 * This year in Grenada on the server clock: the footer's copyright line
 * follows it (no stored year). Cached for up to an hour, so the footer can
 * be part of the page sent at once.
 */
export async function siteYear() {
  "use cache";
  cacheLife("hours");
  return localYear(clock().now());
}
