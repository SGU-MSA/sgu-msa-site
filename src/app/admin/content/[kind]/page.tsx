import Link from "next/link";
import { notFound } from "next/navigation";
import { listAdminRecords } from "@/lib/backend/admin-content";
import { requireAdmin } from "@/lib/backend/server";
import {
  collectionSchema,
  currentUrgentNotices,
  isUpcoming,
} from "@/lib/community/schema";
import { clock } from "@/lib/runtime/providers";
import { longDateLabel } from "@/lib/time/date-label";
import {
  purgeRecordAction,
  restoreRecordAction,
} from "@/features/admin/actions";
import { AdminHeader } from "@/features/admin/AdminHeader";
import { ArchivedRow } from "@/features/admin/ArchiveActions";
import { FileCleanup } from "@/features/admin/RecordActions";
import { ViewTabs } from "@/features/admin/ViewTabs";
import { collectionLabels, leftFiles, listView } from "@/features/admin/fields";
import { boardPage } from "@/features/admin/page-state/board-page";

async function ContentList({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdmin();
  const kind = collectionSchema.safeParse((await params).kind);
  if (!kind.success) notFound();
  const query = await searchParams;
  const view = listView(query.view);
  const archived = view === "archived";
  const now = clock().now();
  const { records: data, unavailable: error } = await listAdminRecords(
    kind.data,
    view,
  );
  const label = collectionLabels[kind.data];
  return (
    <div className="admin-shell">
      <AdminHeader title={label} />
      {query.archived ? (
        <p role="status" className="success-message">
          Archived. It is off the website; find it under Archived.
        </p>
      ) : null}
      {query.restored ? (
        <p role="status" className="success-message">
          Restored as an unpublished draft. Check it, then publish it again when
          it is ready.
        </p>
      ) : null}
      {query.deleted ? (
        <p role="status" className="success-message">
          Permanently deleted.
        </p>
      ) : null}
      <FileCleanup files={leftFiles(query.file)} />
      <ViewTabs
        href={`/admin/content/${kind.data}`}
        view={view}
        label={label}
      />
      {archived ? (
        <p className="muted">
          Archived items are off the website and cannot be edited. Restore one
          to bring it back as an unpublished draft.
        </p>
      ) : (
        <Link
          className="button-primary"
          href={`/admin/content/${kind.data}/new`}
        >
          Create new
        </Link>
      )}
      {!error && !archived && kind.data === "announcements" ? (
        // How many urgent notices visitors see now; they take turns (D-16).
        <p className="muted">
          <strong>
            Urgent now: {currentUrgentNotices(data ?? [], now).length}
          </strong>
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="content-card">
          Content could not be loaded. Check your connection and reload.
        </p>
      ) : (
        <ul className="admin-list">
          {data?.map((row) =>
            archived ? (
              <ArchivedRow
                key={row.id}
                name={row.title}
                view={`/admin/content/${kind.data}/${row.id}`}
                fields={{
                  collection: kind.data,
                  id: row.id,
                  version: row.updated_at ?? "",
                }}
                restore={{ action: restoreRecordAction }}
                purge={{
                  action: purgeRecordAction,
                  allowed: admin.canManagePeople,
                  note: "Its image or PDF is deleted too, unless another item uses it.",
                }}
              >
                <p className="muted">
                  {row.date ? `${longDateLabel(row.date)} · ` : ""}Archived
                </p>
              </ArchivedRow>
            ) : (
              <li key={row.id}>
                <div>
                  <h2>{row.title}</h2>
                  <p className="muted">
                    {row.date ? `${longDateLabel(row.date)} · ` : ""}
                    {row.published ? "Published" : "Draft"}
                    {kind.data === "events" && !isUpcoming(row, now)
                      ? " · Past event"
                      : ""}
                  </p>
                </div>
                <Link
                  className="button-secondary"
                  href={`/admin/content/${kind.data}/${row.id}`}
                >
                  Edit
                  <span className="sr-only"> {row.title}</span>
                </Link>
              </li>
            ),
          )}
        </ul>
      )}
      {!error && !data?.length ? (
        <p className="content-card">
          {archived
            ? "Nothing is archived."
            : "Nothing here yet. Create your first item when the information is ready."}
        </p>
      ) : null}
    </div>
  );
}

export default boardPage(ContentList);
