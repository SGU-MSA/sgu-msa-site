import type { SiteEvent } from "../content/schemas";
import { isAppleDevice } from "../maps/device";
import { calendarDetails, calendarTimes } from "./ics";

/**
 * Where "Add to Calendar" sends a visitor (review 2, 2026-10-05), chosen by
 * the device:
 * - `file`: iPhone, iPad and Mac open the calendar file, which Apple
 *   Calendar takes in directly;
 * - `google`: Android opens Google Calendar with the event filled in;
 * - `menu`: other computers choose Google Calendar, Outlook, or the file
 *   (Apple Calendar and every other calendar app).
 * Decided in the browser only (from its user agent, as the map's directions
 * are); the server and a browser without JavaScript give the file.
 */
export type CalendarTarget = "file" | "google" | "menu";

export function calendarTarget(userAgent: string): CalendarTarget {
  if (isAppleDevice(userAgent)) return "file";
  return /\bAndroid\b/.test(userAgent) ? "google" : "menu";
}

/** The event's calendar file, served by the event's own address. */
export function calendarFileHref(event: Pick<SiteEvent, "id">) {
  return `/calendar/${encodeURIComponent(event.id)}/ics`;
}

const compact = (instant: Date) =>
  instant.toISOString().replace(/[-:]/g, "").replace(".000", "");
const day = (date: string) => date.replace(/-/g, "");
const iso = (instant: Date) => instant.toISOString().replace(".000", "");

/**
 * Google Calendar's and Outlook's "new event" pages with the event filled
 * in, from the same times and words as the calendar file (`calendarTimes`,
 * `calendarDetails`). A one-day event with no end time ends when it starts,
 * as in the file.
 */
export function calendarLinks(event: SiteEvent): CalendarLinks {
  const when = calendarTimes(event);
  const { title, location, description } = calendarDetails(event);
  const google = new URL("https://calendar.google.com/calendar/render");
  google.searchParams.set("action", "TEMPLATE");
  google.searchParams.set("text", title);
  google.searchParams.set(
    "dates",
    when.allDay
      ? `${day(when.first)}/${day(when.afterLast)}`
      : `${compact(when.start)}/${compact(when.end ?? when.start)}`,
  );
  if (description) google.searchParams.set("details", description);
  if (location) google.searchParams.set("location", location);

  const outlook = new URL("https://outlook.live.com/calendar/0/action/compose");
  outlook.searchParams.set("rru", "addevent");
  outlook.searchParams.set("path", "/calendar/action/compose");
  outlook.searchParams.set("subject", title);
  if (when.allDay) {
    outlook.searchParams.set("startdt", when.first);
    outlook.searchParams.set("enddt", when.afterLast);
    outlook.searchParams.set("allday", "true");
  } else {
    outlook.searchParams.set("startdt", iso(when.start));
    outlook.searchParams.set("enddt", iso(when.end ?? when.start));
    outlook.searchParams.set("allday", "false");
  }
  if (description) outlook.searchParams.set("body", description);
  if (location) outlook.searchParams.set("location", location);

  return {
    file: calendarFileHref(event),
    google: google.toString(),
    outlook: outlook.toString(),
  };
}

/**
 * The subscribe addresses of the calendar feed (D-7): `file` is the webcal
 * address (Apple Calendar and any app that takes webcal), `google` and
 * `outlook` open their add-by-URL pages with the feed filled in.
 */
export function calendarFeedLinks(origin: string, name: string): CalendarLinks {
  const feed = new URL("/calendar.ics", origin);
  const webcal = `webcal://${feed.host}${feed.pathname}`;
  const google = new URL("https://calendar.google.com/calendar/render");
  google.searchParams.set("cid", webcal);
  const outlook = new URL("https://outlook.live.com/calendar/0/addfromweb");
  outlook.searchParams.set("url", feed.href);
  outlook.searchParams.set("name", name);
  return {
    file: webcal,
    google: google.toString(),
    outlook: outlook.toString(),
  };
}

/** Every "Add to Calendar" address of one event. */
export type CalendarLinks = { file: string; google: string; outlook: string };
