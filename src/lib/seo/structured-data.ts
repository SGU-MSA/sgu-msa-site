/**
 * schema.org data for the public site, built from the board's page text and
 * event rows (site-essentials contract). Pure: no reads, so every rule is
 * unit-tested. Callers render it only on an indexable deployment.
 */
import { calendarTimes } from "@/lib/calendar/ics";
import type { SiteContent, SiteEvent } from "@/lib/content/schemas";

/** The data as the text of a JSON-LD block: `<` is escaped so no text can close the script tag. */
export function jsonLdText(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** The site's Organization (the home page's block). */
export function organizationJsonLd(
  site: SiteContent,
  origin: string,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.brand.name,
    url: origin,
    email: site.brand.email,
    sameAs: site.social
      .filter((item) => item.url.startsWith("https://"))
      .map((item) => item.url),
  };
}

const hour = 3_600_000;
/** A UTC instant as Grenada wall time with its offset ("2026-10-16T17:00:00-04:00"). */
const grenada = (instant: Date) =>
  `${new Date(instant.getTime() - 4 * hour).toISOString().slice(0, 19)}-04:00`;

const statusUrl = {
  scheduled: "https://schema.org/EventScheduled",
  cancelled: "https://schema.org/EventCancelled",
  postponed: "https://schema.org/EventPostponed",
} as const;

/**
 * An event the MSA organises, as schema.org Event; `null` for a university
 * (SGU) date or an event with no place, which Google would reject (D-3).
 */
export function eventJsonLd(
  event: SiteEvent,
  site: SiteContent,
  origin: string,
): Record<string, unknown> | null {
  const place = event.location?.trim();
  if (event.organization !== "MSA" || !place) return null;
  const when = calendarTimes(event);
  const dates = when.allDay
    ? { startDate: when.first, endDate: event.end_date ?? event.date }
    : {
        startDate: grenada(when.start),
        ...(when.end ? { endDate: grenada(when.end) } : {}),
      };
  const image = event.image?.src;
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    ...dates,
    eventStatus: statusUrl[event.status ?? "scheduled"],
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: { "@type": "Place", name: place, address: place },
    organizer: { "@type": "Organization", name: site.brand.name, url: origin },
    ...(event.description ? { description: event.description } : {}),
    url: `${origin}/calendar/${event.id}`,
    ...(image
      ? { image: [/^https?:\/\//.test(image) ? image : `${origin}${image}`] }
      : {}),
  };
}

/** The Google Search Console tag for the root metadata: only with a token, on the live site. */
export function searchConsoleVerification(
  token: string | null,
  indexable: boolean,
) {
  return token && indexable ? { google: token } : undefined;
}
