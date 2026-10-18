import "server-only";

import { managedEvents, managedPrayer } from "@/lib/community/managed";
import { isUpcoming } from "@/lib/community/schema";
import { loadReminders } from "@/lib/content";
import { prayerCalculation } from "@/lib/prayer/calculate";
import { dhikrSlot, isFridayInGrenada } from "@/lib/prayer/dhikr";
import { requestNow } from "@/lib/runtime/public-cache";
import { hijriDate } from "@/lib/time/hijri";
import { nextPrayer, todayLabel, todayRows } from "@/features/prayer/today";

import type { HomeHeroProps } from "./HomeHero";

/**
 * What Home shows that is not Home's page text: today's prayer block with
 * the dhikr of the hour, and this week's events. One reader for the page
 * and the Pages preview (PR5b WP4), on the shared server clock.
 */
export async function loadHomeLive() {
  const [
    { prayer, jumuah, settings, starts, startsUnavailable },
    events,
    reminders,
  ] = await Promise.all([managedPrayer(), managedEvents(), loadReminders()]);
  const now = await requestNow();
  const isFriday = isFridayInGrenada(now);
  // Reminders follow the same calculated starts and the shared server clock.
  const slot = dhikrSlot(starts, now, isFriday);
  const today: Omit<HomeHeroProps, "hero"> = {
    dhikr: slot
      ? reminders.dhikr.find((entry) => entry.slot === slot)
      : undefined,
    hijri: hijriDate(now, settings.hijri_adjustment),
    rows: todayRows(starts, prayer.times),
    next: nextPrayer(starts, now),
    startsUnavailable,
    method: prayerCalculation.label,
    lastUpdated: prayer.last_updated_label,
    jumuah,
    dateLabel: todayLabel(now),
    isFriday,
  };
  return {
    today,
    week: {
      events: events.events
        .filter((event) => isUpcoming(event, now))
        .slice(0, 4),
      unavailable: events.unavailable,
    },
  };
}

export type HomeLive = Awaited<ReturnType<typeof loadHomeLive>>;
