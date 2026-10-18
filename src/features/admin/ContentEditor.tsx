"use client";
import { Fragment, useActionState, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  archiveRecordAction,
  restoreRecordAction,
  saveRecordAction,
} from "@/features/admin/actions";
import {
  duplicableCollections,
  type Collection,
  type CommunityRecord,
} from "@/lib/community/schema";
import {
  eventNoticeEnd,
  eventNoticeText,
  type EventChange,
} from "@/lib/community/event-notice";
import {
  contentFieldList,
  contentFields,
  contentFormRecord,
  eventNoticeBoxes,
  eventNoticeWords,
  hiddenContentFields,
  categoryWords,
  createFromWords,
  seasonWords,
  termWords,
  ticketWords,
  type ContentField,
} from "./fields";
import type { TicketChoice } from "./event-tickets";
import { UPLOAD_MAX_LABEL } from "@/lib/media/photo-limits";
import { PriorityBox, StatusBox, type UrgentNow } from "./ContentChoices";
import { contentForm, eventChangeOf, typedEvent } from "./content-form";
import { CheckedForm } from "./form-check/CheckedForm";
import { FieldError } from "./form-check/FieldError";
import { noProblems } from "./form-check/problems";
import { initialKeptForm, recordFromTyped, typedValues } from "./form-state";
import { ImageField } from "./ImageField";
import { NoticeQuestion } from "./NoticeQuestion";
import { ArchiveActions } from "./ArchiveActions";
import { contentPreview } from "./preview/ContentPreview";
import { EditorPreview } from "./preview/EditorPreview";
import { DateField } from "@/shared/ui/DateField";
import { TimeField } from "@/shared/ui/TimeField";
import { anyDate, anyTime, dayRange, laterThan } from "@/lib/time/field-rules";

/** The item as typed in a refused save. */
function typedRecord(
  record: CommunityRecord,
  values: Record<string, string> | null,
): CommunityRecord {
  return values ? { ...record, ...recordFromTyped(values) } : record;
}

const fieldId = (name: string) => `content-${name}`;
const hintId = (name: string) => `${fieldId(name)}-hint`;
const labelId = (name: string) => `${fieldId(name)}-label`;
/** Boxes drawn as a `TimeField` group, which a `<label>` cannot point at. */
const timeBoxes: ReadonlySet<string> = new Set(["start_time", "end_time"]);

/**
 * The "Show me how" step (PR4 D-10) that points at a box, or at a row of
 * boxes: the name, and the date with any times beside it.
 */
function tourTargetOf(fields: readonly ContentField[]) {
  const names = fields.map((field) => field.name);
  return names.includes("title")
    ? "content-title"
    : names.includes("date")
      ? "content-date"
      : undefined;
}

/** A choice box's own words: "No …", an archived choice, a list that could not load. */
type ChoiceWords = {
  none: string;
  archived: (name: string) => string;
  unavailable: string;
};

/**
 * One choice box of an event (the ticket, PR6 WP-9; the season, PR5c; the
 * category and term, review fixes P3): "No …" or one of the choices. When
 * the choices could not be loaded the stored value is kept.
 */
function ChoiceSelect({
  field,
  value,
  choices,
  words,
  describedBy,
}: {
  field: ContentField;
  /** The stored or typed value of the box. */
  value: string;
  choices: { choices: readonly TicketChoice[]; unavailable: boolean };
  words: ChoiceWords;
  describedBy: string | undefined;
}) {
  if (choices.unavailable)
    return (
      <div className="form-field">
        <input type="hidden" name={field.name} value={value} />
        <p className="muted" role="status">
          {field.label}: {words.unavailable}
        </p>
      </div>
    );
  return (
    <div className="form-field">
      <label htmlFor={fieldId(field.name)}>{field.label}</label>
      <select
        id={fieldId(field.name)}
        name={field.name}
        aria-describedby={describedBy}
        defaultValue={value}
      >
        <option value="">{words.none}</option>
        {choices.choices.map((choice) => (
          <option key={choice.id} value={choice.id}>
            {choice.archived ? words.archived(choice.name) : choice.name}
          </option>
        ))}
      </select>
      <FieldError name={field.name} controls={[fieldId(field.name)]} />
      {field.hint ? (
        <span id={hintId(field.name)} className="muted">
          {field.hint}
        </span>
      ) : null}
    </div>
  );
}

