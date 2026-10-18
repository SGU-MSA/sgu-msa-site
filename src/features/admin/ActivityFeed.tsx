import type { ReactNode } from "react";
import {
  activityTime,
  actorLabel,
  describeChange,
  hiddenDifference,
  shownLength,
  shownText as shown,
  type ActivityEntry,
  type ActivityNames,
  type ChangedField,
} from "@/lib/community/activity";
import { systemText } from "@/lib/system-text";
import { CollapsedList } from "./history/CollapsedList";

const { history } = systemText;

const hiddenDifferences = {
  spacing: "changed (spaces or line breaks only)",
  beyond: `changed (after the first ${shownLength} characters)`,
};

function Change({ field }: { field: ChangedField }) {
  // Personal values are never kept, only that they changed (D-4, D-5).
  if (field.hidden) return <>changed</>;
  if (field.before === null) return <>{shown(field.after ?? "")}</>;
  if (field.after === null)
    return (
      <>
        <span className="sr-only">was </span>
        {shown(field.before)}
      </>
    );
  const unseen = hiddenDifference(field.before, field.after);
  if (unseen) return <>{hiddenDifferences[unseen]}</>;
  return (
    <>
      {shown(field.before)} <span aria-hidden="true">→</span>
      <span className="sr-only">changed to</span> {shown(field.after)}
    </>
  );
}

/**
 * The label on a highlighted entry: prayer changes (PR3 WP-E), urgent
 * notices (PR5a D-17), and (PR6 D-18) a new Go2Pay link, a fund's category
 * lock and a season's days: the only rows the database highlights.
 */
const highlightLabels: Record<string, string> = {
  announcements: "Urgent notice",
  payment_item_links: "Go2Pay link",
  payment_items: "Category locked",
  seasons: "Season days",
};
const highlightLabel = (area: string) =>
  highlightLabels[area] ?? "Prayer change";

/**
 * Recent changes, newest first: when (Grenada time), who, what, and before →
 * after per field. Prayer changes and urgent notices are highlighted.
 */
export function ActivityFeed({
  entries,
  names,
  actions,
  collapseAfter,
}: {
  entries: readonly ActivityEntry[];
  names: ActivityNames;
  /** Controls under an entry (History: Restore). */
  actions?: (entry: ActivityEntry) => ReactNode;
  /** Show this many entries first, and "Show more" for the rest (History). */
  collapseAfter?: number;
}) {
  const items = entries.map((entry) => {
    const { label, subject, fields, restoredFrom } = describeChange(
      entry,
      names,
    );
    return (
      <li
        key={entry.id}
        className={entry.highlight ? "activity-highlight" : undefined}
      >
        <div>
          {entry.highlight ? (
            <p className="admin-badges">
              <span className="admin-badge">{highlightLabel(entry.area)}</span>
            </p>
          ) : null}
          <h2>
            {label}
            {subject ? `: ${subject}` : ""}
          </h2>
          <p className="muted">
            <time dateTime={entry.occurred_at}>
              {activityTime(entry.occurred_at)}
            </time>{" "}
            · {actorLabel(entry)}
          </p>
          {restoredFrom ? (
            // A History restore (review 3 D) names the version it put back.
            <p className="activity-restored">
              {history.restoredTo(activityTime(restoredFrom))}
            </p>
          ) : null}
          {fields.length ? (
            <dl className="activity-fields">
              {fields.map((field) => (
                <div key={field.name}>
                  <dt>{field.name}</dt>
                  <dd>
                    <Change field={field} />
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          {actions?.(entry)}
        </div>
      </li>
    );
  });
  const className = "admin-list activity-feed";
  return collapseAfter === undefined ? (
    <ol className={className}>{items}</ol>
  ) : (
    <CollapsedList items={items} shown={collapseAfter} className={className} />
  );
}
