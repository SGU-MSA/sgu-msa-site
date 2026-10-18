import type { ReactNode } from "react";
import type { EditorState } from "@/features/admin/actions";
import { ArchiveActions, type ArchiveActionsProps } from "./ArchiveActions";

/**
 * An archived item's own page (ADR 0013): read-only until restored (D-20),
 * with the shared archive actions: Restore for any admin and, where it
 * exists, Delete permanently, typed DELETE, for "manage people" holders
 * (D-6). Never Archive. The database decides.
 */
export function ArchivedEntry<R extends EditorState = EditorState>({
  heading,
  badges = [],
  more,
  details = [],
  intro,
  target,
  restore,
  purge,
  children,
}: {
  heading: string;
  /** Labels beside "Archived" (a fund's category). */
  badges?: readonly string[];
  /** Lines about the item above the intro (a fund's description). */
  more?: ReactNode;
  /** What the entry held, as label and value. */
  details?: readonly (readonly [string, string])[];
  intro: string;
  /** Hidden fields naming the entry and the version on screen. */
  target: Record<string, string>;
  restore: ArchiveActionsProps<EditorState, R>["restore"];
  purge?: ArchiveActionsProps["purge"];
  /** Other controls an archived entry allows (a photo removal). */
  children?: ReactNode;
}) {
  return (
    <ArchiveActions
      archived
      fields={target}
      restore={restore}
      purge={purge}
      entry={{
        labelledBy: "archived-entry",
        content: (
          <>
            <p className="admin-badges">
              <span className="admin-badge">Archived</span>
              {badges.map((badge) => (
                <span key={badge} className="admin-badge">
                  {badge}
                </span>
              ))}
            </p>
            <h2 id="archived-entry">{heading}</h2>
            {more}
            <p>{intro}</p>
            {details.length ? (
              <dl className="activity-fields">
                {details.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value || "(empty)"}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </>
        ),
        between: children,
      }}
    />
  );
}
