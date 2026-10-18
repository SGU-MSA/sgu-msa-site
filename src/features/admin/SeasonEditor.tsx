"use client";
import { useActionState, useState, type FormEvent } from "react";
import type { PrayerSettings } from "@/lib/community/schema";
import type { FormsContent } from "@/lib/content/schemas";
import { SEASON_PHOTOS_MAX } from "@/lib/media/photo-limits";
import { photoListForm } from "@/lib/media/photo-list";
import { CheckedForm } from "./form-check/CheckedForm";
import { FieldError } from "./form-check/FieldError";
import { noProblems } from "./form-check/problems";
import { EditorPreview } from "./preview/EditorPreview";
import { SeasonPageFields } from "./SeasonPageFields";
import { SeasonPreview, type SeasonPreviewLive } from "./SeasonPreview";
import { initialKeptForm, typedValues } from "./form-state";
import {
  confirmedDayHint,
  confirmedDayProblems,
  confirmedDayReach,
  seasonFromForm,
  seasonPreview,
  startingConfirmedDay,
  type SeasonPreview as SeasonDays,
} from "./payment-forms";
import { longDay } from "./payment-words";
import { ArchiveActions } from "./ArchiveActions";
import {
  archiveSeasonAction,
  restoreSeasonAction,
  saveSeasonAction,
} from "./season-actions";
import { DateField } from "@/shared/ui/DateField";
import { anyDate, dayRange, type DayBound } from "@/lib/time/field-rules";

/**
 * A confirmed day of an Islamic season: within `BOARD_DATE_REACH_DAYS` of
 * the expected day (the plan's ±5 days), and after `also`. Any day while the
 * expected day is not known.
 */
function nearExpected(expected: string | null, ...also: DayBound[]) {
  const reach = confirmedDayReach(expected);
  if (!reach) return also.length ? dayRange({ from: also }) : anyDate;
  return dayRange({ from: [reach.from, ...also], until: reach.until });
}

type Adjustment = PrayerSettings["hijri_adjustment"] | null;

/** A season as its form starts: every box as text. */
export type EditableSeason = {
  id: string;
  name: string;
  calendar: "islamic" | "typed";
  hijri_month: string;
  hijri_first_day: string;
  /** "" = until the end of the month. */
  hijri_last_day: string;
  board_starts_on: string;
  board_ends_on: string;
  /** The public page (PR5c): "on" when it has one, the intro, the schedule and photos as JSON, the form key. */
  has_page: string;
  intro: string;
  schedule: string;
  sign_up_form: string;
  photos: string;
  /** The row's `updated_at`; null for a new season. */
  version: string | null;
};

/** The keys of the new photos whose file is chosen in the form. */
function chosenPhotos(form: HTMLFormElement, list: string) {
  const chosen = new Set<string>();
  for (const input of form.querySelectorAll<HTMLInputElement>(
    `input[type="file"][name^="photo:${list}:"]`,
  ))
    if (input.files?.length)
      chosen.add(input.name.slice(`photo:${list}:`.length));
  return chosen;
}

/**
 * Add or edit a season (PR6 WP-5; mockup `season-editor`, Gregorian dates
 * only, D-78): its name, its rule on the Islamic calendar ("starts on 1
 * Ramadan") or typed calendar days, the expected days this year, and the
 * first and last day the board confirms after moon sighting.
 */