/** The input of one text box, with its id and hint. */
function TextControl({
  field,
  record,
  describedBy,
  sameDay,
}: {
  field: ContentField;
  record: CommunityRecord;
  describedBy: string | undefined;
  /** The item ends on the day it starts: its end time follows its start time. */
  sameDay: boolean;
}) {
  const common = {
    id: fieldId(field.name),
    name: field.name,
    "aria-describedby": describedBy,
    // An example, never saved (D-26).
    placeholder: field.placeholder,
  };
  switch (field.name) {
    case "title":
      return (
        <input
          {...common}
          required
          maxLength={160}
          defaultValue={record.title}
        />
      );
    case "summary":
      return (
        <textarea
          {...common}
          maxLength={500}
          rows={2}
          defaultValue={record.summary}
        />
      );
    case "body":
      return (
        <textarea
          {...common}
          maxLength={20000}
          rows={7}
          defaultValue={record.body}
        />
      );
    case "date":
      return (
        <DateField
          {...common}
          rule={anyDate}
          required
          defaultValue={record.date}
        />
      );
    // Never before the item's own date (the save's rule).
    case "expires_on":
    case "end_date":
      return (
        <DateField
          {...common}
          rule={dayRange({ from: { box: "date" } })}
          defaultValue={record[field.name]}
        />
      );
    case "start_time":
    case "end_time":
      return (
        <TimeField
          id={common.id}
          name={field.name}
          label={field.label}
          labelledBy={labelId(field.name)}
          aria-describedby={describedBy}
          // On its start day an end time comes after the start (the save's rule).
          rule={
            field.name === "end_time" && sameDay
              ? laterThan({ box: "start_time" })
              : anyTime
          }
          defaultValue={record[field.name]}
        />
      );
    case "url":
      return <input {...common} type="url" defaultValue={record.url} />;
    case "location":
    case "image_alt":
      return (
        <input {...common} maxLength={250} defaultValue={record[field.name]} />
      );
    default:
      return null;
  }
}

/**
 * The newsletter's "PDF or link" choice (D-7). The chosen one is what visitors
 * open: choosing the link takes an attached PDF off the issue (a stored PDF
 * would otherwise win, `managedNewsletters`); choosing the PDF keeps the
 * stored link only while a PDF is attached, so a PDF choice without a file is
 * refused instead of silently using the link.
 */
