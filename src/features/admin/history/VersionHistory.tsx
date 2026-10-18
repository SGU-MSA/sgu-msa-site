import type { ReactNode } from "react";
import {
  activityTime,
  historyList,
  type ActivityEntry,
  type HistoryVersion,
} from "@/lib/community/activity";
import { systemText } from "@/lib/system-text";
import type { EditorState } from "../actions";
import { ActivityFeed } from "../ActivityFeed";
import { RestoreVersion } from "./RestoreVersion";

type FormAction = (state: EditorState, form: FormData) => Promise<EditorState>;

/**
 * A version as Restore would bring it back (`show`), or why it cannot come
 * back (`refused`, the restore's own refusal): Restore is then not offered.
 */
export type VersionPreview = { show: ReactNode } | { refused: string };

const words = systemText.history;

/** History lists this many changes first, then "Show more" (review fixes P1, item 7). */
export const historyShownFirst = 5;

// History entries name no People entry or group.
const noNames: ReadonlyMap<string, string> = new Map();

/**
 * One item's History (review 3 D; page text D-12, prayer ADR 0013): its last
 * `length` changes from the add-only log, newest first, each with Restore,
 * which puts back the version from before that change after a confirmation
 * that names the item (`item`), when that version was saved, how many
 * changes it replaces, and shows it (`preview`). Every History screen is
 * this component, so they all say the same.
 */
export function VersionHistory({
  id,
  item,
  length,
  entries,
  unavailable,
  empty,
  action,
  fields,
  preview,
  note,
}: {
  /** The heading's id. */
  id: string;
  /** How the confirmation names the item (`systemText.history.pageItem`). */
  item: string;
  length: number;
  /** The item's log entries, newest first, one more than `length` asked for (`historyList`). */
  entries: readonly ActivityEntry[];
  unavailable: boolean;
  /** Shown when the item has no logged change yet. */
  empty: string;
  action: FormAction;
  /** The restore form's fields for a version: the entry and the version on screen. */
  fields: (version: HistoryVersion) => Record<string, string>;
  /** The version before an entry as it would come back, or why it cannot. */
  preview: (entry: ActivityEntry) => VersionPreview;
  /** More about what Restore here changes, under the intro. */
  note?: ReactNode;
}) {
  const { shown, versions } = historyList(entries, length);
  const versionOf = new Map(
    versions.flatMap((version) =>
      version ? [[version.entryId, version]] : [],
    ),
  );
  return (
    <section className="content-card" aria-labelledby={id}>
      <h2 id={id}>{words.heading}</h2>
      {note}
      {unavailable ? (
        <p role="alert" className="form-error">
          {words.notLoaded}
        </p>
      ) : shown.length ? (
        <ActivityFeed
          collapseAfter={historyShownFirst}
          // Every entry here is about this item: no highlight needed.
          entries={shown.map((entry) => ({ ...entry, highlight: false }))}
          names={noNames}
          actions={(entry) => {
            const version = versionOf.get(entry.id);
            if (!version) return null;
            const shown = preview(entry);
            return (
              <RestoreVersion
                action={action}
                fields={fields(version)}
                message={words.confirm(
                  item,
                  activityTime(version.savedAt),
                  version.replaces,
                )}
                itemName={words.changedAt(activityTime(entry.occurred_at))}
                {...("refused" in shown
                  ? { refused: shown.refused }
                  : { preview: shown.show })}
              />
            );
          }}
        />
      ) : (
        <p className="muted">{empty}</p>
      )}
    </section>
  );
}
