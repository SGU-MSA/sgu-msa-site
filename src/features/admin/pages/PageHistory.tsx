import Link from "next/link";
import {
  pageFields,
  pageSectionTitle,
  restoredPageText,
} from "@/lib/content/page-fields";
import type { PageTextKey } from "@/lib/content/documents";
import { drawnOn, isLayoutKey, sharedTexts } from "@/lib/content/page-layouts";
import type { ActivityEntry } from "@/lib/community/activity";
import { systemText } from "@/lib/system-text";
import { VersionHistory } from "../history/VersionHistory";
import { restorePageTextVersionAction } from "./page-actions";
import type { PreviewLive } from "./preview-live";
import { previewSlots } from "./preview-slots";
import { pageScreenPath } from "./pages-list";
import { PagePreview } from "./previews";

/** How many changes a page's history lists. */
export const pageHistoryLength = 20;

/**
 * Under the History of a page that shows sections of other page texts
 * (dashboard polish, 2026-10-06): each such text, the sections of it this
 * page shows, and a link to its own History. A restore puts back one
 * stored text only, so Restore here never changes their words (the
 * Jumu'ah heading, for one, is on Home too).
 */
function SharedHistories({ pageKey }: { pageKey: PageTextKey }) {
  if (!isLayoutKey(pageKey)) return null;
  const drawn = drawnOn(pageKey);
  return sharedTexts(pageKey).map((text) => {
    const title = pageFields[text].title;
    // Each row once: a section drawn inside another is named by that row.
    const sections = [
      ...new Set(
        drawn
          .filter((ref) => ref.key === text)
          .map((ref) =>
            ref.row
              ? pageSectionTitle(pageKey, ref.row)
              : (pageFields[text].sections.find(
                  (section) => section.id === ref.section,
                )?.title ?? ref.section),
          ),
      ),
    ];
    return (
      <p key={text} className="muted">
        {systemText.history.sharedWords(sections, title)}{" "}
        <Link
          className="text-link"
          href={`${pageScreenPath(text)}#page-history`}
        >
          {systemText.history.sharedLink(title)}
        </Link>
      </p>
    );
  });
}

/**
 * A page's History (D-12; review 3 D): its last changes, each with Restore,
 * which first shows the page as that version would bring it back (the
 * Preview's picture, with today's photos, E-8) and asks, or says why
 * that version cannot come back (checked as the restore checks it).
 */
export function PageHistory({
  pageKey,
  entries,
  unavailable,
  version,
  document,
  live,
  hiddenElsewhere = [],
}: {
  pageKey: PageTextKey;
  /** Read with `limit: pageHistoryLength + 1` (`historyList`). */
  entries: readonly ActivityEntry[];
  unavailable: boolean;
  /** The current text's version: a restore over newer text is refused. */
  version: string;
  /** The current text: a restore keeps its photos. */
  document: unknown;
  /** What the page shows besides its text, for the preview. */
  live: PreviewLive;
  /** Its sections another page hides (review 3 B): not checked, as the restore does not check them. */
  hiddenElsewhere?: readonly string[];
}) {
  return (
    <VersionHistory
      id="page-history"
      item={systemText.history.pageItem(pageFields[pageKey].title)}
      length={pageHistoryLength}
      entries={entries}
      unavailable={unavailable}
      empty="No changes yet."
      note={<SharedHistories pageKey={pageKey} />}
      action={restorePageTextVersionAction}
      fields={(earlier) => ({
        key: pageKey,
        entry: String(earlier.entryId),
        version,
      })}
      preview={(entry) => {
        const restored = restoredPageText(
          pageKey,
          entry.before?.document,
          document,
          hiddenElsewhere,
        );
        return restored.ok
          ? {
              show: (
                <PagePreview
                  document={restored.document}
                  live={live}
                  slots={previewSlots(pageKey)}
                  hidden={new Set(hiddenElsewhere)}
                  focus={null}
                />
              ),
            }
          : {
              refused: systemText.pages.restoreRefused(restored.problem),
            };
      }}
    />
  );
}
