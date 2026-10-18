import Link from "next/link";

import type { Reminder } from "@/lib/content/schemas";
import { Container } from "@/shared/ui/Container";
import { MarginNote } from "@/shared/ui/MarginNote";

import { EventStatus, struckWhenCancelled } from "../calendar/EventStatus";
import {
  dateParts,
  formatEventTime,
  spansDays,
  timeRange,
} from "../calendar/format";
import type { SiteEvent } from "../calendar/types";
import { InkHeading } from "@/shared/ui/InkHeading";
import h from "./home.module.css";
import s from "@/shared/ui/page.module.css";

type WeekSummaryProps = {
  heading: string;
  events: SiteEvent[];
  emptyMessage: string;
  verse?: Reminder | null;
};

/** Upcoming events on Home: a hairline list beside the heading and the margin note verse. */
export function WeekSummary({
  heading,
  events,
  emptyMessage,
  verse,
}: WeekSummaryProps) {
  return (
    <Container className={s.above}>
      <section className={s.split} aria-labelledby="upcoming">
        <div className={s.splitSide}>
          <InkHeading id="upcoming" text={heading} />
          <p className={s.actions}>
            <Link href="/calendar" className={s.underline}>
              <span>View full calendar</span>
            </Link>
          </p>
          {verse ? <MarginNote reminder={verse} /> : null}
        </div>
        {events.length ? (
          <ol className={`${s.list} ${s.splitMain}`}>
            {events.map((event) => {
              const date = dateParts(event.date);
              // Over several days, the line says until when (review 2).
              const time = spansDays(event)
                ? timeRange(event)
                : formatEventTime(event.start_time);
              return (
                <li key={event.id} className={h.event}>
                  <Link href={`/calendar/${event.id}`} className={h.eventLink}>
                    <time dateTime={event.date} className={h.eventDay}>
                      {date.day} <small>{date.month}</small>
                    </time>
                    <span>
                      <span className={h.eventTitle}>
                        <span className={struckWhenCancelled(event)}>
                          {event.title}
                        </span>
                        {event.category_name ? (
                          <span className={h.tag}>{event.category_name}</span>
                        ) : null}
                      </span>
                      <span className={h.eventMeta}>
                        {[date.weekday, time, event.location]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      <EventStatus
                        event={event}
                        as="span"
                        className={h.eventStatus}
                      />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className={`${s.list} ${s.splitMain}`}>
            <p className={h.empty}>{emptyMessage}</p>
          </div>
        )}
      </section>
    </Container>
  );
}
