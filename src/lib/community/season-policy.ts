import type { PrayerSettings } from "./schema";
import { isIslamicSeason, type Season } from "./seasons";
import { hijriSpan, hijriYearOf, type GregorianSpan } from "../time/hijri";
import { addDays, daysBetween } from "../time/days";

/**
 * When each season falls (PR6 contract, D-12, D-13, D-15, D-24; ADR 0021).
 * Pure: "today" (a Grenada day, `localDate(clock().now())`) and the board's
 * Hijri adjustment are passed in; nothing reads a clock or the database.
 *
 * - An Islamic season's expected days come from `hijri.ts` (Umm al-Qura plus
 *   the adjustment) for the Hijri years around today. A day the board
 *   confirmed applies to the occurrence whose expected day is within
 *   `BOARD_DATE_REACH_DAYS`; otherwise it is last year's and ignored.
 * - The occurrence shown is the first whose last day is today or later.
 * - A season with typed days has them, and nothing after its last day.
 * - No adjustment (prayer settings unreadable) or no calendar data: "dates
 *   unavailable", never a silent 0 adjustment.
 */

/** A confirmed day applies to the occurrence it is this close to (D-12). */
export const BOARD_DATE_REACH_DAYS = 5;

export type SideStatus = "expected" | "confirmed" | "typed";

export type SeasonDates =
  | {
      state: "dates";
      first: string;
      last: string;
      firstStatus: SideStatus;
      lastStatus: SideStatus;
      /** The occurrence's Hijri year (D-14); null for typed days. */
      hijriYear: number | null;
      /** The board typed a day that does not belong to this occurrence (last year's), so it is ignored. */
      boardDayIgnored: boolean;
    }
  /** Typed days that have passed: nothing until the board types new days. */
  | { state: "over" }
  | { state: "unavailable" };

type Adjustment = PrayerSettings["hijri_adjustment"] | null;

const near = (day: string, expected: string) =>
  Math.abs(daysBetween(expected, day)) <= BOARD_DATE_REACH_DAYS;

/** The expected spans of an anchor in the Hijri years around `today`, oldest first; null if any is unknown. */
function occurrences(
  anchor: { month: number; firstDay: number; lastDay: number | null },
  today: string,
  adjustment: PrayerSettings["hijri_adjustment"],
): (GregorianSpan & { hijriYear: number })[] | null {
  const year = hijriYearOf(today);
  if (!Number.isFinite(year)) return null;
  const spans = [];
  for (const hijriYear of [year - 1, year, year + 1]) {
    const span = hijriSpan(
      hijriYear,
      anchor.month,
      anchor.firstDay,
      anchor.lastDay,
      adjustment,
    );
    if (!span) return null;
    spans.push({ ...span, hijriYear });
  }
  return spans;
}

/** The days of `season`'s current or next occurrence as of `today`. */
export function resolveSeason(
  season: Season,
  today: string,
  adjustment: Adjustment,
): SeasonDates {
  if (!isIslamicSeason(season)) {
    const { board_starts_on: first, board_ends_on: last } = season;
    if (!first || !last) return { state: "unavailable" };
    if (last < today) return { state: "over" };
    return {
      state: "dates",
      first,
      last,
      firstStatus: "typed",
      lastStatus: "typed",
      hijriYear: null,
      boardDayIgnored: false,
    };
  }
  if (adjustment === null) return { state: "unavailable" };
  const spans = occurrences(
    {
      month: season.hijri_month!,
      firstDay: season.hijri_first_day!,
      lastDay: season.hijri_last_day,
    },
    today,
    adjustment,
  );
  if (!spans) return { state: "unavailable" };

  for (const span of spans) {
    const confirmedFirst =
      season.board_starts_on && near(season.board_starts_on, span.first)
        ? season.board_starts_on
        : null;
    const confirmedLast =
      season.board_ends_on && near(season.board_ends_on, span.last)
        ? season.board_ends_on
        : null;
    const first = confirmedFirst ?? span.first;
    // Moon sighting moves the whole month: an unconfirmed last day moves
    // with a confirmed first day (engineering choice), never before it.
    const moved = addDays(
      span.last,
      confirmedFirst ? daysBetween(span.first, confirmedFirst) : 0,
    );
    const last = confirmedLast ?? (moved < first ? first : moved);
    if (last < today) continue;
    return {
      state: "dates",
      first,
      last,
      firstStatus: confirmedFirst ? "confirmed" : "expected",
      lastStatus: confirmedLast ? "confirmed" : "expected",
      hijriYear: span.hijriYear,
      // A typed day that does not belong to this occurrence is last year's (or a typo).
      boardDayIgnored:
        (season.board_starts_on !== "" && !confirmedFirst) ||
        (season.board_ends_on !== "" && !confirmedLast),
    };
  }
  return { state: "unavailable" };
}

/**
 * The resolved days of the first occurrence, on or after `today`, of one
 * Islamic-calendar day (for example 1 Shawwal), using a current season with
 * that exact anchor when there is one (so its confirmed day counts), else
 * the expected day. Null when it cannot be worked out.
 */
export function resolveAnchorDay(
  anchor: { hijriMonth: number; hijriDay: number },
  seasons: readonly Season[],
  today: string,
  adjustment: Adjustment,
): string | null {
  const season = seasons.find(
    (s) =>
      s.hijri_month === anchor.hijriMonth &&
      s.hijri_first_day === anchor.hijriDay,
  );
  if (season) {
    const dates = resolveSeason(season, today, adjustment);
    if (dates.state !== "dates") return null;
    // The season's first day may already be behind today (it lasts several days).
    if (dates.first >= today) return dates.first;
  }
  if (adjustment === null) return null;
  const spans = occurrences(
    {
      month: anchor.hijriMonth,
      firstDay: anchor.hijriDay,
      lastDay: anchor.hijriDay,
    },
    today,
    adjustment,
  );
  return spans?.find((span) => span.first >= today)?.first ?? null;
}

/** Every current season's days as of `today`, by season id. */
export function seasonContext(
  seasons: readonly Season[],
  today: string,
  adjustment: Adjustment,
): Map<string, SeasonDates> {
  return new Map(
    seasons.map((season) => [
      season.id,
      resolveSeason(season, today, adjustment),
    ]),
  );
}

/**
 * The season's latest occurrence that has started by `today` (the current
 * one, else last year's), for the Payments screen's "Season" filter. Typed
 * days count once they have started. Null when it cannot be worked out.
 */
export function latestStartedSpan(
  season: Season,
  today: string,
  adjustment: Adjustment,
): GregorianSpan | null {
  if (!isIslamicSeason(season)) {
    const { board_starts_on: first, board_ends_on: last } = season;
    return first && last && first <= today ? { first, last } : null;
  }
  const dates = resolveSeason(season, today, adjustment);
  if (dates.state !== "dates" || adjustment === null) return null;
  if (dates.first <= today) return { first: dates.first, last: dates.last };
  return dates.hijriYear === null
    ? null
    : hijriSpan(
        dates.hijriYear - 1,
        season.hijri_month!,
        season.hijri_first_day!,
        season.hijri_last_day,
        adjustment,
      );
}
