import { CalculationMethod, Coordinates, Madhab, PrayerTimes } from "adhan";
import { localDate } from "@/lib/community/schema";
import type { Place } from "@/lib/maps/providers/contract";
import { prayerLabel } from "./adjustments";

/**
 * The one prayer calculation (ADR 0017): Muslim World League (Fajr 18°,
 * Isha 17°) with Standard (Shafi'i) Asr. Not board-editable and not an
 * environment setting: changing it is a founders' decision, made by a
 * developer here with a new ADR. Public pages show `label`.
 */
export const prayerCalculation = {
  method: "MuslimWorldLeague",
  madhab: "Shafi",
  label: "Muslim World League · Standard Asr",
} as const;

const startIds = [
  "fajr",
  "sunrise",
  "dhuhr",
  "asr",
  "maghrib",
  "isha",
] as const;

/**
 * Today's and tomorrow's six prayer starts at the musallah pin (PR7, the
 * places port), or [] without a place (the pin could not be read) or when
 * the calculation does not give six starts in order.
 */
export function calculatePrayers(place: Place | null, now: Date) {
  if (!place) return [];
  const [year, month, day] = localDate(now).split("-").map(Number);
  const coordinates = new Coordinates(place.latitude, place.longitude);
  const params = CalculationMethod[prayerCalculation.method]();
  params.madhab = Madhab[prayerCalculation.madhab];
  // Adhan consumes date components in the runtime timezone and returns absolute instants.
  // Pass the Grenada calendar date explicitly, including the next date for overnight countdowns.
  const result = [0, 1].flatMap((offset) => {
    const date = new Date(year, month - 1, day + offset);
    const times = new PrayerTimes(coordinates, date, params);
    if (startIds.some((id) => !Number.isFinite(times[id].getTime()))) return [];
    return startIds.map((id) => ({
      id,
      day: offset,
      label: prayerLabel(id),
      iso: times[id].toISOString(),
    }));
  });
  return result.length === 12 &&
    result.every((row, index) => index === 0 || row.iso > result[index - 1].iso)
    ? result
    : [];
}

/** Today's and tomorrow's calculated starts, as `calculatePrayers` gives them. */
export type Starts = ReturnType<typeof calculatePrayers>;
