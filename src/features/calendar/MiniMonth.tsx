import { ChevronLeft, ChevronRight } from "lucide-react";

import { InkRing } from "@/shared/ui/InkRing";

import c from "./calendar.module.css";
import { DayEvents } from "./DayEvents";
import type { CalendarEntry } from "./types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Dated = Pick<
  CalendarEntry,
  | "id"
  | "date"
  | "title"
  | "category_name"
  | "category_tone"
  | "start_time"
  | "end_date"
  | "end_time"
>;
export type DayEvent = Dated;

/**
 * The almanac (D-1): a small month on a paper sheet, always open beside the
 * events. Today is ringed in ink (review fixes P3: today, never the next
 * event); a day with an event carries a dot in its category's colour and
 * jumps to it. Without `onMonthChange` it is a still picture.
 */
export function MiniMonth({
  events,
  month,
  onMonthChange,
  today,
  hrefFor,
}: {
  events: Dated[];
  month: Date;
  onMonthChange?: (date: Date) => void;
  /** Today in Grenada ("2026-10-07"), ringed. */
  today?: string | null;
  hrefFor: (event: Dated) => string;
}) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const offset = new Date(year, monthIndex, 1).getDay();
  const cells = Array.from({ length: offset + days }, (_, index) =>
    index < offset ? null : index - offset + 1,
  );
  const name = new Intl.DateTimeFormat("en", { month: "long" }).format(month);

  return (
    <div className={c.almanacWrap}>
      <div className={c.almanacBack} aria-hidden="true" />
      <div className={c.almanac}>
        <div className={c.almanacHead}>
          {onMonthChange ? (
            <button
              type="button"
              className={c.almanacNav}
              onClick={() => onMonthChange(new Date(year, monthIndex - 1, 1))}
            >
              <span className="sr-only">Previous month</span>
              <ChevronLeft aria-hidden="true" size={16} />
            </button>
          ) : null}
          <h2
            className={c.almanacTitle}
            aria-live={onMonthChange ? "polite" : undefined}
          >
            {name} <em>{year}</em>
          </h2>
          {onMonthChange ? (
            <button
              type="button"
              className={c.almanacNav}
              onClick={() => onMonthChange(new Date(year, monthIndex + 1, 1))}
            >
              <span className="sr-only">Next month</span>
              <ChevronRight aria-hidden="true" size={16} />
            </button>
          ) : null}
        </div>
        <div className={c.grid}>
          {WEEKDAYS.map((day) => (
            <abbr key={day} title={day} className={c.weekday}>
              {day[0]}
            </abbr>
          ))}
          {cells.map((day, index) => {
            if (!day) return <span key={`blank-${index}`} />;
            const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const onDay = events.filter((event) => event.date === key);
            const first = onDay[0];
            const isToday = key === today;
            const ring = isToday ? <InkRing className={c.cellRing} /> : null;
            if (!first)
              return (
                <span
                  key={key}
                  className={isToday ? `${c.cell} ${c.cellToday}` : c.cell}
                  aria-current={isToday ? "date" : undefined}
                >
                  {ring}
                  <span className={c.cellDay}>{day}</span>
                  {isToday ? <span className="sr-only"> (today)</span> : null}
                </span>
              );
            // OPTION calendar-dots: a day with several events shows up to three
            // dots and opens a list of all of them instead of jumping to one.
            if (onDay.length > 1)
              return (
                <DayEvents
                  key={key}
                  day={day}
                  isToday={isToday}
                  ring={ring}
                  className={`${c.cell} ${c.cellEvent} ${c.cellButton}${isToday ? ` ${c.cellToday}` : ""}`}
                  label={`${day} ${name}${isToday ? " (today)" : ""}: ${onDay.length} events: ${onDay.map((event) => event.title).join("; ")}`}
                  heading={new Intl.DateTimeFormat("en", {
                    weekday: "short",
                    day: "numeric",
                    month: "long",
                  }).format(new Date(year, monthIndex, day))}
                  events={onDay.map((event) => ({
                    ...event,
                    href: hrefFor(event),
                  }))}
                />
              );
            return (
              <a
                key={key}
                href={hrefFor(first)}
                className={`${c.cell} ${c.cellEvent}${isToday ? ` ${c.cellToday}` : ""}`}
                aria-current={isToday ? "date" : undefined}
                aria-label={`${day} ${name}${isToday ? " (today)" : ""}: ${[first.title, first.category_name].filter(Boolean).join(", ")}`}
              >
                {ring}
                <span className={c.cellDay}>{day}</span>
                <span
                  aria-hidden="true"
                  className={`${c.cellDot} ${first.category_tone ? `category-${first.category_tone}` : ""}`}
                />
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
