import {
  personFormSchema,
  sectionSchema,
  type Person,
  type Section,
} from "@/lib/community/people";
import { problemsOf, type FieldProblems } from "./form-check/problems";

/*
 * The People forms as typed (PR3; review 2, 2026-10-05): pure, so the server
 * actions and the forms (as you type) run the same rules. The order number
 * and the stored photo's name come from the server, never from the form.
 */

/** A photo name that passes the rules, for the browser's check of a chosen photo. */
export const anyPhotoName = "00000000-0000-4000-8000-000000000000.webp";

/**
 * A People entry as typed. `executiveGroupId` is the Executive board's id,
 * whose people hold one of its roles (null when the groups could not be read:
 * the database still checks).
 */
export function personFromForm(
  values: Record<string, string>,
  from: {
    position: number;
    photoPath: string;
    executiveGroupId: string | null;
  },
): { ok: true; row: Person } | { ok: false; fields: FieldProblems } {
  // A ticked "Show on public page" posts "yes"; an unticked one posts
  // nothing (review fixes P4: a box, ticked by default).
  const parsed = personFormSchema(from.executiveGroupId).safeParse({
    ...values,
    position: from.position,
    show_on_public: values.show_on_public === "yes",
    photo_path: from.photoPath,
  });
  return parsed.success
    ? { ok: true, row: parsed.data }
    : { ok: false, fields: problemsOf(parsed.error) };
}

/** A group as typed; its order number comes from the server. */
export function sectionFromForm(
  values: Record<string, string>,
  position: number,
): { ok: true; row: Section } | { ok: false; fields: FieldProblems } {
  const parsed = sectionSchema.safeParse({
    ...values,
    position,
    shown_by_default: values.shown_by_default === "on",
  });
  return parsed.success
    ? { ok: true, row: parsed.data }
    : { ok: false, fields: problemsOf(parsed.error) };
}
