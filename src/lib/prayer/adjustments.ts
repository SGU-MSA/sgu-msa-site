import { z } from "../validation/zod";
import { namedDate, namedOptionalTime } from "../validation/date-time";

export const prayerIds = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
/** A prayer's name as screens show it: "fajr" → "Fajr" (also "sunrise"). */
export const prayerLabel = (id: string) => id[0].toUpperCase() + id.slice(1);
/** How a prayer's iqamah is set (PR4 D-2): the switch's values and labels. */
export const iqamahModes = [
  ["fixed", "Fixed time"],
  ["after", "After adhan"],
] as const;
/**
 * The refusal of a prayer with both a fixed time and minutes after the adhan
 * (D-14 amendment, 2026-10-05): the save and the editor's row say the same.
 */
export const iqamahBothMessage = (id: string) =>
  `${prayerLabel(id)} iqamah: pick ${iqamahModes[0][1]} or ${iqamahModes[1][1]}, not both.`;
/** The most one-date changes the settings hold (and the form offers). */
export const exceptionRows = 20;
export const iqamahOffsetSchema = z.object(
  Object.fromEntries(
    prayerIds.map((id) => {
      const message = `${prayerLabel(id)} iqamah: use whole minutes after the adhan, from 0 to 120.`;
      return [
        id,
        z
          .number({ error: message })
          .int(message)
          .min(0, message)
          .max(120, message)
          .nullable()
          .default(null),
      ];
    }),
  ) as Record<
    (typeof prayerIds)[number],
    z.ZodDefault<z.ZodNullable<z.ZodNumber>>
  >,
);

/** The weekday (0 = Sunday … 6 = Saturday) of a Grenada calendar date (YYYY-MM-DD). */
export function weekday(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

/** Whether a Grenada calendar date (YYYY-MM-DD) is a Friday. */
export function isFridayDate(date: string) {
  return weekday(date) === 5;
}

/** The most Jumu'ah prayers one Friday holds, weekly or on one date (review fixes P2). */
export const maxJumuahSessions = 4;

/**
 * A Jumu'ah prayer's name by its place in the list, as visitors and the
 * board read it: "First prayer", "Second prayer", …
 */
export function jumuahSessionName(index: number) {
  return (
    ["First prayer", "Second prayer", "Third prayer", "Fourth prayer"][index] ??
    `Prayer ${index + 1}`
  );
}

/** One Jumu'ah prayer: its khutbah and iqamah clocks (`HH:MM`). */
export type JumuahSession = { khutbah: string; iqamah: string };

const clockPattern = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * An ordered list of Jumu'ah prayers (review fixes P2): at most
 * `maxJumuahSessions`, each a valid khutbah and an iqamah after it. A
 * refusal names its box and, with several prayers, which one: "Jumu’ah
 * iqamah (second prayer): choose a time after the khutbah." Mirrors
 * `valid_jumuah_sessions` in
 * supabase/migrations/202610160001_jumuah_sessions.sql.
 */
export function jumuahSessionList(names: { khutbah: string; iqamah: string }) {
  return z
    .array(z.object({ khutbah: z.string(), iqamah: z.string() }))
    .max(
      maxJumuahSessions,
      `${names.khutbah}: use up to ${maxJumuahSessions} prayers.`,
    )
    .superRefine((rows, ctx) => {
      rows.forEach((row, index) => {
        const which =
          rows.length > 1 ? ` (${jumuahSessionName(index).toLowerCase()})` : "";
        for (const part of ["khutbah", "iqamah"] as const)
          if (!clockPattern.test(row[part]))
            ctx.addIssue({
              code: "custom",
              message: `${names[part]}${which}: choose a valid time.`,
              path: [index, part],
            });
        if (
          clockPattern.test(row.khutbah) &&
          clockPattern.test(row.iqamah) &&
          row.iqamah <= row.khutbah
        )
          ctx.addIssue({
            code: "custom",
            message: `${names.iqamah}${which}: choose a time after the khutbah.`,
            path: [index, "iqamah"],
          });
      });
    });
}

/**
 * A changed Friday saved before several prayers (review fixes P2) held one
 * khutbah and iqamah: read as a list of one.
 */
function legacyChange(value: unknown) {
  if (
    value &&
    typeof value === "object" &&
    (value as { change?: unknown }).change === "changed" &&
    !("sessions" in value)
  ) {
    const { khutbah, iqamah } = value as Partial<JumuahSession>;
    return { change: "changed", sessions: [{ khutbah, iqamah }] };
  }
  return value;
}

/**
 * One Friday's Jumu'ah: as usual, cancelled, or that Friday's own list of
 * prayers (review fixes P2): a prayer of the weekly list changed, or left
 * out to cancel it. The musallah is one room, so a prayer has no room
 * (review fixes PR-3, 2026-10-05). Mirrors `valid_prayer_exceptions` in
 * supabase/migrations/202610160001_jumuah_sessions.sql.
 */
export const jumuahChangeSchema = z.preprocess(
  legacyChange,
  z.discriminatedUnion("change", [
    z.object({ change: z.literal("none") }),
    z.object({ change: z.literal("cancelled") }),
    z.object({
      change: z.literal("changed"),
      sessions: jumuahSessionList({
        khutbah: "Changed Jumu’ah khutbah",
        iqamah: "Changed Jumu’ah iqamah",
      }).min(
        1,
        "Changed Jumu’ah: keep at least one prayer, or choose No Jumu’ah this week.",
      ),
    }),
  ]),
);
export type JumuahChange = z.infer<typeof jumuahChangeSchema>;

/**
 * A change for one Grenada date: daily iqamah clocks and, on a Friday, that
 * Friday's Jumu'ah. Start corrections are retired (ADR 0017); old stored
 * ones are dropped on read.
 */
export const exceptionSchema = z
  .object({
    date: namedDate("Changes for one date"),
    reason: z
      .string()
      .trim()
      .min(1, "Changes for one date: add a reason (shown to visitors).")
      .max(250, "Changes for one date: use 250 characters or fewer."),
    iqamah: z.object(
      Object.fromEntries(
        prayerIds.map((id) => [
          id,
          namedOptionalTime(`${prayerLabel(id)} iqamah on this date`),
        ]),
      ) as Record<
        (typeof prayerIds)[number],
        ReturnType<typeof namedOptionalTime>
      >,
    ),
    // Rows saved before PR4 have no Jumu'ah part: they mean "as usual".
    jumuah: jumuahChangeSchema.default({ change: "none" }),
  })
  .superRefine((value, ctx) => {
    if (value.jumuah.change !== "none" && !isFridayDate(value.date))
      ctx.addIssue({
        code: "custom",
        message: `${value.date}: a Jumu’ah change needs a Friday date.`,
        path: ["jumuah"],
      });
  });