export function SeasonEditor({
  season,
  monthNames,
  today,
  adjustment,
  initialPreview,
  pagePath,
  formChoices,
  forms,
  live,
}: {
  season: EditableSeason;
  /** The 12 Islamic month names, worked out on the server. */
  monthNames: readonly string[];
  today: string;
  adjustment: Adjustment;
  initialPreview: SeasonDays;
  /** The season page's address, or null before the first save (PR5c). */
  pagePath: string | null;
  /** The sign-up forms list, by key and name. */
  formChoices: readonly (readonly [key: string, label: string])[];
  /** The sign-up forms, for the Preview's button. */
  forms: FormsContent;
  /** What the page shows besides the typed values, for Preview. */
  live: SeasonPreviewLive;
}) {
  const [state, action, pending] = useActionState(
    saveSeasonAction,
    initialKeptForm,
  );
  const { version, ...saved } = season;
  // A confirmed day out of reach of this year's expected day (last year's)
  // starts empty (review fixes P4): the box never shows a day it refuses.
  const values: Partial<Record<string, string>> = state.values ?? {
    ...saved,
    ...(saved.calendar === "islamic"
      ? {
          board_starts_on: startingConfirmedDay(
            saved.board_starts_on,
            initialPreview.expectedFirst,
          ),
          board_ends_on: startingConfirmedDay(
            saved.board_ends_on,
            initialPreview.expectedLast,
          ),
        }
      : {}),
  };
  const [calendar, setCalendar] = useState(values.calendar ?? "islamic");
  const [preview, setPreview] = useState(initialPreview);
  // Save waits, quietly disabled, while a new photo is made smaller.
  const [shrinking, setShrinking] = useState(false);
  // Worked out again only when a box changes (the Islamic calendar is read
  // from the browser), so the first render matches the server's.
  const onChange = (event: FormEvent<HTMLFormElement>) => {
    const typed = typedValues(new FormData(event.currentTarget));
    setCalendar(typed.calendar === "typed" ? "typed" : "islamic");
    setPreview(seasonPreview(typed, today, adjustment));
  };
  const islamic = calendar === "islamic";
  // The save's own rules (`seasonFromForm`), as you type.
  const check = (element: HTMLFormElement) => {
    const typed = typedValues(new FormData(element));
    const result = seasonFromForm(typed);
    const photos = photoListForm({
      list: "photos",
      posted: typed.photos,
      max: SEASON_PHOTOS_MAX,
      chosen: chosenPhotos(element, "photos"),
    });
    // A confirmed day typed by keyboard outside its ±5 days (review fixes P4).
    const reach = confirmedDayProblems(
      typed,
      seasonPreview(typed, today, adjustment),
    );
    return result.ok && photos.ok && !Object.keys(reach).length
      ? noProblems
      : {
          ...(photos.ok ? {} : photos.fields),
          ...(result.ok ? {} : result.fields),
          ...reach,
        };
  };
  const form = (
    <CheckedForm
      action={action}
      state={state}
      check={check}
      className="editor-form"
      key={state.attempt}
      onChange={onChange}
    >
      <input type="hidden" name="id" value={season.id} />
      <input type="hidden" name="version" value={version ?? ""} />
      <fieldset>
        <legend>The season</legend>
        <label>
          Name
          <input
            name="name"
            required
            maxLength={80}
            autoComplete="off"
            placeholder="Islamic Awareness Week"
            defaultValue={values.name}
          />
          <FieldError name="name" />
        </label>
        <fieldset className="choice">
          <legend>Where its dates come from</legend>
          <div className="check-row">
            <label className="check-label">
              <input
                type="radio"
                name="calendar"
                value="islamic"
                defaultChecked={values.calendar !== "typed"}
              />
              The Islamic calendar
            </label>
            <label className="check-label">
              <input
                type="radio"
                name="calendar"
                value="typed"
                defaultChecked={values.calendar === "typed"}
              />
              Days I type
            </label>
          </div>
        </fieldset>
        {islamic ? (
          <>
            <div className="form-grid compact">
              <label>
                Month
                <select
                  name="hijri_month"
                  required
                  defaultValue={values.hijri_month}
                >
                  <option value="">Choose a month</option>
                  {monthNames.map((name, index) => (
                    <option key={name} value={index + 1}>
                      {name}
                    </option>
                  ))}
                </select>
                <FieldError name="hijri_month" />
              </label>
              <label>
                From day
                <input
                  name="hijri_first_day"
                  type="number"
                  required
                  min={1}
                  max={30}
                  inputMode="numeric"
                  defaultValue={values.hijri_first_day}
                />
                <FieldError name="hijri_first_day" />
              </label>
              <label>
                Until day
                <select
                  name="hijri_last_day"
                  defaultValue={values.hijri_last_day}
                >
                  <option value="">End of the month</option>
                  {Array.from({ length: 30 }, (_, index) => (
                    <option key={index} value={index + 1}>
                      {index + 1}
                    </option>
                  ))}
                </select>
                <FieldError name="hijri_last_day" />
              </label>
            </div>
            <div className="season-expected" aria-live="polite">
              <p>
                Expected this year:{" "}
                <strong>{preview.expected ?? "not known yet"}</strong>
                {preview.expected ? (
                  <span className="admin-badge">expected</span>
                ) : null}
              </p>
              <p className="muted">
                {adjustment === null
                  ? "The expected days can't be worked out right now: the prayer settings could not be loaded."
                  : "Worked out from the same Islamic calendar as the prayer page. Next year's days appear by themselves after this one ends."}
              </p>
            </div>
          </>
        ) : null}
      </fieldset>
      <fieldset>
        <legend>
          {islamic ? "Confirm when the moon sighting is announced" : "The days"}
        </legend>
        <div className="form-grid compact">
          <label>
            {islamic ? "First day (confirmed)" : "First day"}
            <DateField
              name="board_starts_on"
              rule={islamic ? nearExpected(preview.expectedFirst) : anyDate}
              required={!islamic}
              defaultValue={values.board_starts_on}
            />
            <FieldError name="board_starts_on" />
            {islamic && preview.expectedFirst ? (
              <span className="muted">
                Empty = expected {longDay(preview.expectedFirst)}.{" "}
                {confirmedDayHint(confirmedDayReach(preview.expectedFirst)!)}
              </span>
            ) : null}
          </label>
          <label>
            {islamic ? "Last day (confirmed)" : "Last day"}
            {/* On or after the first day (the save's rule). */}
            <DateField
              name="board_ends_on"
              rule={
                islamic
                  ? nearExpected(preview.expectedLast, {
                      box: "board_starts_on",
                    })
                  : dayRange({ from: { box: "board_starts_on" } })
              }
              required={!islamic}
              defaultValue={values.board_ends_on}
            />
            <FieldError name="board_ends_on" />
            {islamic && preview.expectedLast ? (
              <span className="muted">
                Empty = expected {longDay(preview.expectedLast)}.{" "}
                {confirmedDayHint(confirmedDayReach(preview.expectedLast)!)}
              </span>
            ) : null}
          </label>
        </div>
        {islamic ? (
          <p className="muted">
            You can confirm the first day now and the last day later. Clear a
            box to go back to the expected day. If only the first day is
            confirmed, the last day moves with it.
          </p>
        ) : (
          <p className="muted">
            After the last day the season is over until you type new days.
          </p>
        )}
        {preview.resolved ? (
          <p aria-live="polite">
            In use now: <strong>{preview.resolved}</strong>
          </p>
        ) : null}
      </fieldset>
      <SeasonPageFields
        values={values}
        path={pagePath}
        formChoices={formChoices}
        onShrinking={setShrinking}
      />
      <button className="button-primary" disabled={pending || shrinking}>
        {pending ? "Saving…" : "Save"}
      </button>
    </CheckedForm>
  );
  return (
    <>
      <EditorPreview
        form={form}
        preview={(typed) => (
          <SeasonPreview
            values={typed}
            today={today}
            adjustment={adjustment}
            forms={forms}
            live={live}
          />
        )}
      />
      {version ? (
        <ArchiveActions
          archived={false}
          fields={{ id: season.id, version }}
          archive={{
            action: archiveSeasonAction,
            summary: "Archive this season",
            label: "Archive season",
            explain:
              "It leaves the list of seasons. A season that a fund or ticket uses can't be archived: move the fund or ticket to another season, or archive it, first.",
          }}
          restore={{ action: restoreSeasonAction }}
        />
      ) : null}
    </>
  );
}
