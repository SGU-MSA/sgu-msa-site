import "server-only";
import type { Metadata } from "next";
import { getLists, getRecords } from "@/lib/community/queries";
import { managedPrayer } from "@/lib/community/managed";
import { eventEntry } from "@/lib/community/event-entry";
import {
  seasonPageState,
  tonightState,
  type SeasonPageState,
} from "@/lib/community/season-page";
import type { Season } from "@/lib/community/seasons";
import type { DonateGroup } from "@/lib/community/payments";
import { compareByDate, isUpcoming, TIMEZONE } from "@/lib/community/schema";
import { localDate } from "@/lib/community/schema";
import type { Reminder } from "@/lib/content/schemas";
import { placedReminder } from "@/lib/content";
import { resolveForm } from "@/lib/integrations";
import type { LinkDestination } from "@/lib/integrations/types";
import { loadSeasonFunds } from "@/lib/integrations/payments";
import { contentProvider, paymentsProvider } from "@/lib/runtime/providers";
import { requestNow } from "@/lib/runtime/public-cache";
import { todayLabel } from "@/features/prayer/today";
import type { SiteEvent } from "@/features/calendar/types";

import { tonightRows, type TonightRow } from "./tonight";

/** Ramadan's season page lives at /ramadan; every other one at /seasons/<slug>. */
export const RAMADAN_SLUG = "ramadan";
export const seasonPath = (slug: string) =>
  slug === RAMADAN_SLUG ? "/ramadan" : `/seasons/${slug}`;

export type SeasonPageData = {
  season: Season;
  state: SeasonPageState;
  tonight: { rows: TonightRow[]; night: string | null; date: string } | null;
  /** The season's upcoming events, soonest first. */
  events: SiteEvent[];
  /** Its open funds, as the Donate page groups them. */
  funds: DonateGroup[];
  verse: Reminder | null;
  /** The sign-up form's button (or its closed line), or null for none. */
  signUp: LinkDestination | null;
};

const clockTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** The current season with a page at this address, or why there is none. */
export async function findSeasonPage(
  slug: string,
): Promise<{ season: Season | null; unavailable: boolean }> {
  const read = await paymentsProvider().seasons();
  if (read.unavailable) return { season: null, unavailable: true };
  return {
    season:
      read.seasons.find((season) => season.has_page && season.slug === slug) ??
      null,
    unavailable: false,
  };
}

/**
 * A season's public page (PR5c, D-8, D-26, Q-10a/b) on `now`: where it
 * stands in the year, tonight's iftar and tarawih in a Ramadan-month season
 * (from Prayer & iqamah), its upcoming events and its open funds. A verse
 * only on Ramadan's page (its place on the verse screen).
 */
export async function loadSeasonPage(
  season: Season,
  now: Date,
): Promise<SeasonPageData> {
  const today = localDate(now);
  const [settings, events, funds, verse, signUp] = await Promise.all([
    contentProvider().getPrayerSettings(),
    getRecords("events"),
    loadSeasonFunds(season.id, now),
    season.slug === RAMADAN_SLUG
      ? placedReminder("ramadan")
      : Promise.resolve(null),
    season.sign_up_form
      ? resolveForm(season.sign_up_form)
      : Promise.resolve(null),
  ]);
  const adjustment = settings.unavailable
    ? null
    : settings.settings.hijri_adjustment;
  const state = seasonPageState(season, today, adjustment);
  const tonight = tonightState(season, state.dates, today);
  let tonightView: SeasonPageData["tonight"] = null;
  if (tonight) {
    const { prayer, starts } = await managedPrayer();
    const maghrib = starts.find((row) => row.id === "maghrib" && row.day === 0);
    tonightView = {
      rows: tonightRows(tonight, {
        maghribStart: maghrib ? clockTime.format(new Date(maghrib.iso)) : null,
        ishaIqamah:
          prayer.times.find((time) => time.id === "isha")?.time ?? null,
      }),
      night: tonight.night,
      date: todayLabel(now),
    };
  }
  const { lists } = await getLists();
  return {
    season,
    state,
    tonight: tonightView,
    events: events.records
      .filter(
        (event) => event.season_id === season.id && isUpcoming(event, now),
      )
      .sort(compareByDate(true))
      .map((event) => eventEntry(event, lists)),
    funds,
    verse,
    signUp,
  };
}

/** The title and description of a season's page, read on each visit. */
export async function seasonMetadata(slug: string): Promise<Metadata> {
  // Never while building: the board edits it live.
  await requestNow();
  const { season } = await findSeasonPage(slug);
  if (!season) return { title: "Page not found" };
  const description = season.intro.split(/\n/)[0]?.trim() || undefined;
  return {
    title: season.name,
    description,
    alternates: { canonical: seasonPath(season.slug) },
  };
}
