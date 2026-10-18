import { weekdayDateLabel } from "@/lib/time/date-label";
import { formatTimeOfDay } from "@/lib/time/time-of-day";

/** Shared date/time formatting for every calendar surface. */

const noon = (date: string) => new Date(`${date}T12:00:00`);

export function dateParts(value: string) {
  const date = noon(value);
  if (Number.isNaN(date.valueOf()))
    return { weekday: "TBA", day: "—", month: "", full: value };
  return {
    weekday: new Intl.DateTimeFormat("en", { weekday: "short" })
      .format(date)
      .toUpperCase(),
    day: new Intl.DateTimeFormat("en", { day: "2-digit" }).format(date),
    month: new Intl.DateTimeFormat("en", { month: "short" })
      .format(date)
      .toUpperCase(),
    full: new Intl.DateTimeFormat("en", { dateStyle: "full" }).format(date),
  };
}

/** A stored 24-hour `HH:MM` as the 12-hour label ("5:00 PM"); null when empty. */
export function formatEventTime(value?: string | null): string | null {
  return value ? formatTimeOfDay(value) : null;
}

/** An event's days and times, as `eventEntry` gives them. */
type When = {
  date: string;
  start_time?: string | null;
  end_date?: string | null;
  end_time?: string | null;
};

/** Whether the event ends on a later day than it starts (review 2, 2026-10-05). */
export const spansDays = (event: When) =>
  Boolean(event.end_date && event.end_date > event.date);

/**
 * An event's times on its card ("5:00 PM – 7:00 PM", "All day"). An event
 * over several days ends with its last day: "5:00 PM – Sun 18 Oct, 2:00 PM",
 * or "Until Sun 18 Oct" when it is all day (review 2, 2026-10-05).
 */
export function timeRange(event: When): string {
  const from = formatEventTime(event.start_time);
  const to = formatEventTime(event.end_time);
  if (spansDays(event)) {
    const last = weekdayDateLabel(event.end_date ?? event.date);
    const end = to ? `${last}, ${to}` : last;
    return from ? `${from} – ${end}` : `Until ${end}`;
  }
  if (!from) return "All day";
  return to && to !== from ? `${from} – ${to}` : from;
}

/**
 * The event page's "when" line: "Friday 16 October 2026 · 5:00 PM – 7:00 PM",
 * or, over several days, "Fri 16 Oct, 5:00 PM – Sun 18 Oct 2026, 2:00 PM"
 * (review 2, 2026-10-05).
 */
export function whenLine(event: When): string {
  if (!spansDays(event))
    return `${dateParts(event.date).full} · ${timeRange(event)}`;
  const at = (day: string, time: string | null) =>
    time ? `${day}, ${time}` : day;
  const last = event.end_date ?? event.date;
  return `${at(weekdayDateLabel(event.date), formatEventTime(event.start_time))} – ${at(`${weekdayDateLabel(last)} ${last.slice(0, 4)}`, formatEventTime(event.end_time))}`;
}

export function monthKey(date: string) {
  const parsed = noon(date);
  if (Number.isNaN(parsed.valueOf())) return "";
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(parsed);
}
