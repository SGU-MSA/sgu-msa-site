import {
  eventChange,
  type EventChange,
  type TypedEvent,
} from "@/lib/community/event-notice";
import {
  recordFormSchema,
  type Collection,
  type CommunityRecord,
} from "@/lib/community/schema";
import {
  contentFieldNames,
  eventNoticeBoxes,
  eventNoticeWords,
} from "./fields";
import {
  problemsOf,
  withProblems,
  type FieldProblems,
} from "./form-check/problems";
import { recordFromTyped } from "./form-state";
import { answeredNotice } from "./jumuah-notices";

/** The event as typed, for its announcement question. */
export function typedEvent(values: Record<string, string>): TypedEvent {
  return {
    title: values.title ?? "",
    date: values.date ?? "",
    end_date: values.end_date ?? "",
    status: values.status ?? "scheduled",
    published: values.published === "on",
  };
}

/** What a saved event's announcement question needs to know about it. */
export type SavedEvent = Pick<
  CommunityRecord,
  "date" | "end_date" | "status" | "published" | "updated_at" | "archived_at"
>;

/** Whether this save of an event asks "Also post an announcement?". */
export function eventChangeOf(
  kind: Collection,
  saved: SavedEvent | null,
  values: Record<string, string>,
): EventChange | null {
  return kind === "events" ? eventChange(saved, typedEvent(values)) : null;
}

export type ContentForm =
  | { ok: true; row: CommunityRecord; notice: CommunityRecord | null }
  | { ok: false; fields: FieldProblems };

/**
 * A content form as typed (PR4 WP-3; review 2, 2026-10-05): the item to save
 * and, for a published event with a new date or cancelled now, the
 * announcement its question posts; or every problem, by box. Pure, so the
 * server action and the form (as you type) run the same rules. `now` is the
 * server clock on the server and the browser's in the form; `saved` is the
 * item as stored (null for a new one).
 */
export function contentForm(input: {
  kind: Collection;
  values: Record<string, string>;
  chosen: { image: boolean; file: boolean };
  saved: SavedEvent | null;
  now: Date;
}): ContentForm {
  const { kind, values, chosen, saved, now } = input;
  const parsed = recordFormSchema(
    kind,
    chosen,
    contentFieldNames(kind),
    now,
  ).safeParse(recordFromTyped(values));
  let problems = parsed.success ? {} : problemsOf(parsed.error);
  let notice: CommunityRecord | null = null;
  if (eventChangeOf(kind, saved, values)) {
    const read = (name: string) => values[name] ?? "";
    const answer = answeredNotice(
      read,
      eventNoticeBoxes,
      eventNoticeWords.unanswered,
      now,
    );
    notice = answer.notice;
    problems = withProblems(problems, answer.problems);
  }
  if (!parsed.success || Object.keys(problems).length)
    return { ok: false, fields: problems };
  return { ok: true, row: parsed.data, notice };
}
