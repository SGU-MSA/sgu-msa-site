import { TIMEZONE } from "@/lib/community/schema";
import type { EditorState } from "./actions";
import type { FieldProblems } from "./form-check/problems";

/**
 * A board form whose refused save keeps what was typed (PR3 People, PR4
 * WP-3). React 19 resets a `<form action>` after every submit, so a refused
 * save returns the typed `values` and the form shows them again; `attempt`
 * changes on every refusal and is the form's `key`, so it re-mounts with
 * them. Browsers cannot restore a chosen file.
 */
export type KeptFormState = EditorState & {
  values: Record<string, string> | null;
  attempt: number;
};

/** A kept-values form before its first save. */
export const initialKeptForm: KeptFormState = {
  error: null,
  notice: null,
  values: null,
  attempt: 0,
};

/**
 * A typed number (an order number, a coordinate): empty or blank stays
 * missing, so the schema names the field.
 */
export const typedNumber = (value: string | undefined) =>
  value?.trim() ? Number(value) : undefined;

/** The typed text of a form (file inputs left out). */
export function typedValues(form: FormData) {
  const values: Record<string, string> = {};
  for (const [key, value] of form)
    if (typeof value === "string") values[key] = value;
  return values;
}

/** Grenada is UTC−04:00 all year (as `isUpcoming`): a wall date and time as an instant. */
export function grenadaInstant(date: string, time: string) {
  return `${date}T${time}:00-04:00`;
}

const grenadaWall = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
/** An instant as the Grenada date and time a form's boxes show ("" parts when empty or invalid). */
export function grenadaWallTime(instant: string) {
  const time = Date.parse(instant);
  if (!instant || Number.isNaN(time)) return { date: "", time: "" };
  const part = (type: string) =>
    grenadaWall.formatToParts(time).find((p) => p.type === type)?.value ?? "";
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`,
  };
}

/**
 * An announcement's priority box (PR5a D-1): Featured sets `featured`, Urgent
 * sets `urgent_until` from "Hide at" (date and time, Grenada time) and clears
 * "Hide after". An Urgent choice with "Hide at" incomplete keeps a value that
 * is not a time, so the save is refused with "Hide at: choose a valid date
 * and time." Without a posted priority (another kind) nothing changes.
 */
function priorityFields(values: Record<string, string>) {
  const priority = values.priority;
  if (priority === undefined) return {};
  if (priority !== "urgent")
    return { featured: priority === "featured", urgent_until: "" };
  const { urgent_on: date, urgent_at: time } = values;
  return {
    featured: false,
    expires_on: "",
    urgent_until: date && time ? grenadaInstant(date, time) : "incomplete",
  };
}

/**
 * An event's status box (PR5a D-20): the reason is kept only for Cancelled.
 * Without a posted status (an old screen) nothing changes.
 */
function statusFields(values: Record<string, string>) {
  const status = values.status;
  if (status === undefined) return {};
  return {
    status_note: status === "cancelled" ? (values.status_note ?? "") : "",
  };
}

/**
 * The typed values of a content item form as the item's fields: a checkbox
 * (`published`, `featured`) is posted, as `on`, only when ticked; the
 * priority and status boxes post their choices (`priorityFields`,
 * `statusFields`).
 */
export function recordFromTyped(values: Record<string, string>) {
  return {
    ...values,
    published: values.published === "on",
    featured: values.featured === "on",
    ...priorityFields(values),
    ...statusFields(values),
  };
}

/**
 * The refusal of a save that keeps the typed `values`: the reason, and the
 * problems by box (review 2: each shows on its own box).
 */
export function keepTyped(
  previous: KeptFormState,
  values: Record<string, string>,
) {
  return (error: string | null, fields?: FieldProblems): KeptFormState => ({
    error,
    notice: null,
    ...(fields && Object.keys(fields).length ? { fields } : {}),
    values,
    attempt: previous.attempt + 1,
  });
}
