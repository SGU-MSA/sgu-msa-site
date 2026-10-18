import { exceptionRows, prayerIds } from "@/lib/prayer/adjustments";
import {
  jumuahField,
  jumuahSessionBox,
  prayerFormValues,
  weeklyJumuahPrefix,
} from "@/lib/prayer/congregation";
import { prayerSaveSchema, type PrayerSettings } from "@/lib/community/schema";
import { jumuahNoticeWords } from "./fields";
import { withProblems, type FieldProblems } from "./form-check/problems";
import { answeredNotice, jumuahNoticeBoxes } from "./jumuah-notices";

/** A posted value as text ("" when missing or a file). */
const reader = (form: FormData) => (name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};

/**
 * The "Changes for one date" cards a save keeps, by position: a card counts
 * when anything in it is filled (as `prayerFormValues` reads them).
 */
function filledCards(form: FormData): number[] {
  const text = reader(form);
  return Array.from({ length: exceptionRows }, (_, i) => i).filter((i) => {
    const field = (name: string) => text(`exception_${i}_${name}`);
    return (
      field("date") || field("reason") || prayerIds.some((id) => field(id))
    );
  });
}

/** The box of a settings problem: the input that holds it in the form. */
function prayerBox(path: readonly PropertyKey[], cards: number[]): string {
  const [head, index, field, part, session, clock] = path.map(String);
  if (head === "iqamah_offsets") return `offset_${index}`;
  // The weekly Jumu'ah prayers (review fixes P2): `jumuah_<n>_khutbah`, or the list.
  if (head === "jumuah_sessions")
    return index === undefined
      ? head
      : jumuahSessionBox(weeklyJumuahPrefix, Number(index), field ?? "");
  if (head !== "exceptions") return head ?? "";
  if (index === undefined) return "exceptions";
  const card = cards[Number(index)] ?? Number(index);
  const box = `exception_${card}`;
  if (field === "iqamah") return `${box}_${part}`;
  if (field === "jumuah")
    // A changed Friday's prayer box, or its choice for the list as a whole.
    return part === "sessions" && session !== undefined && clock !== undefined
      ? jumuahSessionBox(jumuahField(card, ""), Number(session), clock)
      : jumuahField(card, "");
  return `${box}_${field}`;
}

export type PrayerForm =
  | { ok: true; settings: PrayerSettings }
  | { ok: false; fields: FieldProblems }
  | { ok: false; outOfDate: true };

/**
 * The Prayer & iqamah form as typed (PR4 WP-4; review 2, 2026-10-05): the
 * settings to save, or every problem by its box (`fajr`, `offset_fajr`,
 * `exception_2_date`, …). Pure, so the save and the form (as you type) run
 * `prayerSaveSchema` the same way. A form without the iqamah switches is a
 * page loaded before this screen changed (`outOfDate`).
 */
export function prayerForm(form: FormData): PrayerForm {
  const posted = prayerFormValues(form);
  if (!posted) return { ok: false, outOfDate: true };
  const parsed = prayerSaveSchema.safeParse({ ...posted, id: 1 });
  if (parsed.success) return { ok: true, settings: parsed.data };
  const cards = filledCards(form);
  const fields: FieldProblems = {};
  for (const issue of parsed.error.issues)
    fields[prayerBox(issue.path, cards)] ??= issue.message;
  return { ok: false, fields };
}

/**
 * The browser's check of the form: the settings rules, and each Jumu'ah
 * question on screen answered (the server decides which Fridays ask, against
 * the saved settings).
 */
export function prayerFormProblems(form: HTMLFormElement): FieldProblems {
  const data = new FormData(form);
  const parsed = prayerForm(data);
  let problems = !parsed.ok && "fields" in parsed ? parsed.fields : {};
  for (let i = 0; i < exceptionRows; i++) {
    const boxes = jumuahNoticeBoxes(i);
    if (!form.querySelector(`[name="${boxes.answer}"]`)) continue;
    problems = withProblems(
      problems,
      answeredNotice(
        reader(data),
        boxes,
        jumuahNoticeWords.unanswered,
        new Date(),
      ).problems,
    );
  }
  return problems;
}
