import type { SiteEvent } from "../content/schemas";

/**
 * Minimal RFC 5545 generator for a single public event.
 *
 * Deliberately dependency-free and provider-neutral: it produces a file every
 * calendar client understands, so no Google Calendar API integration is needed
 * for a student to save an event. Reusable for any future event source.
 */

const PRODID = "-//SGU MSA//Website//EN";

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Folds long lines at 75 octets, as required by the spec. */
function fold(line: string): string {
  const encoder = new TextEncoder();
  let current = "";
  let bytes = 0;
  const parts: string[] = [];
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (bytes + size > 75) {
      parts.push(current);
      current = " ";
      bytes = 1;
    }
    current += character;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n");
}

function toDateValue(date: string): string {
  return date.replace(/-/g, "");
}

/** `HH:MM` (24h) or `H:MM AM/PM` → `HHMMSS`; null when unparseable. */
function toTimeValue(time?: string | null): string | null {
  if (!time) return null;
  const trimmed = time.trim();

  const twelve = /^(\d{1,2}):(\d{2})\s*([AaPp])\.?[Mm]\.?$/.exec(trimmed);
  if (twelve) {
    let hours = Number(twelve[1]) % 12;
    if (twelve[3].toLowerCase() === "p") hours += 12;
    return `${String(hours).padStart(2, "0")}${twelve[2]}00`;
  }

  const twentyFour = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (twentyFour) {
    const hours = Number(twentyFour[1]);
    if (hours > 23) return null;
    return `${String(hours).padStart(2, "0")}${twentyFour[2]}00`;
  }

  return null;
}

function addOneDay(date: string): string {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

/** `HHMMSS` on `date`, Grenada wall time (UTC−04:00), as a UTC instant. */
function toUtc(date: string, time: string): Date {
  return new Date(`${date}T${time.slice(0, 2)}:${time.slice(2, 4)}:00-04:00`);
}
/** An instant as an iCalendar UTC date-time ("20261016T210000Z"). */
const icsInstant = (instant: Date) =>
  instant.toISOString().replace(/[-:]/g, "").replace(".000", "");

/** E-8: SEQUENCE counts from here, so it fits RFC 5545's integer for decades. */
const sequenceEpoch = Date.parse("2026-01-01T00:00:00Z");

/**
 * The calendar file's SEQUENCE (E-8): the last save in whole seconds since
 * 2026-01-01, so a re-added file always replaces an older one; 0 when unknown.
 */
function sequenceOf(updatedAt?: string | null): number {
  const saved = Date.parse(updatedAt ?? "");
  if (Number.isNaN(saved)) return 0;
  return Math.max(0, Math.floor((saved - sequenceEpoch) / 1000));
}

/** STATUS (D-20): cancelled; tentative while postponed; confirmed otherwise. */
function statusOf(event: SiteEvent): "CANCELLED" | "TENTATIVE" | "CONFIRMED" {
  if (event.status === "cancelled") return "CANCELLED";
  if (event.status === "postponed") return "TENTATIVE";
  return "CONFIRMED";
}

/**
 * When an event happens, for every calendar (review 2, 2026-10-05): the
 * file, Google Calendar and Outlook are built from this one reading. All
 * day: its first day and the day after its last day (calendars count the end
 * as exclusive). With a start time: Grenada wall times as instants, ending
 * at the end time on the last day, at the end of a later last day without an
 * end time, or not at all (`end` null) for a one-day event with no end time.
 */
export type CalendarTimes =
  | { allDay: true; first: string; afterLast: string }
  | { allDay: false; start: Date; end: Date | null };

export function calendarTimes(event: SiteEvent): CalendarTimes {
  const start = toTimeValue(event.start_time);
  const end = toTimeValue(event.end_time);
  const last =
    event.end_date && event.end_date > event.date ? event.end_date : null;
  if (!start)
    return {
      allDay: true,
      first: event.date,
      afterLast: addOneDay(last ?? event.date),
    };
  return {
    allDay: false,
    start: toUtc(event.date, start),
    end: end
      ? toUtc(last ?? event.date, end)
      : last
        ? toUtc(last, "235900")
        : null,
  };
}

/** What every calendar shows: the name ("Cancelled: …"), place and text. */
export function calendarDetails(event: SiteEvent) {
  const cancelled = statusOf(event) === "CANCELLED";
  return {
    title: cancelled ? `Cancelled: ${event.title}` : event.title,
    location: event.location ?? "",
    description: [
      event.description,
      event.source ? `Source: ${event.source}` : null,
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}

/**
 * Campus wall-clock times are converted to UTC instants (Grenada UTC−04:00).
 * One event keeps one UID; its status and SEQUENCE say what changed (D-20).
 */
export function eventToIcs(event: SiteEvent, stamp = new Date()): string {
  const dtstamp = `${stamp.toISOString().slice(0, 19).replace(/[-:]/g, "")}Z`;
  const details = calendarDetails(event);
  const when = calendarTimes(event);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.id}@sgu-msa`,
    `DTSTAMP:${dtstamp}`,
    `SEQUENCE:${sequenceOf(event.updated_at)}`,
    `STATUS:${statusOf(event)}`,
    `SUMMARY:${escapeText(details.title)}`,
  ];

  if (when.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${toDateValue(when.first)}`);
    lines.push(`DTEND;VALUE=DATE:${toDateValue(when.afterLast)}`);
  } else {
    lines.push(`DTSTART:${icsInstant(when.start)}`);
    if (when.end) lines.push(`DTEND:${icsInstant(when.end)}`);
  }

  if (details.location) lines.push(`LOCATION:${escapeText(details.location)}`);
  if (details.description)
    lines.push(`DESCRIPTION:${escapeText(details.description)}`);

  lines.push(
    `CATEGORIES:${escapeText(
      [event.organization, event.category_name]
        .filter(Boolean)
        .join(" / ")
        .toUpperCase(),
    )}`,
  );
  lines.push("END:VEVENT", "END:VCALENDAR");

  return lines.map(fold).join("\r\n");
}

export function icsFileName(event: SiteEvent): string {
  const slug = event.id
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `sgu-msa-${slug || "event"}.ics`;
}
