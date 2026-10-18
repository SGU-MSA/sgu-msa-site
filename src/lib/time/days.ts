/**
 * Whole-day arithmetic on calendar days (`YYYY-MM-DD`, Grenada days in this
 * site), done at UTC noon so no time zone or DST can shift a date. Pure and
 * browser-safe (PR6 seasons and payment windows).
 */
const DAY_MS = 86_400_000;
const noon = (day: string) => Date.parse(`${day}T12:00:00Z`);

/** The day `count` days after `day` (negative: before). */
export function addDays(day: string, count: number): string {
  return new Date(noon(day) + count * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`: 1 for tomorrow, -1 for yesterday. */
export function daysBetween(from: string, to: string): number {
  return Math.round((noon(to) - noon(from)) / DAY_MS);
}
