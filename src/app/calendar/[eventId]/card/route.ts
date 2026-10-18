import { getSite } from "@/lib/content";
import { managedEvents } from "@/lib/community/managed";
import { eventCard, siteCard } from "@/features/seo/card-text";
import { ogCard } from "@/lib/seo/og-card";

/**
 * The event's link-preview card (a plain route, not an `opengraph-image`
 * file, so the page can put a version of the card's words in its address and
 * an edit shows at once; contract D-12). 404 when the event does not exist.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const [site, events] = await Promise.all([getSite(), managedEvents()]);
  const event = events.events.find((item) => item.id === eventId);
  if (!event) return new Response("Not found", { status: 404 });
  const card = await ogCard({
    ...eventCard(event, site),
    fallback: siteCard(site),
  });
  // A versioned address never changes meaning: keep it for a year.
  if (new URL(request.url).searchParams.has("v"))
    card.headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return card;
}
