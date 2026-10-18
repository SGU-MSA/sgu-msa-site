import { eventsToIcs, feedEvents } from "@/lib/calendar/ics";
import { managedEvents } from "@/lib/community/managed";
import { getSite } from "@/lib/content";
import { requestNow } from "@/lib/runtime/public-cache";
import { siteUrl } from "@/lib/site-config";

/**
 * The subscribable calendar of public events (D-2): every event the Events
 * page shows, in one feed that calendar apps poll. The CDN absorbs the
 * polling for 5 minutes. When events cannot be read it answers 503, never
 * an empty calendar, which would delete every event from subscribers (D-6).
 */
export async function GET() {
  const [now, content, site] = await Promise.all([
    requestNow(),
    managedEvents(),
    getSite(),
  ]);
  if (content.unavailable)
    return new Response("Events are temporarily unavailable.", {
      status: 503,
      headers: {
        "Retry-After": "3600",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
      },
    });
  const body = eventsToIcs(
    feedEvents(content.events, content.today ?? ""),
    {
      name: site.brand.short_name,
      description: site.meta?.description,
      url: new URL("/calendar.ics", siteUrl).href,
      eventUrl: (id) =>
        new URL(`/calendar/${encodeURIComponent(id)}`, siteUrl).href,
    },
    now,
  );
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="sgu-msa.ics"',
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "X-Robots-Tag": "noindex",
    },
  });
}
