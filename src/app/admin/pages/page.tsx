import Link from "next/link";
import { listActivity } from "@/lib/backend/admin-content";
import { requirePageEditor } from "@/lib/backend/server";
import {
  activityTime,
  actorLabel,
  type ActivityEntry,
} from "@/lib/community/activity";
import { pageFields } from "@/lib/content/page-fields";
import { AdminHeader } from "@/features/admin/AdminHeader";
import { systemText } from "@/lib/system-text";
import {
  pagesListed,
  verseScreenPath,
} from "@/features/admin/pages/pages-list";
import { boardPage } from "@/features/admin/page-state/board-page";

/**
 * Pages (PR5b, D-6): every page whose text the board edits, with who saved
 * it last and when (from Recent changes). Words shown only inside other
 * pages (Jumu'ah, Musallah directions, Newsletter archive) are edited on
 * those pages, so they are not listed (shared text, option A, 2026-10-06).
 */
async function PagesList() {
  await requirePageEditor();
  const log = await listActivity({ area: "page_texts", limit: 50 });
  const last = new Map<string, ActivityEntry>();
  for (const entry of log.entries)
    if (!last.has(entry.record_id)) last.set(entry.record_id, entry);
  return (
    <div className="admin-shell">
      <AdminHeader title="Pages" />
      <p className="muted">
        The words and photos on each page of the website. Boxes marked
        “(optional)” can stay empty: that part of the page is then hidden.
        Events, announcements, prayer times and people have their own screens.
      </p>
      <div className="content-grid">
        {[
          ...pagesListed.map((key) => ({
            key,
            href: `/admin/pages/${key}`,
            title: pageFields[key].title,
          })),
          // The verse library and "Verse on each page" (PR5b WP7).
          {
            key: "reminder-places" as const,
            href: verseScreenPath,
            title: systemText.versePicker.title,
          },
        ].map(({ key, href, title }) => {
          const saved = last.get(key);
          return (
            <Link
              key={key}
              className="content-card interactive-card"
              href={href}
            >
              <h2>{title}</h2>
              <p>{pageFields[key].summary}</p>
              <p className="muted">
                {saved
                  ? `Last saved by ${actorLabel(saved)} on ${activityTime(saved.occurred_at)}.`
                  : log.unavailable
                    ? "When it was last saved could not be loaded."
                    : "Starter text, not changed yet."}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default boardPage(PagesList);
