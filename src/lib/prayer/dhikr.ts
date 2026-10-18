import { TIMEZONE } from "@/lib/community/schema";
import type { DhikrSlotName } from "@/lib/content/schemas";

/** How long after a prayer begins the hero shows the after-prayer tasbih. */
export const AFTER_PRAYER_MINUTES = 40;

const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;

/**
 * Which remembrance the Home hero shows now (ADR 0018, "dhikr of the hour"),
 * from today's calculated prayer starts (`calculatePrayers`, day 0 rows):
 *
 * - within 40 minutes of a prayer starting → after-prayer;
 * - Friday between Fajr and Maghrib → friday (salawat);
 * - Fajr to Dhuhr → morning; Asr to Isha → evening;
 * - Isha to Fajr → night; the rest of the Dhuhr–Asr window → after-prayer.
 *
 * Pure: `now` comes from the shared server clock. Returns null when today's
 * five prayer starts are unavailable, so the hero shows no dhikr line.
 */
export function dhikrSlot(
  starts: readonly { id: string; iso: string; day?: number }[],
  now: Date,
  isFriday: boolean,
): DhikrSlotName | null {
  const today = starts.filter((row) => (row.day ?? 0) === 0);
  const at: Record<string, number> = {};
  for (const id of PRAYERS) {
    const row = today.find((start) => start.id === id);
    const time = row ? Date.parse(row.iso) : NaN;
    if (!Number.isFinite(time)) return null;
    at[id] = time;
  }
  const t = now.getTime();
  const window = AFTER_PRAYER_MINUTES * 60_000;
  if (PRAYERS.some((id) => t >= at[id] && t < at[id] + window))
    return "after-prayer";
  if (isFriday && t >= at.fajr && t < at.maghrib) return "friday";
  if (t >= at.fajr && t < at.dhuhr) return "morning";
  if (t >= at.asr && t < at.isha) return "evening";
  if (t >= at.isha || t < at.fajr) return "night";
  return "after-prayer";
}

/** Whether `now` falls on a Friday in Grenada. */
export function isFridayInGrenada(now: Date): boolean {
  return (
    new Intl.DateTimeFormat("en", { timeZone: TIMEZONE, weekday: "long" })
      .format(now)
      .toLowerCase() === "friday"
  );
}