function NewsletterChoice({
  label,
  record,
  stored,
  typed,
}: {
  label: string;
  record: CommunityRecord;
  stored: CommunityRecord;
  typed: string | undefined;
}) {
  const [source, setSource] = useState(
    typed ?? (stored.url && !stored.file_path ? "link" : "pdf"),
  );
  return (
    <fieldset className="choice">
      <legend>{label}</legend>
      {(
        [
          ["pdf", `Upload a PDF or an image (max ${UPLOAD_MAX_LABEL})`],
          ["link", "Link to it (https://…)"],
        ] as const
      ).map(([value, text]) => (
        <label className="check-label" key={value}>
          <input
            type="radio"
            name="newsletter_source"
            value={value}
            checked={source === value}
            onChange={() => setSource(value)}
          />
          {text}
        </label>
      ))}
      {/* Keyed: the two choices never share inputs. */}
      {source === "pdf" ? (
        <Fragment key="pdf">
          <input type="hidden" name="file_path" value={stored.file_path} />
          <input
            type="hidden"
            name="url"
            value={stored.file_path ? record.url : ""}
          />
          <input
            name="file"
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            aria-label="Newsletter file"
            aria-describedby={stored.file_path ? hintId("file") : undefined}
          />
          {stored.file_path ? (
            <span id={hintId("file")} className="muted">
              {stored.file_path.endsWith(".pdf")
                ? "A PDF is attached; choose a file to replace it."
                : "An image is attached; choose a file to replace it."}
            </span>
          ) : null}
          <FieldError name="file_path" controls={["file"]} />
        </Fragment>
      ) : (
        <Fragment key="link">
          <input type="hidden" name="file_path" value="" />
          <input
            name="url"
            type="url"
            placeholder="https://"
            aria-label="Link to the newsletter"
            aria-describedby={stored.file_path ? hintId("file") : undefined}
            defaultValue={record.url}
          />
          {stored.file_path ? (
            <span id={hintId("file")} className="muted">
              Saving takes the attached file off this issue.
            </span>
          ) : null}
          <FieldError name="url" />
          <FieldError name="file_path" controls={["url"]} />
        </Fragment>
      )}
    </fieldset>
  );
}

/** Whether a file box of the form holds a chosen file. */
function chosenIn(form: HTMLFormElement, name: string) {
  const file = new FormData(form).get(name);
  return file instanceof File && file.size > 0;
}

/**
 * "Also post an announcement?" under a published event that gets a new date
 * or is cancelled (review 2, 2026-10-05; the Jumu'ah pattern): its text and
 * "Hide at" are prefilled from what is typed now.
 */
function EventNotice({
  change,
  stored,
  live,
  typed,
  today,
}: {
  change: EventChange;
  stored: CommunityRecord;
  live: Record<string, string>;
  typed: Record<string, string> | null;
  /** Today in Grenada (server clock): the notice hides at a later time. */
  today: string;
}) {
  const event = typedEvent(live);
  return (
    <NoticeQuestion
      boxes={eventNoticeBoxes}
      words={eventNoticeWords}
      text={eventNoticeText(change, event)}
      end={eventNoticeEnd(change, stored, event)}
      read={(name) => typed?.[name] ?? ""}
      today={today}
      tour="content-announce"
    />
  );
}

