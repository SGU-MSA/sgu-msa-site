import { z } from "./zod";
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
/** A real calendar date (no 2026-02-30). */
const isCalendarDate = (value: string) => {
  const date = new Date(`${value}T12:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
};
/** The board's words when a date or time is not one (review fixes P1, item 3). */
const notADate = "Enter a valid date.";
const notATime = "Choose a valid time.";
export const dateSchema = z
  .string()
  .regex(datePattern, notADate)
  .refine(isCalendarDate, notADate);
export const timeSchema = z.string().regex(timePattern, notATime);
/** A date whose refusal names its field: "Date: choose a valid date." */
export const namedDate = (field: string) => {
  const message = `${field}: choose a valid date.`;
  return z.string().regex(datePattern, message).refine(isCalendarDate, message);
};
/** A time whose refusal names its field: "Start time: choose a valid time." */
export const namedTime = (field: string) =>
  z.string().regex(timePattern, `${field}: choose a valid time.`);
/** An optional time ("" when empty) whose refusal names its field. */
export const namedOptionalTime = (field: string) =>
  z.union([namedTime(field), z.literal("")]).default("");
