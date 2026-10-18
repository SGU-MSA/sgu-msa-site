import { calendarDetails } from "@/lib/calendar/ics";
import { getSite } from "@/lib/content";
import { managedEvents } from "@/lib/community/managed";
import { whenLine } from "@/features/calendar/format";
import { ogCard } from "@/lib/seo/og-card";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "The SGU MSA seal beside this page's title";

/** The event's link-preview card: its title ("Cancelled: …" when cancelled), date and place; the site's card when the event cannot be read. */
export default async function Image({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const [site, events] = await Promise.all([
    getSite(),
    managedEvents().catch(() => null),
  ]);
  const event = events?.events.find((item) => item.id === eventId);
  if (!event)
    return ogCard({
      kicker: site.brand.short_name,
      heading: site.brand.name,
      subheading: site.meta?.description,
    });
  const details = calendarDetails(event);
  return ogCard({
    kicker: `${site.brand.short_name} · ${event.category_name ?? "Event"}`,
    heading: details.title,
    subheading: [whenLine(event), details.location].filter(Boolean).join(" · "),
  });
}