export function ContentEditor({
  kind,
  record: stored,
  urgentNow = [],
  tickets = { choices: [], unavailable: false },
  seasons = { choices: [], unavailable: false },
  lists = { categories: [], terms: [], unavailable: false },
  today,
}: {
  kind: Collection;
  record: CommunityRecord;
  /** Announcements: the other urgent notices current now ("Urgent now: N"). */
  urgentNow?: readonly UrgentNow[];
  /** Events: the tickets the event may sell (PR6 WP-9). */
  tickets?: { choices: readonly TicketChoice[]; unavailable: boolean };
  /** Events: the seasons the event may belong to (PR5c). */
  seasons?: { choices: readonly TicketChoice[]; unavailable: boolean };
  /** Events: the Category and Term choices from the Lists (review fixes P3). */
  lists?: {
    categories: readonly TicketChoice[];
    terms: readonly TicketChoice[];
    unavailable: boolean;
  };
  /** Today in Grenada on the server clock, for the Preview's "Scheduled" line. */
  today: string;
}) {
  const [state, action, pending] = useActionState(
    saveRecordAction,
    initialKeptForm,
  );
  // Save waits, quietly disabled, while a chosen photo is made smaller.
  const [shrinking, setShrinking] = useState(false);
  // A refused save shows what was typed; `attempt` re-mounts the fields with it.
  const record = contentFormRecord(kind, typedRecord(stored, state.values));
  const choosesFile = contentFieldList(kind).some(
    (field) => field.name === "file",
  );
  const choosesImage = contentFieldList(kind).some(
    (field) => field.name === "image",
  );
  const saved = stored.updated_at ? stored : null;
  // The form's values as typed, for the event's announcement question.
  const [live, setLive] = useState<Record<string, string> | null>(null);
  const onChange = (event: FormEvent<HTMLFormElement>) => {
    if (kind === "events")
      setLive(typedValues(new FormData(event.currentTarget)));
  };
  // After a refused save, what was typed (the question stays on screen).
  const typedNow = live ?? state.values;
  const change = typedNow ? eventChangeOf(kind, saved, typedNow) : null;
  // An event that ends on its start day (no end date, or the same one).
  const endsOn = typedNow?.end_date ?? record.end_date;
  const sameDay = !endsOn || endsOn === (typedNow?.date ?? record.date);
  // The same rules as the save (`contentForm`), as you type.
  const check = (form: HTMLFormElement) => {
    const result = contentForm({
      kind,
      values: typedValues(new FormData(form)),
      chosen: { image: chosenIn(form, "image"), file: chosenIn(form, "file") },
      saved,
      now: new Date(),
    });
    return result.ok ? noProblems : result.fields;
  };

  /** One box: its label, input and hint (`contentFields`), alone or in a row. */
  const box = (field: ContentField, row?: { hint: string | undefined }) => {
    const describedBy = field.hint ? hintId(field.name) : row?.hint;
    const hint = field.hint ? (
      <span id={hintId(field.name)} className="muted">
        {field.hint}
      </span>
    ) : null;
    switch (field.name) {
      case "image":
        return (
          <ImageField
            key={field.name}
            label={field.label}
            attached={Boolean(stored.image_path)}
            onShrinking={setShrinking}
            // A photo chosen from the uploaded ones is saved as the picture
            // (and kept after a refused save, as typed text is).
            pick={{ field: "image_path", value: record.image_path }}
          />
        );
      case "file":
        return (
          <NewsletterChoice
            key={field.name}
            label={field.label}
            record={record}
            stored={stored}
            typed={state.values?.newsletter_source}
          />
        );
      case "priority":
        return (
          <PriorityBox
            key={field.name}
            record={record}
            typed={state.values}
            others={urgentNow}
            today={today}
          />
        );
      case "status":
        return (
          <Fragment key={field.name}>
            <StatusBox record={record} typed={state.values} />
            {change ? (
              <EventNotice
                change={change}
                stored={stored}
                live={typedNow ?? {}}
                typed={state.values}
                today={today}
              />
            ) : null}
          </Fragment>
        );
      case "ticket_payment_item_id":
        return (
          <ChoiceSelect
            key={field.name}
            field={field}
            value={record.ticket_payment_item_id}
            choices={tickets}
            words={ticketWords}
            describedBy={describedBy}
          />
        );
      case "season_id":
        return (
          <ChoiceSelect
            key={field.name}
            field={field}
            value={record.season_id}
            choices={seasons}
            words={seasonWords}
            describedBy={describedBy}
          />
        );
      case "category_id":
      case "term_id":
        return (
          <ChoiceSelect
            key={field.name}
            field={field}
            value={record[field.name]}
            choices={{
              choices:
                field.name === "category_id" ? lists.categories : lists.terms,
              unavailable: lists.unavailable,
            }}
            words={field.name === "category_id" ? categoryWords : termWords}
            describedBy={describedBy}
          />
        );
      case "featured":
        return (
          <div className="form-field" key={field.name}>
            <label className="check-label">
              <input
                type="checkbox"
                name="featured"
                aria-describedby={describedBy}
                defaultChecked={record.featured}
              />
              {field.label}
            </label>
            {hint}
          </div>
        );
      default:
        return (
          <div
            className="form-field"
            key={field.name}
            data-tour={row ? undefined : tourTargetOf([field])}
          >
            {timeBoxes.has(field.name) ? (
              <span id={labelId(field.name)} className="field-name">
                {field.label}
              </span>
            ) : (
              <label htmlFor={fieldId(field.name)}>{field.label}</label>
            )}
            <TextControl
              field={field}
              record={record}
              describedBy={describedBy}
              sameDay={sameDay}
            />
            <FieldError name={field.name} controls={[fieldId(field.name)]} />
            {hint}
          </div>
        );
    }
  };
  const entries = contentFields[kind];
  const more = contentFieldList(kind).filter((field) => field.more);

  const form = (
    <CheckedForm
      action={action}
      state={state}
      check={check}
      className="editor-form"
      key={state.attempt}
      onChange={onChange}
    >
      <input type="hidden" name="collection" value={kind} />
      <input type="hidden" name="id" value={stored.id} />
      <input type="hidden" name="version" value={stored.updated_at ?? ""} />
      {choosesImage ? null : (
        <input type="hidden" name="image_path" value={stored.image_path} />
      )}
      {choosesFile ? null : (
        <input type="hidden" name="file_path" value={stored.file_path} />
      )}
      {/* Fields this kind does not show keep their stored value (D-7). */}
      {hiddenContentFields(kind).map((name) => (
        <input
          key={name}
          type="hidden"
          name={name}
          value={
            name === "featured" ? (record.featured ? "on" : "") : record[name]
          }
        />
      ))}
      {entries.map((entry, index) =>
        "row" in entry ? (
          <div
            className="form-field"
            key={`row-${index}`}
            data-tour={tourTargetOf(entry.row)}
          >
            <div className="form-grid compact">
              {entry.row.map((field) =>
                box(field, {
                  hint: entry.hint ? hintId(`row-${index}`) : undefined,
                }),
              )}
            </div>
            {entry.hint ? (
              <span id={hintId(`row-${index}`)} className="muted">
                {entry.hint}
              </span>
            ) : null}
          </div>
        ) : entry.more ? null : (
          box(entry)
        ),
      )}
      {more.length ? (
        // Open when one of its boxes has a value, so nothing set is hidden.
        <details
          open={more.some((field) =>
            Boolean(record[field.name as keyof CommunityRecord]),
          )}
        >
          <summary>More options</summary>
          {more.map((field) => box(field))}
        </details>
      ) : null}
      <fieldset className="choice" data-tour="content-visibility">
        <legend>Who can see it?</legend>
        {(
          [
            ["off", "Only the board (draft)"],
            ["on", "Everyone on the website"],
          ] as const
        ).map(([value, label]) => (
          <label className="check-label" key={value}>
            <input
              type="radio"
              name="published"
              value={value}
              defaultChecked={record.published === (value === "on")}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <div>
        <button
          className="button-primary"
          disabled={pending || shrinking}
          data-tour="content-save"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </CheckedForm>
  );

  return (
    <div>
      <EditorPreview
        form={form}
        preview={contentPreview(kind, stored, today)}
      />
      {stored.updated_at &&
      (duplicableCollections as readonly Collection[]).includes(kind) ? (
        <section
          className="content-card"
          aria-labelledby="create-from"
          data-tour="content-duplicate"
        >
          <h2 id="create-from">{createFromWords.label(kind)}</h2>
          <p>{createFromWords.explain(kind)}</p>
          <Link
            className="button-secondary"
            href={`/admin/content/${kind}/new?from=${stored.id}`}
          >
            {createFromWords.label(kind)}
          </Link>
        </section>
      ) : null}
      {stored.updated_at ? (
        <ArchiveActions
          archived={false}
          fields={{
            collection: kind,
            id: stored.id,
            version: stored.updated_at,
          }}
          archive={{
            action: archiveRecordAction,
            summary: "Archive this item",
            label: "Archive",
            explain:
              "Archiving takes the item and its image or PDF off the website. It moves to the Archived tab, where you can restore it as a draft.",
            tour: "content-archive",
          }}
          restore={{ action: restoreRecordAction }}
        />
      ) : null}
    </div>
  );
}
