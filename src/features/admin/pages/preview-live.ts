import "server-only";

import { calendarFeedLinks } from "@/lib/calendar/targets";
import { siteUrl } from "@/lib/site-config";
import { calendarEntries } from "@/features/calendar/entries";
import { loadCommunityFeed } from "@/features/community/load";
import { loadHomeLive } from "@/features/home/load";
import { prayerTodayView } from "@/features/prayer/load";
import {
  managedEvents,
  managedNewsletters,
  managedPrayer,
} from "@/lib/community/managed";
import { getLists, getTeam, getVerseLibrary } from "@/lib/community/queries";
import {
  getFAQ,
  getForms,
  getMusallah,
  getResources,
  getSite,
  placedReminder,
  siteYear,
} from "@/lib/content";
import type { PageTextKey } from "@/lib/content/documents";
import {
  donatePageShowsFunds,
  loadMerchPage,
} from "@/lib/integrations/payments";
import { clock } from "@/lib/runtime/providers";

async function prayerLive() {
  const [managed, musallah, forms, verse] = await Promise.all([
    managedPrayer(),
    getMusallah(),
    getForms(),
    placedReminder("prayer"),
  ]);
  const { prayer, jumuah, schedule } = managed;
  const today = prayerTodayView(managed, clock().now());
  // `body`: PrayerBody's props as the page passes them (the map is a slot).
  return { body: { prayer, jumuah, musallah, forms, today, verse }, schedule };
}

async function resourcesLive() {
  const [resources, newsletters, verse, { lists }] = await Promise.all([
    getResources(),
    managedNewsletters(),
    placedReminder("resources"),
    getLists(),
  ]);
  return {
    resources,
    newsletters,
    verse,
    categories: lists.resource_categories,
  };
}

/**
 * What a page shows besides the page text being edited (PR5b WP4): the live
 * lists (team, events, updates, newsletter issues, today's prayer times),
 * the verses placed on the page and the other pages' stored text the same
 * public page draws. Read on the server when the editor opens; the Preview
 * tab draws the whole page from the typed text over it (review 3 B). The
 * parts only the server can draw (the map, community updates on Home, the
 * featured notice, the first-visit box) come as slots (`previewSlots`).
 */
const loaders = {
  home: async () => {
    const [live, faq, givingOpen, home, events, community, giving] =
      await Promise.all([
        loadHomeLive(),
        getFAQ(),
        donatePageShowsFunds(clock().now()),
        placedReminder("home"),
        placedReminder("home_events"),
        placedReminder("home_community"),
        placedReminder("home_giving"),
      ]);
    return {
      live,
      faq,
      givingOpen,
      verses: { home, events, community, giving },
    };
  },
  about: async () => {
    const [team, verse] = await Promise.all([
      getTeam(),
      placedReminder("about"),
    ]);
    return { team: team.sections, verse };
  },
  prayer: prayerLive,
  jumuah: prayerLive,
  musallah: prayerLive,
  events: async () => {
    const [events, verse, site] = await Promise.all([
      managedEvents(),
      placedReminder("events"),
      getSite(),
    ]);
    return {
      subscribe: calendarFeedLinks(siteUrl, site.brand.short_name),
      entries: calendarEntries(events.events),
      lists: events.lists,
      today: events.today,
      unavailable: events.unavailable,
      verse,
    };
  },
  community: async () => {
    const [feed, verse] = await Promise.all([
      loadCommunityFeed(),
      placedReminder("community"),
    ]);
    return { feed, verse };
  },
  newsletters: resourcesLive,
  resources: resourcesLive,
  "get-involved": async () => {
    const [forms, verse] = await Promise.all([
      getForms(),
      placedReminder("get_involved"),
    ]);
    return { forms, verse };
  },
  forms: async () => ({}),
  faq: async () => ({}),
  donate: async () => ({}),
  contact: async () => {
    const site = await getSite();
    return { email: site.brand.email ?? null, social: site.social };
  },
  support: async () => ({}),
  integrations: async () => ({}),
  // The footer's links are developer-owned: the public site reads them from YAML (E-11).
  site: async () => ({
    year: await siteYear(),
    footer: (await getSite()).footer,
  }),
  // The collections, items and sizes the Merch page shows under its opening (PR5c).
  merch: async () => ({ data: await loadMerchPage(clock().now()) }),
  // The fixed verse library: the verse screen's choosers search it and its preview draws the chosen verses.
  "reminder-places": async () => {
    const library = await getVerseLibrary();
    return { verses: library.verses, unavailable: library.unavailable };
  },
} satisfies Record<PageTextKey, () => Promise<object>>;

export type PreviewLiveData = {
  [K in PageTextKey]: Awaited<ReturnType<(typeof loaders)[K]>>;
};
/** One page's live data, tagged with its page. */
export type PreviewLive = {
  [K in PageTextKey]: { key: K; data: PreviewLiveData[K] };
}[PageTextKey];

export async function previewLive<K extends PageTextKey>(
  key: K,
): Promise<PreviewLive> {
  return { key, data: await loaders[key]() } as PreviewLive;
}
