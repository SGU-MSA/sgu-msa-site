import type { CalendarLinks } from "@/lib/calendar/targets";
import type { SiteEvent } from "@/lib/content/schemas";

export type { SiteEvent };

/** An event plus the derived display values the UI needs. */
export type CalendarEntry = SiteEvent & {
  /** "Add to Calendar": the file, Google Calendar and Outlook (review 2). */
  calendar: CalendarLinks;
};
