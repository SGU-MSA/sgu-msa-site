"use client";
import { useId, useState } from "react";
import { SEASON_PHOTOS_MAX } from "@/lib/media/photo-limits";
import type { ListedPhoto } from "@/lib/media/photo-list";
import { SCHEDULE_ROWS_MAX, type ScheduleRow } from "@/lib/community/seasons";
import { systemText } from "@/lib/system-text";
import { SortableList } from "@/shared/ui/SortableList";
import { FieldError } from "./form-check/FieldError";
import { PhotoListField } from "./PhotoListField";

const words = systemText.pages;

type Row = ScheduleRow & { key: string };
// Added rows only (in the browser); starting rows are keyed by place, the
// same on the server and in the browser.
let nextKey = 0;
const keyed = (row: ScheduleRow): Row => ({ ...row, key: `added${nextKey++}` });

/** The schedule as typed (JSON), read back; [] when it cannot be read. */
export function scheduleRows(text: string | undefined): ScheduleRow[] {
  try {
    const rows: unknown = JSON.parse(text || "[]");
    return Array.isArray(rows)
      ? rows.map((row) => ({
          what: String(row?.what ?? ""),
          when: String(row?.when ?? ""),
          where: String(row?.where ?? ""),
        }))
      : [];
  } catch {
    return [];
  }
}

/** The photos as typed (JSON), read back; [] when they cannot be read. */
export function photoRows(text: string | undefined): ListedPhoto[] {
  try {
    const rows: unknown = JSON.parse(text || "[]");
    return Array.isArray(rows)
      ? rows.map((row) => ({
          src: String(row?.src ?? ""),
          alt: String(row?.alt ?? ""),
        }))
      : [];
  } catch {
    return [];
  }
}

/**
 * The schedule (D-26): rows of What, When and Where, dragged into order,
 * each box with an example that is never saved, also on a new empty row.
 * Posted as JSON in "schedule".
 */
function ScheduleField({ initial }: { initial: readonly ScheduleRow[] }) {
  const id = useId();
  const [rows, setRows] = useState(() =>
    initial.map((row, index) => ({ ...row, key: `row${index}` })),
  );
  const nameOf = (index: number) => `Row ${index + 1}`;
  const set = (key: string, part: keyof ScheduleRow, value: string) =>
    setRows((before) =>
      before.map((row) => (row.key === key ? { ...row, [part]: value } : row)),
    );
  const boxes = [
    ["what", "What", "Iftar"],
    ["when", "When", "Every night at Maghrib"],
    ["where", "Where (optional)", "Musallah"],
  ] as const;
  return (
    <fieldset className="page-list">
      <legend>Schedule</legend>
      <input
        type="hidden"
        name="schedule"
        value={JSON.stringify(
          rows.map(({ what, when, where }) => ({ what, when, where })),
        )}
      />
      {rows.length ? (
        <SortableList
          items={rows}
          itemKey={(row) => row.key}
          itemName={(_, index) => nameOf(index)}
          onReorder={setRows}
          label="Schedule"
          look="cards"
        >
          {(row, index) => (
            <div className="page-list-item">
              <p className="page-list-name">{nameOf(index)}</p>
              <div className="form-grid compact">
                {boxes.map(([part, label, example]) => {
                  const box = `${id}-${row.key}-${part}`;
                  return (
                    <div className="form-field" key={part}>
                      <label htmlFor={box}>{label}</label>
                      <input
                        id={box}
                        maxLength={120}
                        placeholder={example}
                        value={row[part]}
                        onChange={(event) =>
                          set(row.key, part, event.currentTarget.value)
                        }
                      />
                      <FieldError
                        name={`schedule.${index}.${part}`}
                        controls={[box]}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="admin-actions">
                <button
                  type="button"
                  className="button-secondary"
                  aria-label={`${words.remove}: ${nameOf(index)}`}
                  onClick={() =>
                    setRows((before) =>
                      before.filter((other) => other.key !== row.key),
                    )
                  }
                >
                  {words.remove}
                </button>
              </div>
            </div>
          )}
        </SortableList>
      ) : (
        <p className="muted">{words.emptyList}</p>
      )}
      <FieldError name="schedule" controls={[`${id}-add`]} />
      {rows.length < SCHEDULE_ROWS_MAX ? (
        <div>
          <button
            id={`${id}-add`}
            type="button"
            className="button-secondary"
            onClick={() =>
              setRows((before) => [
                ...before,
                keyed({ what: "", when: "", where: "" }),
              ])
            }
          >
            {words.add("row")}
          </button>
        </div>
      ) : null}
    </fieldset>
  );
}

/**
 * A season's public page (PR5c, D-8, D-26): whether it has one, its
 * address, the introduction, the schedule, the sign-up form and the photos.
 * Any board member edits it, like the season.
 */
export function SeasonPageFields({
  values,
  path,
  formChoices,
  onShrinking,
}: {
  /** The form's starting values (stored, or typed after a refused save). */
  values: Partial<Record<string, string>>;
  /** The page's address, or null before the first save. */
  path: string | null;
  /** The sign-up forms list: key and name. */
  formChoices: readonly (readonly [key: string, label: string])[];
  onShrinking: (shrinking: boolean) => void;
}) {
  return (
    <fieldset>
      <legend>Public page</legend>
      <label className="check-label">
        <input
          type="checkbox"
          name="has_page"
          defaultChecked={values.has_page === "on"}
        />
        Give this season its own page on the website
      </label>
      <p className="muted">
        {path ? (
          <>
            Its address: <code>{path}</code>. The page stays up all year;
            outside the season it says when the next one is expected to start.
          </>
        ) : (
          "Its address is made when you first save. The page stays up all year; outside the season it says when the next one is expected to start."
        )}
      </p>
      <label>
        Introduction (optional)
        <span className="muted">Leave an empty line between paragraphs.</span>
        <textarea
          name="intro"
          rows={4}
          maxLength={2000}
          placeholder="A month of worship, community and service at SGU."
          defaultValue={values.intro}
        />
        <FieldError name="intro" />
      </label>
      <ScheduleField initial={scheduleRows(values.schedule)} />
      <label>
        Sign-up form (optional)
        <span className="muted">
          Its button shows near the top. Open, close or change the form in Pages
          → Sign-up forms.
        </span>
        <select name="sign_up_form" defaultValue={values.sign_up_form ?? ""}>
          <option value="">No sign-up form</option>
          {formChoices.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <FieldError name="sign_up_form" />
      </label>
      <PhotoListField
        name="photos"
        label={`Photos (optional, up to ${SEASON_PHOTOS_MAX})`}
        initial={photoRows(values.photos)}
        max={SEASON_PHOTOS_MAX}
        example="Students sharing iftar in the Musallah"
        onShrinking={onShrinking}
      />
    </fieldset>
  );
}
