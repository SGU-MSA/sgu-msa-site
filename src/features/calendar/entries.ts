import { calendarLinks } from "@/lib/calendar/targets";

import type { CalendarEntry, SiteEvent } from "./types";

/**
 * The calendar's entries: each public event with its "Add to Calendar"
 * addresses. Only `visibility: public` events reach the list — there is no
 * second flag.
 */
export function calendarEntries(events: SiteEvent[]): CalendarEntry[] {
  return events.map((event) => ({ ...event, calendar: calendarLinks(event) }));
}
