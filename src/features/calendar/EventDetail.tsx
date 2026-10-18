import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import type { PricedItemButton } from "@/lib/community/payments";
import { eventStatusName } from "@/lib/community/schema";
import type { Reminder, SiteEvent } from "@/lib/content/schemas";
import { Container } from "@/shared/ui/Container";
import { MarginNote } from "@/shared/ui/MarginNote";
import quiet from "@/shared/ui/page.module.css";
import { SafeImage } from "@/shared/ui/SafeImage";

import c from "./calendar.module.css";
import { EventHeader } from "./EventHeader";
import { MiniMonth } from "./MiniMonth";

/**
 * An event's own page (`/calendar/[eventId]`): the story first, the almanac
 * of its month beside it (its day dotted, today ringed). The event page and the event editor's
 * Preview (review fixes P1, item 8) draw this same page.
 */
export function EventDetail({
  event,
  ticket = null,
  verse = null,
  today = null,
}: {
  event: SiteEvent;
  ticket?: PricedItemButton | null;
  verse?: Reminder | null;
  /** Today in Grenada, ringed on the month (review fixes P3). */
  today?: string | null;
}) {
  const day = new Date(`${event.date}T12:00:00`);
  const month = Number.isNaN(day.valueOf())
    ? null
    : new Date(day.getFullYear(), day.getMonth(), 1);

  return (
    <div className={quiet.page}>
      <Container>
        <Link href="/calendar" className={c.back}>
          <ArrowLeft aria-hidden="true" size={14} strokeWidth={1.5} />
          All events
        </Link>

        <article className={c.detail}>
          <div className={c.detailMain}>
            <EventHeader event={event} ticket={ticket} />
            {event.description ? (
              <p className={c.detailCopy}>{event.description}</p>
            ) : null}
            {event.image ? (
              <div className={c.photo}>
                <SafeImage
                  image={event.image}
                  fill
                  sizes="(min-width: 1024px) 60vw, 100vw"
                  fit="contain"
                />
              </div>
            ) : null}
            {event.organization === "SGU" ||
            event.verification_status === "pending" ? (
              <p className={c.notice}>
                {event.organization === "SGU"
                  ? "This is an SGU date shown for convenience. The MSA is not the authority on academic scheduling — always verify through official SGU systems."
                  : "This entry has not yet been confirmed. Details may change."}
              </p>
            ) : null}
          </div>

          <div className={c.detailSide}>
            {month ? (
              <MiniMonth
                events={[event]}
                month={month}
                today={today}
                hrefFor={() => "#event-title"}
              />
            ) : null}
            <dl className={c.facts}>
              {event.location ? (
                <div>
                  <dt>Location</dt>
                  <dd>{event.location}</dd>
                </div>
              ) : null}
              {event.source ? (
                <div>
                  <dt>Source</dt>
                  <dd>{event.source}</dd>
                </div>
              ) : null}
              <div>
                <dt>Status</dt>
                <dd>{eventStatusName(event)}</dd>
              </div>
            </dl>
            {verse ? <MarginNote reminder={verse} /> : null}
          </div>
        </article>
      </Container>
    </div>
  );
}
