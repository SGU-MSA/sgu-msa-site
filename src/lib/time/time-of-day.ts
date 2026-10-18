import { TIMEZONE } from "../community/schema";
import { timeSchema } from "../validation/date-time";

/**
 * Every time of day on the public site reads on a 12-hour clock with AM/PM,
 * for example "1:30 PM" (restyle-public D-8). Stored values stay 24-hour
 * `HH:MM`; this module is the one place that turns them, or a calculated
 * instant, into the words visitors read. `<TimeOfDay>` in src/shared/ui
 * renders the result inside `<time>`.
 */
export type TimeOfDay = {
  /** What the visitor reads: "1:30 PM", or the original text when it is not a stored time. */
  label: string;
  /** Machine-readable value for `<time dateTime>`; null when the text is not a time. */
  dateTime: string | null;
};

// One clock for the site. ICU versions differ in the space before AM/PM (a
// narrow no-break space, or a plain one that lets a phone break "12:45" from
// "PM"): `keepTogether` makes it a no-break space, so a time stays on one line.
const keepTogether = (label: string) => label.replace(/\s(?=[AP]M$)/, "\u00a0");
const twelveHour: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
};
/** Instants (calculated prayer starts) read in Grenada time. */
const inGrenada = new Intl.DateTimeFormat("en", {
  ...twelveHour,
  timeZone: TIMEZONE,
});
/** Stored `HH:MM` values are already Grenada wall-clock times: read them as written. */
const asWritten = new Intl.DateTimeFormat("en", {
  ...twelveHour,
  timeZone: "UTC",
});

/**
 * A stored 24-hour `HH:MM` value or an instant, as the public site shows it.
 * Text that is not a stored time ("6:40 PM", "After Isha") passes through
 * trimmed, so content written by hand never breaks; an invalid date reads "".
 */
export function timeOfDay(value: string | Date): TimeOfDay {
  if (value instanceof Date)
    return Number.isNaN(value.getTime())
      ? { label: "", dateTime: null }
      : {
          label: keepTogether(inGrenada.format(value)),
          dateTime: value.toISOString(),
        };
  const text = value.trim();
  if (!timeSchema.safeParse(text).success)
    return { label: text, dateTime: null };
  const [hours, minutes] = text.split(":").map(Number);
  return {
    label: keepTogether(asWritten.format(Date.UTC(2000, 0, 1, hours, minutes))),
    dateTime: text,
  };
}

/** The 12-hour label alone, for text joined into a sentence (event meta lines). */
export const formatTimeOfDay = (value: string | Date) => timeOfDay(value).label;
