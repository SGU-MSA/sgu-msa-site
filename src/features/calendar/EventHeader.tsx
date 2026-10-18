import { calendarLinks } from "@/lib/calendar/targets";
import { TICKET_BUTTON } from "@/lib/community/payment-policy";
import type { PricedItemButton } from "@/lib/community/payments";
import { GiveButton } from "@/features/donate/GiveButton";
import type { SiteEvent } from "@/lib/content/schemas";
import { systemText } from "@/lib/system-text";
import { safeHref } from "@/lib/url";
import { ButtonLink } from "@/shared/ui/ButtonLink";

import { AddToCalendar } from "./AddToCalendar";
import c from "./calendar.module.css";
import { EventStatus, struckWhenCancelled } from "./EventStatus";
import { EventTags } from "./EventTags";
import { whenLine } from "./format";

/**
 * The top of an event's page: tags, title, status line (PR5a D-20), when, Add
 * to calendar and "Sign up →" (D-7). The event page and the event editor's
 * Preview render the same header. The event page also passes its ticket
 * (PR6 WP-9, P-72 B): "See price and buy ↗" while it is on sale, filled,
 * with Add to Calendar outlined beside it (D-82).
 */
export function EventHeader({
  event,
  ticket = null,
}: {
  event: SiteEvent;
  ticket?: PricedItemButton | null;
}) {
  const registration = safeHref(event.registration_url);
  return (
    <>
      <EventTags event={event} />
      <h1
        id="event-title"
        className={`${c.detailTitle} ${struckWhenCancelled(event)}`}
      >
        {event.title}
      </h1>
      <EventStatus event={event} />
      <p className={c.detailWhen}>
        <time dateTime={event.date}>{whenLine(event)}</time>
      </p>
      <div className={c.detailActions}>
        {ticket ? (
          <GiveButton href={ticket.giveHref} label={TICKET_BUTTON} />
        ) : null}
        <AddToCalendar
          variant={ticket ? "outline" : "ink"}
          links={calendarLinks(event)}
          title={event.title}
        />
        {registration ? (
          <ButtonLink href={registration} variant="outline">
            {systemText.buttons.signUp}
          </ButtonLink>
        ) : null}
      </div>
    </>
  );
}
