import { weekdayDateLabel } from "../time/date-label";
import { URGENT_BAND_MAX_CHARS, type CommunityRecord } from "./schema";

/**
 * The event question (review 2, 2026-10-05; the Jumu'ah pattern, PR5a D-3):
 * saving a published event with a new date, or cancelling it, asks "Also
 * post an announcement?", with an editable text and "Hide at" prefilled
 * here. Pure and browser-safe: the event form prefills with it and the save
 * checks with it.
 */

/** What changed for visitors: a new date, or a cancellation. */
export type EventChange = "moved" | "cancelled";

/** The event as typed, as far as the question needs it. */
export type TypedEvent = {
  title: string;
  date: string;
  end_date: string;
  status: string;
  published: boolean;
};

/**
 * Whether saving asks the question: the saved event is on the website and
 * stays there, and it is cancelled now or its date changes (a known new
 * date is just the date: Postponed means "new date not known yet").
 */
export function eventChange(
  saved: Pick<
    CommunityRecord,
    "date" | "status" | "published" | "updated_at" | "archived_at"
  > | null,
  typed: TypedEvent,
): EventChange | null {
  if (!saved?.updated_at || !saved.published || saved.archived_at) return null;
  if (!typed.published) return null;
  if (typed.status === "cancelled")
    return saved.status === "cancelled" ? null : "cancelled";
  return typed.date && typed.date !== saved.date ? "moved" : null;
}

/** The title cut to fit the urgent band with the words around it. */
const fit = (title: string, room: number) =>
  title.length <= room ? title : `${title.slice(0, room - 1).trimEnd()}…`;

/**
 * The prefilled text: "Iftar at the Musallah moves to Sat 17 Oct", or
 * "Cancelled: Iftar at the Musallah"; at most `URGENT_BAND_MAX_CHARS`.
 */
export function eventNoticeText(change: EventChange, typed: TypedEvent) {
  if (change === "cancelled") {
    const prefix = "Cancelled: ";
    return prefix + fit(typed.title, URGENT_BAND_MAX_CHARS - prefix.length);
  }
  const suffix = ` moves to ${weekdayDateLabel(typed.date)}`;
  return fit(typed.title, URGENT_BAND_MAX_CHARS - suffix.length) + suffix;
}

/**
 * The prefilled "Hide at": the end of the event's last day as it was saved,
 * or of the new last day when that comes first, so the notice stays until
 * nobody can come on the wrong day. As the date and time boxes show it.
 */
export function eventNoticeEnd(
  change: EventChange,
  saved: Pick<CommunityRecord, "date" | "end_date">,
  typed: TypedEvent,
): { date: string; time: string } {
  const before = saved.end_date || saved.date;
  const after = typed.end_date || typed.date;
  return {
    date: change === "moved" && after && after < before ? after : before,
    time: "23:59",
  };
}
