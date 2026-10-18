/**
 * The rules of the dashboard's date and time boxes (review fixes P1, item 1):
 * every `DateField` and `TimeField` declares which days or times can be
 * chosen, so a wrong one is greyed out in the picker instead of refused after
 * Save. Stored values stay `YYYY-MM-DD` and 24-hour `HH:MM`; the time box
 * reads on a 12-hour clock with AM/PM. Pure and browser-safe.
 */

/**
 * A limit of a date box: a fixed day (`YYYY-MM-DD`, such as today on the
 * server clock), or another box of the same form, by its `name`, whose
 * typed day it follows ("" while that box is empty: no limit).
 */
export type DayBound = string | { box: string };

/**
 * Which days a date box offers. Every use names its rule; there is no
 * default. `from` and `until` are inclusive; with several limits on one side
 * the tightest one counts.
 */
export type DateRule =
  | { kind: "any" }
  | {
      kind: "range";
      from?: readonly DayBound[];
      until?: readonly DayBound[];
    };

/** Any day: past, today or future. */
export const anyDate: DateRule = { kind: "any" };

/** Today or later (`today` from the server clock), and after any other limits given. */
export const todayOrLater = (
  today: string,
  ...also: readonly DayBound[]
): DateRule => ({ kind: "range", from: [today, ...also] });

/** Days between limits, each side optional and inclusive. */
export const dayRange = (limits: {
  from?: DayBound | readonly DayBound[];
  until?: DayBound | readonly DayBound[];
}): DateRule => ({
  kind: "range",
  from: limits.from === undefined ? undefined : [limits.from].flat(),
  until: limits.until === undefined ? undefined : [limits.until].flat(),
});

/**
 * A limit of a time box: a fixed time (`HH:MM`), or another box of the same
 * form by its `name` ("" while it is empty: no limit).
 */
export type TimeBound = string | { box: string };

/** Which times a time box offers: any, or only times later than a limit. */
export type TimeRule = { kind: "any" } | { kind: "after"; after: TimeBound };

/** Any time of day. */
export const anyTime: TimeRule = { kind: "any" };

/** Only times later than `after` (exclusive). */
export const laterThan = (after: TimeBound): TimeRule => ({
  kind: "after",
  after,
});

const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The other boxes a rule reads, by name. */
export function boxesOf(rule: DateRule | TimeRule): string[] {
  const bounds: (DayBound | TimeBound)[] =
    rule.kind === "range"
      ? [...(rule.from ?? []), ...(rule.until ?? [])]
      : rule.kind === "after"
        ? [rule.after]
        : [];
  return bounds.flatMap((bound) =>
    typeof bound === "string" ? [] : [bound.box],
  );
}

const resolve = (bound: DayBound | TimeBound, read: (box: string) => string) =>
  typeof bound === "string" ? bound : read(bound.box);

/**
 * The `min` and `max` of a date box under its rule: the latest `from` and
 * the earliest `until` that are days (an empty or unfinished box adds none).
 */
export function dayLimits(
  rule: DateRule,
  read: (box: string) => string,
): { min?: string; max?: string } {
  if (rule.kind === "any") return {};
  const days = (bounds: readonly DayBound[] | undefined) =>
    (bounds ?? [])
      .map((bound) => resolve(bound, read))
      .filter((day) => dayPattern.test(day))
      .sort();
  const from = days(rule.from);
  const until = days(rule.until);
  return {
    ...(from.length ? { min: from[from.length - 1] } : {}),
    ...(until.length ? { max: until[0] } : {}),
  };
}

/** The exclusive lower limit of a time box under its rule, or null. */
export function timeFloor(
  rule: TimeRule,
  read: (box: string) => string,
): string | null {
  if (rule.kind === "any") return null;
  const after = resolve(rule.after, read);
  return timePattern.test(after) ? after : null;
}

/** A 12-hour time as the time box's three drop-downs hold it ("" when not chosen). */
export type ClockParts = {
  /** "1" … "12". */
  hour: string;
  /** "00" … "59". */
  minute: string;
  period: "" | "AM" | "PM";
};

export const noClockParts: ClockParts = { hour: "", minute: "", period: "" };

/** The hours, minutes and halves of the day the drop-downs offer, in order. */
export const clockHours = Array.from({ length: 12 }, (_, index) =>
  String(index + 1),
);
export const clockMinutes = Array.from({ length: 60 }, (_, index) =>
  String(index).padStart(2, "0"),
);
export const clockPeriods = ["AM", "PM"] as const;

/** A stored `HH:MM` as the drop-downs show it; anything else shows nothing chosen. */
export function clockParts(value: string): ClockParts {
  if (!timePattern.test(value)) return noClockParts;
  const [hours, minute] = value.split(":");
  const hour = Number(hours);
  return {
    hour: String(hour % 12 || 12),
    minute,
    period: hour < 12 ? "AM" : "PM",
  };
}

/**
 * What the time box posts: `HH:MM` when all three parts are chosen, "" when
 * none is, and "incomplete" while only some are, which every time rule
 * refuses ("Start time: choose a valid time.").
 */
export function clockValue(parts: ClockParts): string {
  const { hour, minute, period } = parts;
  if (!hour && !minute && !period) return "";
  if (!hour || !minute || !period) return "incomplete";
  const hours = (Number(hour) % 12) + (period === "PM" ? 12 : 0);
  return `${String(hours).padStart(2, "0")}:${minute}`;
}

const minutesOf = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};
const minutesOfParts = (hour: string, minute: string, period: string) =>
  ((Number(hour) % 12) + (period === "PM" ? 12 : 0)) * 60 + Number(minute);

/**
 * The drop-down choices greyed out under an exclusive lower limit (`floor`,
 * `HH:MM`), given what is chosen now: an hour, a minute or AM/PM is greyed
 * out when every time it could still make is at or before the limit. Nothing
 * is greyed out without a limit.
 */
export function disabledClockParts(
  floor: string | null,
  parts: ClockParts,
): { hours: Set<string>; minutes: Set<string>; periods: Set<string> } {
  const hours = new Set<string>();
  const minutes = new Set<string>();
  const periods = new Set<string>();
  if (!floor) return { hours, minutes, periods };
  const limit = minutesOf(floor);
  const periodsLeft = parts.period ? [parts.period] : clockPeriods;
  const hoursLeft = parts.hour ? [parts.hour] : clockHours;
  for (const period of clockPeriods)
    if (hoursLeft.every((hour) => minutesOfParts(hour, "59", period) <= limit))
      periods.add(period);
  for (const hour of clockHours)
    if (
      periodsLeft.every((period) => minutesOfParts(hour, "59", period) <= limit)
    )
      hours.add(hour);
  for (const minute of clockMinutes)
    if (
      periodsLeft.every((period) =>
        hoursLeft.every(
          (hour) => minutesOfParts(hour, minute, period) <= limit,
        ),
      )
    )
      minutes.add(minute);
  return { hours, minutes, periods };
}
