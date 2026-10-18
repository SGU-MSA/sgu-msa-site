import { JUMUAH_NOTICE_MINUTES_AFTER } from "../community/schema";
import { shortDateLabel } from "../time/date-label";
import { formatTimeOfDay } from "../time/time-of-day";
import type { JumuahChange, JumuahSession } from "./adjustments";

/**
 * The Jumu'ah question (PR5a D-3, D-19): a Friday change that is new or
 * edited in this save asks "Also show an urgent notice?", with an editable
 * text and "Hide at" prefilled here. Pure and browser-safe: the prayer form
 * prefills with it and the save checks with it.
 */

/** One Friday's Jumu'ah as the form and the saved settings hold it. */
export type FridayChange = { date: string; jumuah: JumuahChange };

/**
 * Whether saving this row asks the question: its Jumu'ah is cancelled or
 * moved, and it differs from what is saved for that date (or nothing is).
 * Re-saving an unchanged row asks nothing, so no second notice is posted.
 */
export function asksJumuahNotice(
  row: FridayChange,
  saved: readonly FridayChange[],
): boolean {
  const { jumuah } = row;
  if (jumuah.change === "none") return false;
  const before = saved.find((other) => other.date === row.date)?.jumuah;
  if (!before || before.change !== jumuah.change) return true;
  return (
    jumuah.change === "changed" &&
    before.change === "changed" &&
    sessionsKey(before.sessions) !== sessionsKey(jumuah.sessions)
  );
}

/** A list of prayers as one comparable text, in order. */
const sessionsKey = (sessions: readonly JumuahSession[]) =>
  sessions.map((session) => `${session.khutbah}-${session.iqamah}`).join(",");

/** "1:15 PM", "1:15 PM and 2:30 PM", "12:30 PM, 1:30 PM and 2:30 PM". */
function timesList(times: readonly string[]) {
  const words = times.map(formatTimeOfDay);
  return words.length > 1
    ? `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`
    : (words[0] ?? "");
}

/**
 * The prefilled notice text: "No Jumu’ah at the Musallah this Friday
 * (16 Oct)", or "Jumu’ah this Friday (16 Oct) moves to 1:15 PM" (the new
 * khutbah times, "1:15 PM and 2:30 PM" with several prayers; the musallah
 * is one room).
 */
export function jumuahNoticeText(row: FridayChange): string {
  const day = `this Friday (${shortDateLabel(row.date)})`;
  if (row.jumuah.change !== "changed")
    return `No Jumu’ah at the Musallah ${day}`;
  const times = row.jumuah.sessions
    .map((session) => session.khutbah || session.iqamah)
    .filter((time) => /^\d{2}:\d{2}$/.test(time));
  return `Jumu’ah ${day} moves to ${timesList(times)}`.trimEnd();
}

/**
 * The prefilled "Hide at": that Friday at its last iqamah plus
 * `JUMUAH_NOTICE_MINUTES_AFTER` (that Friday's own prayers if changed, the
 * weekly ones, `usual`, if cancelled), as the date and time boxes show it.
 * No iqamah known: the date only, so the board picks the time.
 */
export function jumuahNoticeEnd(
  row: FridayChange,
  usual: readonly JumuahSession[],
): { date: string; time: string } {
  const sessions =
    row.jumuah.change === "changed" ? row.jumuah.sessions : usual;
  const iqamah =
    sessions
      .map((session) => session.iqamah)
      .filter((time) => /^\d{2}:\d{2}$/.test(time))
      .sort()
      .at(-1) ?? "";
  const match = /^(\d{2}):(\d{2})$/.exec(iqamah);
  if (!match) return { date: row.date, time: "" };
  const minutes = Math.min(
    Number(match[1]) * 60 + Number(match[2]) + JUMUAH_NOTICE_MINUTES_AFTER,
    23 * 60 + 59,
  );
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    date: row.date,
    time: `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`,
  };
}
