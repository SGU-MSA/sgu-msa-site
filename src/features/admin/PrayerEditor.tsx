"use client";
import { useActionState, useRef, useState } from "react";
import { savePrayerAction } from "@/features/admin/actions";
import {
  exceptionRows,
  iqamahBothMessage,
  iqamahModes,
  isFridayDate,
  prayerIds,
  prayerLabel,
  type JumuahSession,
} from "@/lib/prayer/adjustments";
import { prayerBoxNames } from "@/lib/community/schema";
import {
  clockOf,
  iqamahOn,
  jumuahField,
  postedSessions,
  weeklyJumuahPrefix,
} from "@/lib/prayer/congregation";
import {
  asksJumuahNotice,
  jumuahNoticeEnd,
  jumuahNoticeText,
  type FridayChange,
} from "@/lib/prayer/jumuah-notice";
import { jumuahNoticeWords as words, prayerEditorWords } from "./fields";
import {
  JumuahSessionsField,
  sessionRows,
  type SessionRow,
} from "./JumuahSessionsField";
import { CheckedForm } from "./form-check/CheckedForm";
import { FieldError } from "./form-check/FieldError";
import { initialKeptForm } from "./form-state";
import { jumuahNoticeBoxes } from "./jumuah-notices";
import { NoticeQuestion } from "./NoticeQuestion";
import { prayerFormProblems } from "./prayer-form";
import { DateField } from "@/shared/ui/DateField";
import { TimeField } from "@/shared/ui/TimeField";
import { anyDate, anyTime, todayOrLater } from "@/lib/time/field-rules";
import { formatTimeOfDay } from "@/lib/time/time-of-day";
import { weekdayDateLabel } from "@/lib/time/date-label";
import { useFormBoxes } from "@/shared/ui/form-boxes";

/** The form's text: field name → value, as posted (`prayerFormText`). */
type Values = Record<string, string>;
type PrayerId = (typeof prayerIds)[number];

/** A typed `HH:MM` clock, or "" while the box is empty or unfinished. */
const typedClock = (value: string) =>
  /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : "";

/** Typed minutes after the adhan (whole, 0 to 120), or null. */
const typedMinutes = (value: string) =>
  /^\d{1,3}$/.test(value) && Number(value) <= 120 ? Number(value) : null;

/** The boxes the preview of prayer `id` follows: the dates and each one-date change. */
const previewBoxes = (id: PrayerId) => [
  "valid_from",
  "valid_until",
  ...Array.from({ length: exceptionRows }, (_, i) => [
    `exception_${i}_date`,
    `exception_${i}_${id}`,
  ]).flat(),
];

/**
 * The line beside a prayer as the board types (review fixes P2): "Adhan
 * 12:31 PM → Iqamah 12:45 PM today". The iqamah comes from the typed rule,
 * the typed "Times start on" / "Times end on" and today's typed one-date
 * change, through `iqamahOn`, the rule visitors get; when the dates leave
 * today out it says when the times start (or ended). Without a calculated
 * adhan (no pin yet) only the iqamah shows.
 */
