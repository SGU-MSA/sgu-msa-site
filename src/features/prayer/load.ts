import "server-only";

import type { managedPrayer } from "@/lib/community/managed";
import { prayerCalculation } from "@/lib/prayer/calculate";
import { hijriDate } from "@/lib/time/hijri";

import type { PrayerTodayView } from "./PrayerBody";
import { nextPrayer, todayLabel, todayRows } from "./today";

/**
 * Today's prayer block on /prayer from the managed prayer data, on the server
 * clock: one builder for the page and the Pages preview (PR5b WP4).
 */
export function prayerTodayView(
  {
    prayer,
    settings,
    starts,
    startsUnavailable,
  }: Awaited<ReturnType<typeof managedPrayer>>,
  now: Date,
): PrayerTodayView {
  const next = nextPrayer(starts, now);
  return {
    dateLabel: todayLabel(now),
    hijri: hijriDate(now, settings.hijri_adjustment),
    rows: todayRows(starts, prayer.times),
    startsUnavailable,
    nextId: next && next.day === 0 ? next.id : null,
    method: prayerCalculation.label,
  };
}
