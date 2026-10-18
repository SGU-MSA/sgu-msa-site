import { TIMEZONE, type PrayerSettings } from "@/lib/community/schema";

/** Today's Hijri date as the prayer block shows it (ADR 0018). */
export type HijriDate = {
  /** "22 Rabiʻ II 1448 AH": day first, like the Gregorian date beside it. */
  english: string;
  /** The same date in Arabic numerals and month name, shown small beneath. */
  arabic: string;
  /** Day of the Hijri month (1–30), which draws the moon. */
  day: number;
};

const DAY_MS = 86_400_000;

const formatter = (locale: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale, { timeZone: TIMEZONE, ...options });
const english = formatter("en-u-ca-islamic-umalqura", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const arabic = formatter("ar-SA-u-ca-islamic-umalqura-nu-arab", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const dayOnly = formatter("en-u-ca-islamic-umalqura-nu-latn", {
  day: "numeric",
});

/**
 * The Umm al-Qura date for the Grenada calendar day of `now` (the shared
 * server clock). It changes at midnight with the normal date beside it, like
 * phone calendars and printed timetables, so the two never disagree on screen
 * (user, PR8 D-11). Sunset still matters where it counts: prayer times and
 * Ramadan's "Tonight" work from the calculated Maghrib. Local moon sighting
 * can differ by a day, so the board's adjustment
 * (`prayer_settings.hijri_adjustment`: -1, 0 or +1 day) is always passed;
 * there is no default.
 */
export function hijriDate(
  now: Date,
  adjustment: PrayerSettings["hijri_adjustment"],
): HijriDate {
  const at = new Date(now.getTime() + adjustment * DAY_MS);
  const parts = english.formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return {
    english: `${part("day")} ${part("month")} ${part("year")} AH`,
    arabic: arabic.format(at),
    day: Number(dayOnly.format(at)),
  };
}

/** A span of Gregorian dates, each `YYYY-MM-DD`, first and last inclusive. */
export type GregorianSpan = { first: string; last: string };

// Whole-day arithmetic on UTC noon, so no time zone or DST can shift a date.
const civilHijri = formatter("en-u-ca-islamic-umalqura-nu-latn", {
  timeZone: "UTC",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});
const HIJRI_EPOCH_DAY = Date.UTC(622, 6, 19) / DAY_MS; // 1 Muharram 1 AH
const HIJRI_YEAR_DAYS = 354.36667;
const noonOf = (day: number) => new Date(day * DAY_MS + DAY_MS / 2);

/** The UTC day number on which `month`/1/`year` (Umm al-Qura) falls, or null. */
function firstOfMonth(year: number, month: number): number | null {
  // Months alternate 30 and 29 days, so the estimate lands within a day or two.
  const estimate = Math.floor(
    HIJRI_EPOCH_DAY + (year - 1) * HIJRI_YEAR_DAYS + (month - 1) * 29.5,
  );
  for (let offset = -10; offset <= 10; offset++) {
    const parts = civilHijri.formatToParts(noonOf(estimate + offset));
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((p) => p.type === type)?.value);
    if (
      value("year") === year &&
      value("month") === month &&
      value("day") === 1
    )
      return estimate + offset;
  }
  return null;
}

/**
 * The Gregorian first and last days of an Islamic-calendar span in
 * `hijriYear`: month `month` from day `firstDay` to day `lastDay` (null = the
 * month's last day), on the same Umm al-Qura calendar as `hijriDate`, shifted
 * by the board's adjustment (+1 shows the Hijri date a day ahead, so the span
 * begins a day earlier). A day beyond the month's length is its last day (no
 * "30 Ramadan" in a 29-day month, PR6 D-15). Null when the year cannot be
 * found on that calendar. Seasons (PR6) resolve through this.
 */
export function hijriSpan(
  hijriYear: number,
  month: number,
  firstDay: number,
  lastDay: number | null,
  adjustment: PrayerSettings["hijri_adjustment"],
): GregorianSpan | null {
  const start = firstOfMonth(hijriYear, month);
  const next =
    month === 12
      ? firstOfMonth(hijriYear + 1, 1)
      : firstOfMonth(hijriYear, month + 1);
  if (start === null || next === null) return null;
  const length = next - start;
  const day = (n: number) => start + Math.min(Math.max(n, 1), length) - 1;
  const iso = (dayNumber: number) =>
    noonOf(dayNumber - adjustment)
      .toISOString()
      .slice(0, 10);
  return {
    first: iso(day(firstDay)),
    last: iso(lastDay === null ? next - 1 : day(lastDay)),
  };
}

const monthName = formatter("en-u-ca-islamic-umalqura", {
  timeZone: "UTC",
  month: "long",
});

/**
 * The English name of an Islamic month (1–12) on the same calendar as
 * `hijriDate`, for example "Ramadan" or "Dhuʻl-Hijjah": the Seasons screen
 * reads a season's anchor as a rule ("starts on 1 Ramadan", PR6 D-78).
 */
export function hijriMonthName(month: number): string {
  const first = firstOfMonth(1447, month);
  return first === null ? `Month ${month}` : monthName.format(noonOf(first));
}

/** The Gregorian days of Ramadan `hijriYear` (a `hijriSpan` of month 9). */
export function ramadanSpan(
  hijriYear: number,
  adjustment: PrayerSettings["hijri_adjustment"],
): GregorianSpan | null {
  return hijriSpan(hijriYear, 9, 1, null, adjustment);
}

/**
 * The Umm al-Qura year of a Grenada calendar day (`YYYY-MM-DD`), without the
 * board's adjustment: seasons use it only to pick the years around today.
 */
export function hijriYearOf(day: string): number {
  const parts = civilHijri.formatToParts(new Date(`${day}T12:00:00Z`));
  return Number(parts.find((p) => p.type === "year")?.value);
}

const monthShort = formatter("en", { timeZone: "UTC", month: "short" });
const yearOnly = formatter("en", { timeZone: "UTC", year: "numeric" });

/** "Feb–Mar 2027"; "Mar 2030" within one month; "Dec 2030 – Jan 2031" across years. */
export function gregorianSpanLabel({ first, last }: GregorianSpan): string {
  const [from, to] = [first, last].map((d) => new Date(`${d}T12:00:00Z`));
  const [fromYear, toYear] = [from, to].map((d) => yearOnly.format(d));
  const [fromMonth, toMonth] = [from, to].map((d) => monthShort.format(d));
  if (fromYear !== toYear)
    return `${fromMonth} ${fromYear} – ${toMonth} ${toYear}`;
  if (fromMonth === toMonth) return `${fromMonth} ${toYear}`;
  return `${fromMonth}–${toMonth} ${toYear}`;
}
