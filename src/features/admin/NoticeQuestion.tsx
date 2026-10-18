"use client";
import { useState } from "react";

import { URGENT_BAND_MAX_CHARS } from "@/lib/community/schema";
import { FieldError } from "./form-check/FieldError";
import { DateField } from "@/shared/ui/DateField";
import { TimeField } from "@/shared/ui/TimeField";
import { anyTime, todayOrLater } from "@/lib/time/field-rules";
import type { NoticeBoxes } from "./jumuah-notices";

/** The question's words (`jumuahNoticeWords`, `eventNoticeWords`). */
export type NoticeWords = {
  question: string;
  required: string;
  text: string;
  end: string;
  endHint: string;
};

/**
 * "Also show an urgent notice …?" (PR5a D-3, D-19; mockup `jumuah-notice`),
 * asked under a changed Friday on Prayer & iqamah and, since review 2
 * (2026-10-05), under a published event that gets a new date or is
 * cancelled: a required Yes or No; Yes posts the editable text and "Hide at"
 * prefilled by the caller. Nothing is stored on the Friday or the event.
 */
export function NoticeQuestion({
  boxes,
  words,
  text,
  end,
  read,
  today,
  tour,
}: {
  boxes: NoticeBoxes;
  words: NoticeWords;
  /** The prefilled text; typing in the box replaces it until it changes. */
  text: string;
  /** The prefilled "Hide at", as the date and time boxes show it. */
  end: { date: string; time: string };
  /** What a refused save typed into the question ("" when nothing). */
  read: (name: string) => string;
  /** Today in Grenada (server clock): the notice hides later than now. */
  today: string;
  /** The "Show me how" step that points at it. */
  tour?: string;
}) {
  const [answer, setAnswer] = useState(read(boxes.answer));
  const hintId = `${boxes.answer}-hint`;
  return (
    <fieldset className="jumuah-notice" data-tour={tour}>
      <legend>{words.question}</legend>
      <p className="muted">{words.required}</p>
      <div className="check-row">
        {(
          [
            ["yes", "Yes"],
            ["no", "No"],
          ] as const
        ).map(([value, label]) => (
          <label className="check-label" key={value}>
            <input
              type="radio"
              name={boxes.answer}
              value={value}
              checked={answer === value}
              onChange={() => setAnswer(value)}
            />
            {label}
          </label>
        ))}
      </div>
      <FieldError name={boxes.answer} />
      {answer === "yes" ? (
        <>
          <label>
            {words.text}
            {/* Prefilled again when what it says changes. */}
            <input
              key={text}
              name={boxes.text}
              maxLength={URGENT_BAND_MAX_CHARS}
              defaultValue={read(boxes.text) || text}
            />
            <FieldError name={boxes.text} />
          </label>
          <div className="form-field">
            <label htmlFor={`${boxes.on}-box`}>{words.end}</label>
            {/* The date and the time side by side, level with each other. */}
            <div className="form-grid compact">
              <DateField
                key={end.date}
                id={`${boxes.on}-box`}
                name={boxes.on}
                rule={todayOrLater(today)}
                aria-describedby={hintId}
                defaultValue={read(boxes.on) || end.date}
              />
              <TimeField
                key={end.time}
                name={boxes.at}
                label={`${words.end}, time`}
                rule={anyTime}
                aria-describedby={hintId}
                defaultValue={read(boxes.at) || end.time}
              />
            </div>
            <FieldError name={boxes.at} controls={[boxes.on, boxes.at]} />
          </div>
          <span id={hintId} className="muted">
            {words.endHint}
          </span>
        </>
      ) : null}
    </fieldset>
  );
}
