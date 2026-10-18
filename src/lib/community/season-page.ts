import { isIslamicSeason, type Season } from "./seasons";
import { resolveSeason, type SeasonDates } from "./season-policy";
import type { PrayerSettings } from "./schema";
import { hijriSpan } from "../time/hijri";
import { addDays, daysBetween } from "../time/days";
import { shortDateLabel, weekdayDateLabel } from "../time/date-label";

/**
 * A season's public page over the year (PR5c, Q-10a/b, D-26, D-31): the page
 * stays up all year. In its days it is labelled with this year ("Ramadan
 * 2027"); outside them it says when the next one is expected to start and
 * keeps its content labelled with the year it last ran ("Ramadan 2026").
 * Gregorian years only, never a Hijri year (D-31). Pure: "today" (a Grenada
 * day) and the Hijri adjustment are passed in.
 */

/** Seasons in this Islamic month get the "Tonight" panel (iftar, tarawih). */
export const RAMADAN_HIJRI_MONTH = 9;

type Adjustment = PrayerSettings["hijri_adjustment"] | null;

export type SeasonPageState = {
  /** In the season's days today. */
  during: boolean;
  /** The label over the page's content: "Ramadan 2027", or the name alone. */
  label: string;
  /** Outside the season: when the next one starts, or null when unknown. */
  next: string | null;
  /** The days in force (current or next occurrence), or null. */
  dates: Extract<SeasonDates, { state: "dates" }> | null;
};

const yearOf = (day: string) => day.slice(0, 4);

/** The Gregorian year the season last ran in, before `today`, or null. */
function lastYear(
  season: Season,
  dates: SeasonDates,
  today: string,
  adjustment: Adjustment,
): string | null {
  if (!isIslamicSeason(season)) {
    const last = season.board_ends_on;
    return last && last < today ? yearOf(season.board_starts_on || last) : null;
  }
  if (
    dates.state !== "dates" ||
    dates.hijriYear === null ||
    adjustment === null
  )
    return null;
  const before = hijriSpan(
    dates.hijriYear - 1,
    season.hijri_month!,
    season.hijri_first_day!,
    season.hijri_last_day,
    adjustment,
  );
  return before ? yearOf(before.first) : null;
}

/** "Ramadan 2027 is expected to start around 8 Feb." or "… starts on Mon 8 Feb." */
export function nextLine(
  name: string,
  dates: Extract<SeasonDates, { state: "dates" }>,
): string {
  const year = yearOf(dates.first);
  return dates.firstStatus === "expected"
    ? `${name} ${year} is expected to start around ${shortDateLabel(dates.first)}.`
    : `${name} ${year} starts on ${weekdayDateLabel(dates.first)}.`;
}

/** Where the season's page stands on `today`. */
export function seasonPageState(
  season: Season,
  today: string,
  adjustment: Adjustment,
): SeasonPageState {
  const resolved = resolveSeason(season, today, adjustment);
  const dates = resolved.state === "dates" ? resolved : null;
  if (dates && dates.first <= today)
    return {
      during: true,
      label: `${season.name} ${yearOf(dates.first)}`,
      next: null,
      dates,
    };
  const before = lastYear(season, resolved, today, adjustment);
  return {
    during: false,
    label: before ? `${season.name} ${before}` : season.name,
    next: dates ? nextLine(season.name, dates) : null,
    dates,
  };
}

export type TonightState = {
  /** "Night 3", "Night 3 (expected)", or null on the last day (Eid eve). */
  night: string | null;
  /** A fasting day: iftar at Maghrib. */
  iftar: boolean;
  /** A night of the month: tarawih after Isha. */
  tarawih: boolean;
};

/**
 * Tonight in a Ramadan-month season (D-26, edge C10): night 1 is the evening
 * before the first fast; the last fasting day's evening is Eid eve, with no
 * night. Shown from the evening before day 1 to the last day; null
 * otherwise. "(expected)" while the days are not confirmed (edge J5).
 */
export function tonightState(
  season: Pick<Season, "hijri_month">,
  dates: SeasonPageState["dates"],
  today: string,
): TonightState | null {
  if (season.hijri_month !== RAMADAN_HIJRI_MONTH || !dates) return null;
  if (today < addDays(dates.first, -1) || today > dates.last) return null;
  const tarawih = today < dates.last;
  const expected =
    dates.firstStatus === "expected" ||
    (today === addDays(dates.last, -1) && dates.lastStatus === "expected");
  return {
    night: tarawih
      ? `Night ${daysBetween(dates.first, today) + 2}${expected ? " (expected)" : ""}`
      : null,
    iftar: today >= dates.first,
    tarawih,
  };
}
