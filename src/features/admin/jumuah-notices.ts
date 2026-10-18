import { exceptionRows } from "@/lib/prayer/adjustments";
import { asksJumuahNotice } from "@/lib/prayer/jumuah-notice";
import {
  localDate,
  recordFieldNames,
  recordFormSchema,
  recordSchema,
  type CommunityRecord,
  type PrayerSettings,
} from "@/lib/community/schema";
import { grenadaInstant } from "./form-state";
import { jumuahNoticeWords } from "./fields";
import {
  problemsOf,
  withProblems,
  type FieldProblems,
} from "./form-check/problems";

/*
 * The urgent notices a save may post alongside it: a changed Friday's
 * Jumu'ah on Prayer & iqamah (PR5a WP6, D-3, D-19), and a published event
 * whose date changes or that is cancelled (review 2, 2026-10-05). Apart from
 * the server actions so they can be tested without a server, and pure, so
 * the forms check the same answers as you type.
 */

/** The boxes of one "Also post …?" question, by their names in the form. */
export type NoticeBoxes = {
  answer: string;
  text: string;
  on: string;
  at: string;
};

/** What a notice's refusals call its boxes (the question's labels). */
const noticeNames = {
  ...recordFieldNames,
  title: "Notice text",
  urgent_until: "Hide at",
};

/**
 * One answered notice question: unanswered is refused on its Yes / No (with
 * `unanswered`); No posts nothing; Yes gives a published urgent notice dated
 * today, its title the typed text and its end "Hide at", or the announcement
 * rules' refusals on the text and Hide at boxes.
 */
export function answeredNotice(
  read: (name: string) => string,
  boxes: NoticeBoxes,
  unanswered: string,
  now: Date,
): { notice: CommunityRecord | null; problems: FieldProblems } {
  const choice = read(boxes.answer);
  if (choice !== "yes" && choice !== "no")
    return { notice: null, problems: { [boxes.answer]: unanswered } };
  if (choice === "no") return { notice: null, problems: {} };
  const on = read(boxes.on);
  const at = read(boxes.at);
  const parsed = recordFormSchema(
    "announcements",
    { image: false, file: false },
    noticeNames,
    now,
  ).safeParse({
    ...recordSchema.parse({
      id: crypto.randomUUID(),
      title: "Notice",
      date: localDate(now),
    }),
    title: read(boxes.text),
    published: true,
    urgent_until: on && at ? grenadaInstant(on, at) : "incomplete",
  });
  return parsed.success
    ? { notice: parsed.data, problems: {} }
    : {
        notice: null,
        problems: problemsOf(parsed.error, {
          title: boxes.text,
          urgent_until: boxes.at,
        }),
      };
}

/** A Friday card's question boxes (cards post by position). */
export const jumuahNoticeBoxes = (index: number): NoticeBoxes => ({
  answer: `exception_${index}_notice`,
  text: `exception_${index}_notice_text`,
  on: `exception_${index}_notice_on`,
  at: `exception_${index}_notice_at`,
});

/**
 * The urgent notices a prayer save posts (PR5a D-3, D-19): one for each
 * Friday change that is new or edited in this save (`asksJumuahNotice`,
 * against the saved settings) and answered Yes. A changed Friday left
 * unanswered, or a notice the announcement rules refuse, refuses the whole
 * save before anything is written.
 */
export function jumuahNotices(
  form: FormData,
  settings: PrayerSettings,
  saved: PrayerSettings,
  now: Date,
): { notices: CommunityRecord[]; problems: FieldProblems } {
  const text = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value : "";
  };
  // The card each Friday sits on.
  const cards = new Map<string, number>();
  for (let i = exceptionRows - 1; i >= 0; i--)
    cards.set(text(`exception_${i}_date`), i);
  const notices: CommunityRecord[] = [];
  let problems: FieldProblems = {};
  for (const row of settings.exceptions) {
    if (!asksJumuahNotice(row, saved.exceptions)) continue;
    const card = cards.get(row.date);
    if (card === undefined) {
      problems = withProblems(problems, {
        exceptions: jumuahNoticeWords.unanswered,
      });
      continue;
    }
    const answer = answeredNotice(
      text,
      jumuahNoticeBoxes(card),
      jumuahNoticeWords.unanswered,
      now,
    );
    if (answer.notice) notices.push(answer.notice);
    problems = withProblems(problems, answer.problems);
  }
  return { notices, problems };
}

/**
 * Posts each notice with `save`; true when all of them were saved. A failed
 * or thrown save does not stop the others (the prayer change is kept).
 */
export async function postNotices(
  notices: readonly CommunityRecord[],
  save: (notice: CommunityRecord) => Promise<{ ok: boolean }>,
): Promise<boolean> {
  let allPosted = true;
  for (const notice of notices) {
    const result = await save(notice).catch(() => ({ ok: false as const }));
    allPosted &&= result.ok;
  }
  return allPosted;
}

/** Where a prayer save goes: `?notice=failed` shows `jumuahNoticeWords.failed`. */
export function prayerSavedPath(allPosted: boolean) {
  return `/admin/prayer-times${allPosted ? "" : "?notice=failed"}`;
}
