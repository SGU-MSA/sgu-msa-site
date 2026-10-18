import type { SiteEvent } from "@/lib/content/schemas";
import { eventStatusLine } from "@/lib/community/schema";

import c from "./calendar.module.css";

/**
 * The status line under a cancelled or postponed event's title (PR5a D-20):
 * "Cancelled: (reason)" or "Postponed: new date to be announced"; nothing
 * while scheduled. One line for every public view.
 */
export function EventStatus({
  event,
  className = "",
  as: Line = "p",
}: {
  event: Pick<SiteEvent, "status" | "status_note">;
  className?: string;
  /** "span" inside a link (Home's week). */
  as?: "p" | "span";
}) {
  const line = eventStatusLine(event);
  return line ? (
    <Line className={`${c.status} ${className}`} data-status={event.status}>
      {line}
    </Line>
  ) : null;
}

/** A cancelled event's title is struck through (with its line, never colour alone). */
export const struckWhenCancelled = (event: Pick<SiteEvent, "status">) =>
  event.status === "cancelled" ? c.struck : "";
