"use client";
import {
  jumuahSessionName,
  maxJumuahSessions,
  type JumuahSession,
} from "@/lib/prayer/adjustments";
import { jumuahSessionBox } from "@/lib/prayer/congregation";
import { anyTime, laterThan } from "@/lib/time/field-rules";
import { systemText } from "@/lib/system-text";
import { SortableList } from "@/shared/ui/SortableList";
import { TimeField } from "@/shared/ui/TimeField";
import { FieldError } from "./form-check/FieldError";
import { prayerEditorWords as words } from "./fields";

/** One Jumu'ah prayer as typed; `key` stays with it when the list is dragged. */
export type SessionRow = JumuahSession & { key: string };

let nextKey = 0;
/** A new row's key, unique on this page. */
export const sessionKey = () => `session-${nextKey++}`;

/** Stored or posted prayers as rows. */
export const sessionRows = (sessions: readonly JumuahSession[]): SessionRow[] =>
  sessions.map((session) => ({ ...session, key: sessionKey() }));

/**
 * An ordered list of Jumu'ah prayers (review fixes P2): each a khutbah and
 * an iqamah time (the iqamah only after the khutbah), dragged into order by
 * its handle ⠿, removed, or added up to `maxJumuahSessions`. Posted as
 * `<prefix>_<n>_khutbah` and `<prefix>_<n>_iqamah` by place
 * (`postedSessions`). The weekly Jumu'ah and a changed Friday share it; the
 * caller keeps the rows, so what is typed survives a drag or a switch.
 */
export function JumuahSessionsField({
  prefix,
  rows,
  onChange,
  label,
  keepOne = false,
  empty,
  listError,
  newRow,
}: {
  /** The boxes' name prefix: `jumuah`, or a Friday's `exception_<n>_jumuah`. */
  prefix: string;
  rows: readonly SessionRow[];
  onChange: (rows: SessionRow[]) => void;
  /** The list's accessible name. */
  label: string;
  /** A changed Friday keeps at least one prayer ("No Jumu’ah this week" cancels all). */
  keepOne?: boolean;
  /** Shown when the list is empty. */
  empty?: string;
  /** The box key of a refusal about the whole list (the caller may show it elsewhere). */
  listError?: string;
  /** The times a new prayer starts with (empty by default). */
  newRow?: () => JumuahSession;
}) {
  const box = (index: number, part: string) =>
    jumuahSessionBox(prefix, index, part);
  const update = (key: string, change: Partial<JumuahSession>) =>
    onChange(
      rows.map((row) => (row.key === key ? { ...row, ...change } : row)),
    );
  const several = rows.length > 1;
  return (
    <div className="jumuah-sessions">
      {rows.length ? (
        <SortableList
          items={rows}
          itemKey={(row) => row.key}
          itemName={(_, index) => jumuahSessionName(index)}
          onReorder={onChange}
          label={label}
          look="cards"
        >
          {(row, index) => {
            const name = jumuahSessionName(index);
            const which = several ? `${name}: ` : "";
            return (
              <div className="jumuah-session">
                {several ? <p className="page-list-name">{name}</p> : null}
                <div className="form-grid compact">
                  <label>
                    Khutbah
                    <TimeField
                      name={box(index, "khutbah")}
                      label={`${which}Khutbah`}
                      rule={anyTime}
                      defaultValue={row.khutbah}
                      onChange={(khutbah) => update(row.key, { khutbah })}
                    />
                    <FieldError name={box(index, "khutbah")} />
                  </label>
                  <label>
                    Iqamah
                    {/* After the khutbah: earlier times are greyed out. */}
                    <TimeField
                      name={box(index, "iqamah")}
                      label={`${which}Iqamah`}
                      rule={laterThan({ box: box(index, "khutbah") })}
                      defaultValue={row.iqamah}
                      onChange={(iqamah) => update(row.key, { iqamah })}
                    />
                    <FieldError name={box(index, "iqamah")} />
                  </label>
                </div>
                {keepOne && !several ? null : (
                  <div>
                    <button
                      type="button"
                      className="button-secondary"
                      aria-label={`${words.remove}: ${name}`}
                      onClick={() =>
                        onChange(rows.filter((other) => other.key !== row.key))
                      }
                    >
                      {words.remove}
                    </button>
                  </div>
                )}
              </div>
            );
          }}
        </SortableList>
      ) : empty ? (
        <p className="muted">{empty}</p>
      ) : null}
      {several ? <p className="muted">{systemText.order.hint}</p> : null}
      {listError ? <FieldError name={listError} /> : null}
      {rows.length < maxJumuahSessions ? (
        <div>
          <button
            type="button"
            className="button-secondary"
            onClick={() =>
              onChange([
                ...rows,
                {
                  ...(newRow?.() ?? { khutbah: "", iqamah: "" }),
                  key: sessionKey(),
                },
              ])
            }
          >
            {words.add}
          </button>
        </div>
      ) : null}
    </div>
  );
}
