import { listActivity, readAdminPageText } from "@/lib/backend/admin-content";
import { requirePageEditor } from "@/lib/backend/server";
import { activityTime, actorLabel } from "@/lib/community/activity";
import { withEveryField } from "@/lib/content/page-fields";
import { systemText } from "@/lib/system-text";
import { AdminHeader } from "@/features/admin/AdminHeader";
import { AppearsOn } from "@/features/admin/AppearsOn";
import {
  PageHistory,
  pageHistoryLength,
} from "@/features/admin/pages/PageHistory";
import { PageTextEditor } from "@/features/admin/pages/PageTextEditor";
import { previewLive } from "@/features/admin/pages/preview-live";
import { boardPage } from "@/features/admin/page-state/board-page";

const key = "reminder-places";
const words = systemText.versePicker;

/**
 * Qur'an verses (PR5b WP7, D-24; Review 3 E, 2026-10-06): choose the verse
 * each place shows from the fixed verse library ("Verse on each page", page
 * text with Preview and History). The board never types Qur'an text
 * and the library never changes; public pages read only the database.
 */
async function VersesScreen({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePageEditor();
  const query = await searchParams;
  const [data, history, live] = await Promise.all([
    readAdminPageText(key),
    listActivity({
      area: "page_texts",
      recordId: key,
      // One more dates the version before the oldest listed change.
      limit: pageHistoryLength + 1,
    }),
    previewLive(key),
  ]);
  const last = history.entries[0];
  const libraryMissing = live.key === key && live.data.unavailable;
  return (
    <div className="admin-shell narrow">
      <AdminHeader
        title={words.title}
        parents={[{ label: "Pages", href: "/admin/pages" }]}
      />
      <AppearsOn area={`page:${key}`} />
      {query.restored ? (
        <p role="status" className="success-message">
          {systemText.pages.restored}
        </p>
      ) : null}
      <p className="muted">{words.intro}</p>
      {!data ? (
        <p role="alert" className="form-error">
          {systemText.pages.notLoaded}
        </p>
      ) : libraryMissing ? (
        <p role="alert" className="form-error">
          {words.libraryNotLoaded}
        </p>
      ) : (
        <>
          {last ? (
            <p className="muted">
              Last saved by {actorLabel(last)} on{" "}
              {activityTime(last.occurred_at)}.
            </p>
          ) : null}
          <PageTextEditor
            key={data.version}
            pageKey={key}
            document={withEveryField(key, data.document)}
            version={data.version}
            formKeys={[]}
            live={live}
            saveLabel={words.save}
          />
          <p className="muted">{words.footnote}</p>
          <PageHistory
            pageKey={key}
            entries={history.entries}
            unavailable={history.unavailable}
            version={data.version}
            document={data.document}
            live={live}
          />
        </>
      )}
    </div>
  );
}

export default boardPage(VersesScreen);
