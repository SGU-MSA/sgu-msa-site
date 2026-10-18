import { z } from "../validation/zod";
import { dateSchema } from "../validation/date-time";

/**
 * New board term (PR5a D-5, D-27 d): the hand-over steps the board ticks and
 * edits, and who holds each shared login (names from People, never a
 * password). Shapes and pure rules; `supabase/migrations/202610150001_schema.sql`
 * is the authority. Pure: no clock, no I/O.
 */

const order = z
  .number({ message: "Enter an order number." })
  .int("Use a whole number for the order.")
  .min(-2147483648)
  .max(2147483647);
/** "" in the app, null in the database. */
const optionalDate = dateSchema.or(z.literal("")).default("");
const atMost = (field: string, count: number) =>
  `${field}: use ${count} characters or fewer.`;
const filled = (field: string) => `${field}: fill in this box.`;

/** A dashboard page a step links to, such as "/admin/people". */
export const dashboardLink = /^\/admin(\/[a-z0-9-]+)*$/;

export const handoverStepSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1, filled("Step")).max(120, atMost("Step", 120)),
  details: z.string().trim().max(500, atMost("Details", 500)).default(""),
  link: z
    .string()
    .regex(dashboardLink, "Dashboard page: choose a page of the dashboard.")
    .or(z.literal(""))
    .default(""),
  position: order,
  /** The day it was ticked; "" while not done this term. */
  done_on: optionalDate,
});
export type HandoverStep = z.infer<typeof handoverStepSchema>;

/** A person chosen from People, or "" for nobody. */
const personId = z
  .uuid({ message: "Holder: choose someone from People." })
  .or(z.literal(""))
  .default("");

/** One shared account and who holds it. No field can hold a password or code. */
export const sharedLoginSchema = z.object({
  id: z.uuid(),
  service: z
    .string()
    .trim()
    .min(1, filled("Account"))
    .max(80, atMost("Account", 80)),
  holder_person_id: personId,
  /** Who has the phone for the 2-step code. */
  second_factor_person_id: personId,
  last_changed_on: optionalDate,
  note: z.string().trim().max(200, atMost("Note", 200)).default(""),
});
export type SharedLogin = z.infer<typeof sharedLoginSchema>;

const stepDates = ["done_on"] as const;
const loginNullable = [
  "holder_person_id",
  "second_factor_person_id",
  "last_changed_on",
] as const;

/** The one parse of a `handover_steps` row: a null `done_on` reads as "". */
export function stepFromRow(row: Record<string, unknown>): HandoverStep {
  const values: Record<string, unknown> = { ...row };
  for (const column of stepDates) values[column] = row[column] ?? "";
  return handoverStepSchema.parse(values);
}
/** A step as the database stores it: "" becomes null. */
export function stepToRow(step: HandoverStep): Record<string, unknown> {
  return { ...step, done_on: step.done_on || null };
}

/** The one parse of a `shared_logins` row: null holders and dates read as "". */
export function loginFromRow(row: Record<string, unknown>): SharedLogin {
  const values: Record<string, unknown> = { ...row };
  for (const column of loginNullable) values[column] = row[column] ?? "";
  return sharedLoginSchema.parse(values);
}
/** A shared login as the database stores it: "" becomes null. */
export function loginToRow(login: SharedLogin): Record<string, unknown> {
  const row: Record<string, unknown> = { ...login };
  for (const column of loginNullable) row[column] = login[column] || null;
  return row;
}

type Archivable = { archived_at?: string | null };

/** "4 of 9 done": current steps only; archived steps do not count. */
export function handoverProgress(
  steps: readonly (Pick<HandoverStep, "done_on"> & Archivable)[],
): { done: number; total: number } {
  const current = steps.filter((step) => !step.archived_at);
  return {
    done: current.filter((step) => step.done_on).length,
    total: current.length,
  };
}

/** The database order of steps: order number, then title. */
export function byStepOrder(a: HandoverStep, b: HandoverStep) {
  return a.position - b.position || a.title.localeCompare(b.title);
}
