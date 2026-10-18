"use client";
import { useState } from "react";

import {
  announcementPriority,
  TIMEZONE,
  type AnnouncementPriority,
  type CommunityRecord,
  type EventStatus,
} from "@/lib/community/schema";

import {
  cancelReasonExample,
  featuredWithoutEnd,
  priorityBox,
  priorityChoices,
  statusBox,
  statusChoices,
  urgentEndHint,
} from "./fields";
import { FieldError } from "./form-check/FieldError";
import { grenadaWallTime } from "./form-state";
import { DateField } from "@/shared/ui/DateField";
import { TimeField } from "@/shared/ui/TimeField";
import {
  anyDate,
  anyTime,
  dayRange,
  todayOrLater,
} from "@/lib/time/field-rules";

/** Typed values of a refused save, or null on a fresh form. */
type Typed = Record<string, string> | null;

/** One radio card: the choice and its one-line hint (mockups `announcement-editor`, `event-status`). */
function ChoiceCards<T extends string>({
  name,
  choices,
  value,
  onChange,
}: {
  name: string;
  choices: readonly (readonly [T, string, string])[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="choice-cards">
      {choices.map(([choice, label, hint]) => (
        <div className="choice-card" key={choice}>
          <label className="check-label">
            <input
              type="radio"
              name={name}
              value={choice}
              checked={value === choice}
              aria-describedby={`${name}-${choice}-hint`}
              onChange={() => onChange(choice)}
            />
            {label}
          </label>
          <span id={`${name}-${choice}-hint`} className="muted">
            {hint}
          </span>
        </div>
      ))}
    </div>
  );
}

const untilFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
/** "Tue 13 Oct, 10:00 AM" (Grenada time). */
function until(instant: string) {
  const time = Date.parse(instant);
  if (Number.isNaN(time)) return "";
  const part = Object.fromEntries(
    untilFormat.formatToParts(time).map((p) => [p.type, p.value]),
  );
  return `${part.weekday} ${part.day} ${part.month}, ${part.hour}:${part.minute} ${(part.dayPeriod ?? "").toUpperCase()}`;
}

/** An urgent notice already current, for "Urgent now" in the editor. */
export type UrgentNow = { title: string; urgent_until: string };

/**
 * The announcement's "How important is it?" (PR5a D-1, D-16, D-17): Normal,
 * Featured or Urgent with its dates. Urgent replaces "Hide after" with
 * "Hide at" (date and exact time, Grenada time) and lists the urgent notices
 * already current, which take turns with this one.
 */
export function PriorityBox({
  record,
  typed,
  others,
  today,
}: {
  record: CommunityRecord;
  typed: Typed;
  others: readonly UrgentNow[];
  /** Today in Grenada (server clock): "Hide at" is never before it. */
  today: string;
}) {
  const [priority, setPriority] = useState<AnnouncementPriority>(
    (typed?.priority as AnnouncementPriority | undefined) ??
      announcementPriority(record),
  );
  const [hideAfter, setHideAfter] = useState(record.expires_on);
  const end = grenadaWallTime(record.urgent_until);
  const { parts } = priorityBox;
  return (
    <fieldset className="choice priority" data-tour="content-priority">
      <legend>{priorityBox.label}</legend>
      <ChoiceCards
        name="priority"
        choices={priorityChoices}
        value={priority}
        onChange={setPriority}
      />
      {priority === "featured" && !hideAfter ? (
        <p className="muted">{featuredWithoutEnd}</p>
      ) : null}
      <div className="form-grid compact" data-tour="content-date">
        <div className="form-field">
          <label htmlFor="content-date">{parts.date}</label>
          <DateField
            id="content-date"
            name="date"
            rule={anyDate}
            required
            defaultValue={record.date}
          />
          <FieldError name="date" />
        </div>
        {priority === "urgent" ? (
          <div className="form-field">
            <label htmlFor="content-urgent_on">{parts.urgent_until}</label>
            <div className="form-grid compact">
              {/* Later than now and not before the item's date (the save's rules). */}
              <DateField
                id="content-urgent_on"
                name="urgent_on"
                rule={todayOrLater(today, { box: "date" })}
                required
                aria-describedby="content-urgent-hint"
                defaultValue={typed?.urgent_on ?? end.date}
              />
              <TimeField
                name="urgent_at"
                label={`${parts.urgent_until}, time`}
                rule={anyTime}
                required
                aria-describedby="content-urgent-hint"
                defaultValue={typed?.urgent_at ?? end.time}
              />
            </div>
            <FieldError
              name="urgent_until"
              controls={["urgent_on", "urgent_at"]}
            />
            <span id="content-urgent-hint" className="muted">
              {urgentEndHint}
            </span>
          </div>
        ) : (
          <div className="form-field">
            <label htmlFor="content-expires_on">{parts.expires_on}</label>
            {/* Never before the item's date (the save's rule). */}
            <DateField
              id="content-expires_on"
              name="expires_on"
              rule={dayRange({ from: { box: "date" } })}
              defaultValue={record.expires_on}
              onChange={(event) => setHideAfter(event.target.value)}
            />
            <FieldError name="expires_on" />
          </div>
        )}
      </div>
      {priority === "urgent" && others.length ? (
        <p className="muted">
          <strong>Urgent now: {others.length}</strong> (
          {others
            .map(
              (notice) =>
                `“${notice.title}”, until ${until(notice.urgent_until)}`,
            )
            .join("; ")}
          ). They take turns in the band; each hides at its own time.
        </p>
      ) : null}
    </fieldset>
  );
}

/**
 * The event's "Is it still happening?" (PR5a D-2; review 2, 2026-10-05):
 * Scheduled, Postponed (new date not known yet) or Cancelled with a reason.
 * A known new date is simply typed in Start date.
 */
export function StatusBox({
  record,
  typed,
  onStatus,
}: {
  record: CommunityRecord;
  typed: Typed;
  /** Told when the choice changes (the announcement question follows it). */
  onStatus?: (status: EventStatus) => void;
}) {
  const [status, setStatus] = useState<EventStatus>(
    (typed?.status as EventStatus | undefined) ?? record.status,
  );
  return (
    <fieldset className="choice status" data-tour="content-status">
      <legend>{statusBox.label}</legend>
      <ChoiceCards
        name="status"
        choices={statusChoices}
        value={status}
        onChange={(next) => {
          setStatus(next);
          onStatus?.(next);
        }}
      />
      <FieldError name="status" />
      {status === "cancelled" ? (
        <div className="form-field">
          <label htmlFor="content-status_note">
            {statusBox.parts.status_note}
          </label>
          <input
            id="content-status_note"
            name="status_note"
            required
            maxLength={250}
            placeholder={cancelReasonExample}
            defaultValue={record.status_note}
          />
          <FieldError name="status_note" />
        </div>
      ) : null}
    </fieldset>
  );
}
