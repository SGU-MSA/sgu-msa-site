import {
  handoverStepSchema,
  sharedLoginSchema,
  type HandoverStep,
  type SharedLogin,
} from "@/lib/community/handover";
import {
  hasProblems,
  noProblems,
  problemsOf,
  withProblems,
  type FieldProblems,
} from "../form-check/problems";

/*
 * The New board term forms as typed (PR5a D-5; review 2, 2026-10-05): pure,
 * so the server actions and the forms (as you type) run the same rules.
 */

/**
 * A step as typed: its order number and "Done on" day come from the server
 * (the form never sets them).
 */
export function stepFromForm(
  values: Record<string, string>,
  position: number,
  doneOn: string,
): { ok: true; row: HandoverStep } | { ok: false; fields: FieldProblems } {
  const parsed = handoverStepSchema.safeParse({
    id: values.id,
    title: values.title,
    details: values.details,
    link: values.link,
    position,
    done_on: doneOn,
  });
  return parsed.success
    ? { ok: true, row: parsed.data }
    : { ok: false, fields: problemsOf(parsed.error) };
}

/** "Last changed" is a day that has come: today (Grenada) or earlier. */
export const lastChangedInFuture =
  "Last changed: choose today or an earlier day.";

/**
 * Who holds a shared login, as typed. `today` (Grenada, `YYYY-MM-DD`) is the
 * latest "Last changed" day (review follow-ups, 2026-10-07): its date box
 * greys out later days, and this refuses one typed in anyway.
 */
export function loginFromForm(
  values: Record<string, string>,
  today: string,
): { ok: true; row: SharedLogin } | { ok: false; fields: FieldProblems } {
  const parsed = sharedLoginSchema.safeParse({
    id: values.id,
    service: values.service,
    holder_person_id: values.holder_person_id,
    second_factor_person_id: values.second_factor_person_id,
    last_changed_on: values.last_changed_on,
    note: values.note,
  });
  // Checked with the other boxes, so it shows as soon as the day is typed.
  // Days compare as text in `YYYY-MM-DD`.
  const future: FieldProblems =
    /^\d{4}-\d{2}-\d{2}$/.test(values.last_changed_on ?? "") &&
    values.last_changed_on > today
      ? { last_changed_on: lastChangedInFuture }
      : noProblems;
  if (!parsed.success)
    return {
      ok: false,
      fields: withProblems(problemsOf(parsed.error), future),
    };
  if (hasProblems(future)) return { ok: false, fields: future };
  return { ok: true, row: parsed.data };
}

/** The browser's check of a form whose rules are `parse`. */
export const problemsIn =
  (
    parse: (
      values: Record<string, string>,
    ) => { ok: true } | { ok: false; fields: FieldProblems },
  ) =>
  (values: Record<string, string>): FieldProblems => {
    const result = parse(values);
    return result.ok ? noProblems : result.fields;
  };
