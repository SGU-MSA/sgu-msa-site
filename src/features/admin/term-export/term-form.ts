import { z } from "@/lib/validation/zod";
import { namedDate } from "@/lib/validation/date-time";

/**
 * The Term export screen's boxes and their rules (review fixes P5), shared
 * by the screen, the download route and "Free up space". Browser-safe.
 */

/** The boxes of the Term export screen, as the board reads them. */
export const termExportBoxes = {
  name: "Name of the term",
  from: "From",
  until: "To",
} as const;

export const TERM_NAME_MAX = 60;

/** Why the days cannot be used: To is before From. */
export const untilBeforeFrom = `${termExportBoxes.until}: choose the From day or a later one.`;

/** What Download sends: the term's name and its first and last days (both included). */
export const termExportSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, `${termExportBoxes.name}: fill in this box.`)
      .max(
        TERM_NAME_MAX,
        `${termExportBoxes.name}: use ${TERM_NAME_MAX} characters or fewer.`,
      ),
    from: namedDate(termExportBoxes.from),
    until: namedDate(termExportBoxes.until),
  })
  .refine((term) => term.until >= term.from, {
    message: untilBeforeFrom,
    path: ["until"],
  });
export type TermExport = z.infer<typeof termExportSchema>;

/** The days "Free up space" works on (the same boxes, without the name). */
export const termRangeSchema = z
  .object({
    from: namedDate(termExportBoxes.from),
    until: namedDate(termExportBoxes.until),
  })
  .refine((term) => term.until >= term.from, {
    message: untilBeforeFrom,
    path: ["until"],
  });
