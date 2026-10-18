import { TIMEZONE } from "@/lib/community/schema";
import type { PrayerContent } from "@/lib/content/schemas";
import type { Starts } from "@/lib/prayer/calculate";

/**
 * The line shown when prayer starts are missing (Home and Prayer): the pin
 * could not be read right now (PR7 D-10), or no starts could be calculated.
 */
export function startsMissingNote(startsUnavailable: boolean) {
  return startsUnavailable
    ? "Prayer start times are temporarily unavailable."
    : "Prayer start times will appear once the Musallah location is set.";
}

/** One row of today's prayer block: when it begins (calculated) and its iqamah (set by the MSA). */
export type TodayRow = {
  id: string;
  label: string;
  /** Calculated start instant, or null when the calculation is not confirmed. */
  begins: { iso: string } | null;
  /** Congregation time exactly as the board set it, or null. */
  iqamah: string | null;
};

/**
 * Today's rows for Home and Prayer. With calculated starts, all six (Sunrise
 * included) carry their iqamah beside them; without them, the published
 * iqamah times still show on their own.
 */
export function todayRows(
  starts: Starts,
  iqamah: PrayerContent["times"],
): TodayRow[] {
  const congregation = new Map(iqamah.map((row) => [row.id, row.time]));
  const today = starts.filter((row) => row.day === 0);
  if (!today.length)
    return iqamah.map((row) => ({
      id: row.id,
      label: row.label,
      begins: null,
      iqamah: row.time,
    }));
  return today.map((row) => ({
    id: row.id,
    label: row.label,
    begins: { iso: row.iso },
    iqamah: congregation.get(row.id) ?? null,
  }));
}

/** The next prayer to begin after `now` (never Sunrise); tomorrow's Fajr after Isha. */
export function nextPrayer(starts: Starts, now: Date) {
  return (
    starts.find(
      (row) => row.id !== "sunrise" && Date.parse(row.iso) > now.getTime(),
    ) ?? null
  );
}

const dayFormat = new Intl.DateTimeFormat("en", {
  timeZone: TIMEZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});

/** "Friday, 3 October" in Grenada time, from the shared server clock. */
export function todayLabel(now: Date) {
  return dayFormat.format(now);
}

const fridayFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  day: "numeric",
  month: "long",
});

/** "17 October" for a Grenada date (YYYY-MM-DD), as in "Changed this Friday, 17 October". */
export function fridayLabel(date: string) {
  return fridayFormat.format(new Date(`${date}T12:00:00Z`));
}
