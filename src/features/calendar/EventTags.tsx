import c from "./calendar.module.css";
import type { CalendarEntry } from "./types";

type Tagged = Pick<
  CalendarEntry,
  "category_name" | "category_tone" | "organization" | "term_name"
>;

/**
 * Category · organization · term, on the card and the event page. The
 * category and term are the board's (Lists, review fixes P3); an event
 * without one shows nothing in its place. No pending label (review fixes
 * P3: no "coming soon" or "pending" words).
 */
export function EventTags({ event }: { event: Tagged }) {
  return (
    <p className={c.tags}>
      {event.category_name ? (
        <span
          className={`${c.cat} ${event.category_tone ? `category-${event.category_tone}` : ""}`}
        >
          {event.category_name}
        </span>
      ) : null}
      <span>{event.organization}</span>
      {event.term_name ? <span>{event.term_name}</span> : null}
    </p>
  );
}
