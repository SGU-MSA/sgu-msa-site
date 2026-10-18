import { eventToIcs, icsFileName } from "@/lib/calendar/ics";
import { managedEvents } from "@/lib/community/managed";
import { requestNow } from "@/lib/runtime/public-cache";

/**
 * One event's calendar file (review 2, 2026-10-05): "Add to Calendar" on
 * iPhone, iPad and Mac, the "Apple or other (file)" choice elsewhere, and
 * the link without JavaScript. Served as text/calendar, "inline", so iPhone
 * and iPad open Apple Calendar's add sheet instead of saving a download.
 * Always the event as saved now, so it never lags behind a board edit.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  // Per request (review fixes PR-C): `managedEvents` reads after `requestNow`.
  const now = await requestNow();
  const event = (await managedEvents()).events.find(
    (entry) => entry.id === eventId,
  );
  if (!event) return new Response("Not found", { status: 404 });
  return new Response(eventToIcs(event, now), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${icsFileName(event)}"`,
      "Cache-Control": "no-store",
    },
  });
}
