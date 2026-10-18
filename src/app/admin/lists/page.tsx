import { requireAdmin } from "@/lib/backend/server";
import {
  listAdminListOptions,
  listAdminRecords,
  readAdminPageText,
} from "@/lib/backend/admin-content";
import {
  groupLists,
  listNames,
  listWords,
  type ListName,
} from "@/lib/community/lists";
import { AdminHeader } from "@/features/admin/AdminHeader";
import { AppearsOn } from "@/features/admin/AppearsOn";
import { ListsEditor, type ListRow } from "@/features/admin/ListsEditor";
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
  const [options, events, archivedEvents, resources] = await Promise.all([
    listAdminListOptions(),
    listAdminRecords("events"),
    listAdminRecords("events", "archived"),
    readAdminPageText("resources"),
  ]);
  const unavailable =
    options.unavailable ||
    events.unavailable ||
    archivedEvents.unavailable ||
    !resources;
  const allEvents = [...events.records, ...archivedEvents.records];
  const resourceItems = resources?.document.items ?? [];
  const usedBy = (list: ListName, id: string, slug: string) => {
    const count =
      list === "resource_categories"
        ? resourceItems.filter((item) => item.category === slug).length
        : allEvents.filter((event) =>
            list === "terms" ? event.term_id === id : event.category_id === id,
          ).length;
    if (!count) return null;
    return listWords.usedBy(
      count,
      list === "resource_categories" ? "resource" : "event",
    );
  };
  const grouped = groupLists(options.options);
  const lists = Object.fromEntries(
    listNames.map((list) => [
      list,
      grouped[list].map((option): ListRow => ({
        id: option.id,
        name: option.name,
        version: option.updated_at,
        usedBy: usedBy(list, option.id, option.slug),
      })),
    ]),
  ) as Record<ListName, ListRow[]>;
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
        <ListsEditor
          lists={lists}
          newIds={
            Object.fromEntries(
              listNames.map((list) => [list, crypto.randomUUID()]),
            ) as Record<ListName, string>
          }
        />
      )}
    </div>
  );
}

export default boardPage(ListsPage);
