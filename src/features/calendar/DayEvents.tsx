"use client";

import type { ReactNode } from "react";

import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverPortal,
  PopoverTrigger,
} from "@/shared/ui/popover";

import c from "./calendar.module.css";
import { timeRange } from "./format";
import type { DayEvent } from "./MiniMonth";

/** At most this many dots under a day; the rest show as "+N". */
const MAX_DOTS = 3;

/**
 * A day of the almanac with several events (OPTION calendar-dots): up to
 * three category dots, then "+N"; pressing the day opens a small list of
 * every event that day, each linking to its card. Escape or a tap outside
 * closes it. The button's name lists every title for screen readers.
 */
export function DayEvents({
  label,
  heading,
  events,
  className,
  ring,
  day,
  isToday,
}: {
  label: string;
  heading: string;
  /** Each event with its link, worked out by the almanac. */
  events: (DayEvent & { href: string })[];
  className: string;
  ring: ReactNode;
  day: number;
  isToday: boolean;
}) {
  const shown = events.slice(0, MAX_DOTS);
  const more = events.length - shown.length;
  return (
    <Popover>
      <PopoverTrigger
        className={className}
        aria-label={label}
        aria-current={isToday ? "date" : undefined}
      >
        {ring}
        <span className={c.cellDay}>{day}</span>
        <span className={c.cellDots} aria-hidden="true">
          {shown.map((event) => (
            <span
              key={event.id}
              className={`${c.cellDotInline} ${event.category_tone ? `category-${event.category_tone}` : ""}`}
            />
          ))}
          {more > 0 ? <span className={c.cellMore}>+{more}</span> : null}
        </span>
      </PopoverTrigger>
      <PopoverPortal>
        <PopoverContent
          className={c.dayList}
          side="bottom"
          align="center"
          sideOffset={6}
          collisionPadding={12}
        >
          <p className={c.dayListHeading}>{heading}</p>
          <ul>
            {events.map((event) => (
              <li key={event.id}>
                <PopoverClose asChild>
                  <a href={event.href} className={c.dayListLink}>
                    <span
                      aria-hidden="true"
                      className={`${c.cellDotInline} ${event.category_tone ? `category-${event.category_tone}` : ""}`}
                    />
                    <span>
                      <span className={c.dayListTitle}>{event.title}</span>
                      <span className={c.dayListMeta}>
                        {[timeRange(event), event.category_name]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </a>
                </PopoverClose>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </PopoverPortal>
    </Popover>
  );
}
