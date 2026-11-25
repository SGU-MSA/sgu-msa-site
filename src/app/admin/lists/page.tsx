import { requireAdmin } from "@/lib/backend/server";
import { listWords } from "@/lib/community/lists";
import { loadLists } from "@/features/admin/lists-data";
import { AdminHeader } from "@/features/admin/AdminHeader";
import { AppearsOn } from "@/features/admin/AppearsOn";
import { ListsEditor } from "@/features/admin/ListsEditor";
import { boardPage } from "@/features/admin/page-state/board-page";

/**
 * Lists (review fixes P3, the approved plan of 2026-10-07; any board
 * member): the event categories, terms and resource categories that the
 * event form, Pages → Resources and the public filters use. What uses each
 * option is counted here: events archived or not, and every resource on the
 * Resources page (archived ones too), as the database's guard counts them.
 */
async function ListsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const { lists, unavailable } = await loadLists();
  return (
    <div className="admin-shell narrow">
      <AdminHeader title="Lists" />
      <AppearsOn area="lists" />
      {query.deleted ? (
        <p role="status" className="success-message">
          {listWords.deleted}
        </p>
      ) : null}
      {unavailable ? (
        <p role="alert" className="content-card">
          {listWords.unavailable}
        </p>
      ) : (
        <ListsEditor lists={lists} />
      )}
    </div>
  );
}

export default boardPage(ListsPage);
