import Link from "next/link";

import { AddToCalendar } from "./AddToCalendar";
import c from "./calendar.module.css";
import { EventStatus, struckWhenCancelled } from "./EventStatus";
import { EventTags } from "./EventTags";
import { dateParts, timeRange } from "./format";
import type { CalendarEntry } from "./types";

/**
 * One event as a small paper sheet: date · title · status (PR5a) · time ·
 * location · category · organization · term · Add to Calendar. The next upcoming event
 * carries the ink-ring colour on its edge.
 */
export function EventCard({
  event,
  isNext,
}: {
  event: CalendarEntry;
  isNext: boolean;
}) {
  const date = dateParts(event.date);
  const time = timeRange(event);

  return (
    <li
      id={`event-${event.id}`}
      className={isNext ? `${c.card} ${c.cardNext}` : c.card}
    >
      <time dateTime={event.date} className={c.cardDate}>
        <span className={c.cardDay}>{date.day}</span>
        <span className={c.cardWeekday}>{date.weekday}</span>
      </time>
      <div className={c.cardBody}>
        <Link
          href={`/calendar/${event.id}`}
          className={`${c.cardTitle} ${struckWhenCancelled(event)}`}
        >
          {event.title}
        </Link>
        <EventStatus event={event} />
        <p className={c.cardMeta}>
          {[time, event.location].filter(Boolean).join(" · ")}
        </p>
        <div className={c.cardFoot}>
          <EventTags event={event} />
          <AddToCalendar links={event.calendar} title={event.title} />
        </div>
      </div>
    </li>
  );
}