function IqamahPreview({
  id,
  fixed,
  minutes,
  adhan,
  today,
}: {
  id: PrayerId;
  /** The typed fixed clock (`HH:MM`), or "" (or when After adhan is picked). */
  fixed: string;
  /** The typed minutes after the adhan, or null (or when Fixed time is picked). */
  minutes: number | null;
  /** Today's calculated adhan (ISO), when known. */
  adhan: string | undefined;
  /** Today in Grenada (server clock). */
  today: string;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const boxes = useFormBoxes(ref, previewBoxes(id));
  const box = (name: string) => boxes[name] ?? "";
  // As visitors get it: the first change for today counts.
  const row = Array.from({ length: exceptionRows }, (_, i) => i).find(
    (i) => box(`exception_${i}_date`) === today,
  );
  const changed =
    row === undefined ? "" : typedClock(box(`exception_${row}_${id}`));
  const rule = {
    valid_from: box("valid_from"),
    valid_until: box("valid_until"),
    fixed,
    minutes,
    changed,
  };
  const iqamah = iqamahOn(rule, adhan, today);
  // A date or a note stays on one line ("Tue 20 Oct", "(one-date change)").
  const keep = (text: string) => <span className="keep">{text}</span>;
  const after = iqamah ? (
    <>
      {prayerEditorWords.iqamah(formatTimeOfDay(iqamah))}
      {changed ? <> {keep(prayerEditorWords.changed)}</> : null}
    </>
  ) : !fixed && minutes === null ? (
    prayerEditorWords.noIqamah
  ) : rule.valid_from > today ? (
    <>
      {prayerEditorWords.starts} {keep(weekdayDateLabel(rule.valid_from))}
    </>
  ) : rule.valid_until && rule.valid_until < today ? (
    <>
      {prayerEditorWords.ended} {keep(weekdayDateLabel(rule.valid_until))}
    </>
  ) : (
    prayerEditorWords.notToday
  );
  return (
    <p className="iqamah-preview" ref={ref}>
      {adhan ? (
        <>
          {prayerEditorWords.adhan(formatTimeOfDay(clockOf(adhan)))}{" "}
          <span aria-hidden="true">→</span>
          <span className="sr-only">,</span>{" "}
        </>
      ) : null}
      {after}
    </p>
  );
}

/**
 * One prayer of the Daily iqamah table: the Fixed time / After adhan switch
 * (D-2), one box and the live preview. What is typed in each kind is kept
 * while switching (review fixes P2); only the chosen kind is saved
 * (`prayerFormValues`). A prayer stored with both (before PR4) shows both
 * boxes and its error, with neither side picked, until the board picks one;
 * a save before that is refused with the same words (D-14 amendment,
 * 2026-10-05).
 */
function IqamahRow({
  id,
  values,
  adhan,
  today,
}: {
  id: PrayerId;
  values: Values;
  /** Today's calculated adhan for this prayer (ISO), when known. */
  adhan: string | undefined;
  /** Today in Grenada (server clock). */
  today: string;
}) {
  const [mode, setMode] = useState(values[`mode_${id}`] ?? "fixed");
  const [time, setTime] = useState(values[id] ?? "");
  const [offset, setOffset] = useState(values[`offset_${id}`] ?? "");
  const name = prayerLabel(id);
  const both = mode === "both";
  const errorId = `iqamah-both-${id}`;
  // As visitors get it: with both kinds stored, the minutes win.
  const minutes = mode === "fixed" ? null : typedMinutes(offset);
  const fixed = mode === "after" ? "" : typedClock(time);
  return (
    <tr>
      <th scope="row">{name}</th>
      <td>
        <fieldset
          className="segmented"
          aria-describedby={both ? errorId : undefined}
        >
          <legend className="sr-only">How is {name} iqamah set?</legend>
          {iqamahModes.map(([value, label]) => (
            <label key={value}>
              <input
                type="radio"
                className="sr-only"
                name={`mode_${id}`}
                value={value}
                checked={mode === value}
                onChange={() => setMode(value)}
              />
              {label}
            </label>
          ))}
        </fieldset>
        {both ? <input type="hidden" name={`mode_${id}`} value="both" /> : null}
      </td>
      <td>
        {mode !== "after" ? (
          <TimeField
            name={id}
            label={`${name} iqamah time`}
            rule={anyTime}
            defaultValue={time}
            onChange={setTime}
          />
        ) : null}
        {/* With both (not picked yet) the row's own line says why. */}
        {both ? null : <FieldError name={id} />}
        {mode !== "fixed" ? (
          <span className="iqamah-minutes">
            <input
              type="number"
              name={`offset_${id}`}
              min={0}
              max={120}
              aria-label={`${name} iqamah, minutes after adhan`}
              value={offset}
              onChange={(event) => setOffset(event.target.value)}
            />
            <span aria-hidden="true">min</span>
          </span>
        ) : null}
        {both ? null : <FieldError name={`offset_${id}`} />}
        {both ? (
          <p id={errorId} className="form-error iqamah-both">
            {iqamahBothMessage(id)}
          </p>
        ) : null}
        {/* Under the box, on the 12-hour clock as everywhere (review fixes P1). */}
        <IqamahPreview
          id={id}
          fixed={fixed}
          minutes={minutes}
          adhan={adhan}
          today={today}
        />
      </td>
    </tr>
  );
}

/** The Jumu'ah prayers held in form text under `prefix`. */
const sessionsIn = (values: Values, prefix: string) =>
  postedSessions(
    (name) => values[name] ?? "",
    (name) => name in values,
    prefix,
  );

/** The saved one-Friday Jumu'ah changes, from the saved settings as form text. */
function savedFridays(values: Values): FridayChange[] {
  const rows: FridayChange[] = [];
  for (let i = 0; `exception_${i}_date` in values; i++) {
    const change = values[jumuahField(i, "")] || "none";
    rows.push({
      date: values[`exception_${i}_date`] ?? "",
      jumuah:
        change === "changed"
          ? { change, sessions: sessionsIn(values, jumuahField(i, "")) }
          : { change: change === "cancelled" ? "cancelled" : "none" },
    });
  }
  return rows;
}

/** Complete prayers only (both times chosen), as a notice prefill reads them. */
const complete = (rows: readonly JumuahSession[]): JumuahSession[] =>
  rows
    .filter((row) => typedClock(row.khutbah) && typedClock(row.iqamah))
    .map(({ khutbah, iqamah }) => ({ khutbah, iqamah }));

/** One "Changes for one date" card; `read` gives its typed or stored text. */
function DateChange({
  index,
  read,
  stored,
  onRemove,
  saved,
  usual,
  today,
}: {
  index: number;
  read: (field: string) => string;
  /** This card's stored (or refused) Friday prayers, before any typing. */
  stored: readonly JumuahSession[];
  onRemove: () => void;
  /** The saved one-Friday changes: an unchanged row asks no question. */
  saved: readonly FridayChange[];
  /** The weekly Jumu'ah prayers as typed: a new Friday change starts from them. */
  usual: readonly JumuahSession[];
  /** Today in Grenada (server clock): a change is for today or later. */
  today: string;
}) {
  const [date, setDate] = useState(read("date"));
  const [jumuah, setJumuah] = useState(read("jumuah") || "none");
  const [moved, setMoved] = useState<SessionRow[]>(() => sessionRows(stored));
  const name = (field: string) => `exception_${index}_${field}`;
  const row: FridayChange = {
    date,
    jumuah:
      jumuah === "changed"
        ? { change: "changed", sessions: complete(moved) }
        : { change: jumuah === "cancelled" ? "cancelled" : "none" },
  };
  // "Different time" starts from the weekly prayers as typed (or one empty).
  const chooseJumuah = (value: string) => {
    setJumuah(value);
    if (value === "changed" && !moved.length)
      setMoved(
        sessionRows(usual.length ? usual : [{ khutbah: "", iqamah: "" }]),
      );
  };
  const asks = isFridayDate(date) && asksJumuahNotice(row, saved);
  return (
    <fieldset className="date-change">
      <legend className="sr-only">Change {index + 1}</legend>
      <div className="form-grid">
        <label>
          Date
          <DateField
            name={name("date")}
            rule={todayOrLater(today)}
            defaultValue={date}
            onChange={(event) => setDate(event.target.value)}
          />
          <FieldError name={name("date")} />
        </label>
        <label>
          Reason (shown to visitors)
          <input
            name={name("reason")}
            maxLength={250}
            defaultValue={read("reason")}
          />
          <FieldError name={name("reason")} />
        </label>
      </div>
      {isFridayDate(date) ? (
        <fieldset>
          <legend>Jumu’ah on this Friday</legend>
          {(
            [
              ["none", "As usual"],
              ["cancelled", "No Jumu’ah this week"],
              ["changed", "Different time"],
            ] as const
          ).map(([value, label]) => (
            <label className="check-label" key={value}>
              <input
                type="radio"
                name={name("jumuah")}
                value={value}
                checked={jumuah === value}
                onChange={() => chooseJumuah(value)}
              />
              {label}
            </label>
          ))}
          <FieldError name={name("jumuah")} />
          {jumuah === "changed" ? (
            <>
              <JumuahSessionsField
                prefix={jumuahField(index, "")}
                rows={moved}
                onChange={setMoved}
                label={`Jumu’ah on ${date}`}
                keepOne
              />
              <p className="muted">{prayerEditorWords.fridayHint}</p>
            </>
          ) : null}
        </fieldset>
      ) : null}
      {asks ? (
        <NoticeQuestion
          boxes={jumuahNoticeBoxes(index)}
          words={words}
          text={jumuahNoticeText(row)}
          end={jumuahNoticeEnd(row, complete(usual))}
          // The card's own typed values ("exception_N_…" by its position).
          read={(box) => read(box.slice(name("").length))}
          today={today}
          tour="prayer-jumuah-notice"
        />
      ) : null}
      <p className="muted">
        The Jumu’ah choices appear only when the date is a Friday.
      </p>
      <details open={prayerIds.some((id) => read(id))}>
        <summary>Different iqamah for a daily prayer on this date</summary>
        <div className="form-grid">
          {prayerIds.map((id) => (
            <label key={id}>
              {prayerLabel(id)} iqamah on this date
              <TimeField
                name={name(id)}
                label={`${prayerLabel(id)} iqamah on this date`}
                rule={anyTime}
                defaultValue={read(id)}
              />
              <FieldError name={name(id)} />
            </label>
          ))}
        </div>
      </details>
      <div>
        <button type="button" className="button-secondary" onClick={onRemove}>
          Remove this date
        </button>
      </div>
    </fieldset>
  );
}

/** Section 3: the one-date changes, at most `exceptionRows`. */
function DateChanges({
  values,
  saved,
  usual,
  today,
}: {
  values: Values;
  /** The saved settings as form text (not a refused save's typed text). */
  saved: Values;
  /** The weekly Jumu'ah prayers as typed. */
  usual: readonly JumuahSession[];
  /** Today in Grenada (server clock). */
  today: string;
}) {
  const fridays = savedFridays(saved);
  // Rows keep a stable key, so removing one keeps what is typed in the others.
  const [rows, setRows] = useState(() => {
    const stored: { key: number; source: number | null }[] = [];
    while (
      stored.length < exceptionRows &&
      `exception_${stored.length}_date` in values
    )
      stored.push({ key: stored.length, source: stored.length });
    return stored;
  });
  const [nextKey, setNextKey] = useState(rows.length);
  return (
    <fieldset data-tour="prayer-dates">
      <legend>3. {prayerBoxNames.exceptions}</legend>
      <p className="muted">
        Only that date changes. The next day goes back to normal by itself.
      </p>
      <FieldError name="exceptions" />
      {rows.map((row, index) => (
        <DateChange
          key={row.key}
          index={index}
          read={(field) =>
            row.source === null
              ? ""
              : (values[`exception_${row.source}_${field}`] ?? "")
          }
          stored={
            row.source === null
              ? []
              : sessionsIn(values, jumuahField(row.source, ""))
          }
          onRemove={() =>
            setRows((current) => current.filter((r) => r.key !== row.key))
          }
          saved={fridays}
          usual={usual}
          today={today}
        />
      ))}
      {rows.length < exceptionRows ? (
        <div>
          <button
            type="button"
            className="button-secondary"
            onClick={() => {
              setRows((current) => [
                ...current,
                { key: nextKey, source: null },
              ]);
              setNextKey((key) => key + 1);
            }}
          >
            + Add a date
          </button>
        </div>
      ) : (
        <p className="muted">
          Up to {exceptionRows} dates. Remove old ones before adding more.
        </p>
      )}
    </fieldset>
  );
}

/**
 * The Prayer & iqamah screen (PR4 D-1): one page, three numbered sections
 * and one Save, so one version check covers everything. Prayer starts are
 * calculated (ADR 0017); the board sets only the iqamah, the weekly Jumu'ah
 * prayers and one-date changes. The Hijri date stays as calculated (review
 * fixes P2). A refused save shows what was typed again (`KeptFormState`).
 */
export function PrayerEditor({
  values: stored,
  version,
  method,
  today,
}: {
  /** The saved settings as form text (`prayerFormText`). */
  values: Values;
  version: string;
  /** The fixed calculation's name (`prayerCalculation.label`). */
  method: string;
  /** Today (Grenada, server clock) and its calculated adhan per prayer (ISO), when known. */
  today: {
    date: string;
    adhan: Partial<Record<string, string>>;
  };
}) {
  const [state, action, pending] = useActionState(
    savePrayerAction,
    initialKeptForm,
  );
  // A refused save shows what was typed; `attempt` re-mounts the fields with it.
  const values = state.values ?? stored;
  return (
    <PrayerForm
      key={state.attempt}
      values={values}
      stored={stored}
      version={version}
      method={method}
      today={today}
      action={action}
      state={state}
      pending={pending}
    />
  );
}

/** The form itself, mounted again with the typed text after a refused save. */
function PrayerForm({
  values,
  stored,
  version,
  method,
  today,
  action,
  state,
  pending,
}: {
  values: Values;
  stored: Values;
  version: string;
  method: string;
  today: { date: string; adhan: Partial<Record<string, string>> };
  action: (form: FormData) => void;
  state: Awaited<ReturnType<typeof savePrayerAction>>;
  pending: boolean;
}) {
  // The weekly Jumu'ah prayers, kept here: a Friday change starts from them.
  const [weekly, setWeekly] = useState<SessionRow[]>(() =>
    sessionRows(sessionsIn(values, weeklyJumuahPrefix)),
  );
  return (
    <CheckedForm
      action={action}
      state={state}
      check={prayerFormProblems}
      className="editor-form"
    >
      <input type="hidden" name="version" value={version} />
      <p className="prayer-note" data-tour="prayer-note">
        Prayer <strong>start</strong> times (adhan) are worked out automatically
        for the Musallah: {method}. You only set the <strong>iqamah</strong>.
      </p>
      <fieldset>
        <legend>1. Daily iqamah</legend>
        <table className="iqamah-table" data-tour="prayer-daily">
          <thead>
            <tr>
              <th scope="col">Prayer</th>
              <th scope="col">How is iqamah set?</th>
              <th scope="col">Time or minutes</th>
            </tr>
          </thead>
          <tbody>
            {prayerIds.map((id) => (
              <IqamahRow
                key={id}
                id={id}
                values={values}
                adhan={today.adhan[id]}
                today={today.date}
              />
            ))}
          </tbody>
        </table>
        <div className="form-grid">
          <label>
            {prayerBoxNames.valid_from}
            <DateField
              name="valid_from"
              rule={anyDate}
              defaultValue={values.valid_from ?? ""}
            />
            <FieldError name="valid_from" />
          </label>
          <label>
            {prayerBoxNames.valid_until}
            {/* Today or later (the plan, P2) and not before the start. */}
            <DateField
              name="valid_until"
              rule={todayOrLater(today.date, { box: "valid_from" })}
              defaultValue={values.valid_until ?? ""}
            />
            <FieldError name="valid_until" />
            <span className="muted">
              After this date the iqamah times are hidden until you update them.
            </span>
          </label>
        </div>
      </fieldset>
      <fieldset data-tour="prayer-jumuah">
        <legend>2. Jumu’ah (every Friday)</legend>
        <JumuahSessionsField
          prefix={weeklyJumuahPrefix}
          rows={weekly}
          onChange={setWeekly}
          label="Jumu’ah prayers every Friday"
          empty={prayerEditorWords.noWeekly}
          listError="jumuah_sessions"
        />
      </fieldset>
      <DateChanges
        values={values}
        saved={stored}
        usual={weekly}
        today={today.date}
      />
      <label>
        {prayerBoxNames.notice} (optional)
        <textarea
          name="notice"
          maxLength={1000}
          rows={3}
          defaultValue={values.notice ?? ""}
        />
        <FieldError name="notice" />
        <span className="muted">
          Shown under the prayer table, for example “Sisters’ entrance is via
          the side door this week.”
        </span>
      </label>
      <div>
        <button
          className="button-primary"
          disabled={pending}
          data-tour="prayer-save"
        >
          {pending ? "Saving…" : "Save prayer settings"}
        </button>
      </div>
    </CheckedForm>
  );
}
