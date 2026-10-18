import { z } from "../validation/zod";
import { SEASON_PHOTOS_MAX } from "../media/photo-limits";
import { photoListSchema } from "../media/photo-list";
import { unknownSignUpForm } from "../system-text";
import { dateSchema } from "../validation/date-time";

/**
 * Seasons (PR6 contract, D-6, D-12, D-13, D-15; ADR 0021): a named period
 * anchored to the Islamic calendar (month, from day, until day) or, for a
 * programme such as an awareness week, typed calendar days. The board
 * confirms an Islamic season's real first and last day after moon sighting
 * (`board_starts_on`, `board_ends_on`). Expected days are never stored:
 * `season-policy.ts` works them out. A season may have a public page (PR5c:
 * intro, schedule, sign-up form, photos; `season-page.ts`), at
 * `/seasons/<slug>` (Ramadan's at `/ramadan`). Shapes only; the migration
 * `202610150001_schema.sql` is the authority. Pure: no clock, no I/O.
 */

const filled = (field: string) => `${field}: fill in this box.`;
const atMost = (field: string, count: number) =>
  `${field}: use ${count} characters or fewer.`;
/** "" in the app, null in the database. */
const optionalDate = dateSchema.or(z.literal("")).default("");
const hijriDay = z.number().int().min(1).max(30);

/** The most rows a season page's schedule holds (`valid_season_schedule`). */
export const SCHEDULE_ROWS_MAX = 40;

/** One schedule row (D-26): What, When and Where. */
export const scheduleRowSchema = z.object({
  what: z.string().trim().min(1, filled("What")).max(120, atMost("What", 120)),
  when: z.string().trim().min(1, filled("When")).max(120, atMost("When", 120)),
  where: z.string().trim().max(120, atMost("Where", 120)).default(""),
});
export type ScheduleRow = z.infer<typeof scheduleRowSchema>;

export const seasonSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1, filled("Name")).max(80, atMost("Name", 80)),
    /** Null: a season with typed calendar days. */
    hijri_month: z.number().int().min(1).max(12).nullable(),
    hijri_first_day: hijriDay.nullable(),
    /** Null: until the end of the month. */
    hijri_last_day: hijriDay.nullable(),
    /** Confirmed (Islamic) or typed (calendar) first and last days. */
    board_starts_on: optionalDate,
    board_ends_on: optionalDate,
    /**
     * The page's address, made once by the database from the name and never
     * changed (`season_slug`); "" for a season not saved yet.
     */
    slug: z.string().default(""),
    /** The season has a public page, shown all year (PR5c, Q-10a/b). */
    has_page: z.boolean().default(false),
    intro: z
      .string()
      .trim()
      .max(2000, atMost("Introduction", 2000))
      .default(""),
    schedule: z
      .array(scheduleRowSchema)
      .max(
        SCHEDULE_ROWS_MAX,
        `Schedule: keep ${SCHEDULE_ROWS_MAX} rows or fewer.`,
      )
      .default([]),
    /** A key of the sign-up forms list, or "" for none. */
    sign_up_form: z
      .string()
      .regex(/^([a-z0-9_]{1,40})?$/, unknownSignUpForm)
      .default(""),
    photos: photoListSchema(SEASON_PHOTOS_MAX),
  })
  // The database checks, in the same order.
  .refine((s) => (s.hijri_month === null) === (s.hijri_first_day === null), {
    message: "From day: choose the month and the day it starts.",
    path: ["hijri_first_day"],
  })
  .refine(
    (s) =>
      s.hijri_last_day === null ||
      (s.hijri_month !== null &&
        s.hijri_first_day !== null &&
        s.hijri_last_day >= s.hijri_first_day),
    {
      message: "Until day: choose a day on or after the from day.",
      path: ["hijri_last_day"],
    },
  )
  .refine(
    (s) =>
      s.hijri_month !== null ||
      (s.board_starts_on !== "" && s.board_ends_on !== ""),
    {
      message: "First day: type the first and the last day.",
      path: ["board_starts_on"],
    },
  )
  .refine(
    (s) =>
      !s.board_starts_on ||
      !s.board_ends_on ||
      s.board_ends_on >= s.board_starts_on,
    {
      message: "Last day: choose a day on or after the first day.",
      path: ["board_ends_on"],
    },
  );
export type Season = z.infer<typeof seasonSchema>;

const nullableDates = ["board_starts_on", "board_ends_on"] as const;

/** The one parse of a `seasons` row: null days read as "". */
export function seasonFromRow(row: Record<string, unknown>): Season {
  const values: Record<string, unknown> = { ...row };
  for (const column of nullableDates) values[column] = row[column] ?? "";
  return seasonSchema.parse(values);
}

/**
 * A season as the database stores it: "" becomes null, and the address is
 * never sent (the database makes it once).
 */
export function seasonToRow(season: Season): Record<string, unknown> {
  const row: Record<string, unknown> = { ...season };
  delete row.slug;
  for (const column of nullableDates) row[column] = season[column] || null;
  return row;
}

/** Whether the season follows the Islamic calendar (else: typed days). */
export function isIslamicSeason(season: Pick<Season, "hijri_month">) {
  return season.hijri_month !== null;
}
