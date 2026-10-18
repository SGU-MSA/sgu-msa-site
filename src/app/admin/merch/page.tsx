import Link from "next/link";
import { requireAdmin } from "@/lib/backend/server";
import { AdminHeader } from "@/features/admin/AdminHeader";
import { OrderedList } from "@/features/admin/OrderedList";
import { ArchivedRow } from "@/features/admin/ArchiveActions";
import { ViewTabs } from "@/features/admin/ViewTabs";
import { listView } from "@/features/admin/fields";
import { restoreCollectionAction } from "@/features/admin/merch/merch-actions";
import { merchScreen } from "@/features/admin/merch/merch-screen";
import { boardPage } from "@/features/admin/page-state/board-page";
import { systemText } from "@/lib/system-text";

const notices: Record<string, string> = {
  archived: "Collection archived. Find it under Archived.",
  restored: "Collection restored.",
};

/**
 * Merch (PR5c, D-9, D-27; any board member): the collections in the order
 * the Merch page shows them (drag to reorder), each with its items; the
 * current one leads the page. Each size of an item is its own Go2Pay
 * product, made by hand in Go2Pay.
 */
async function MerchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [query, admin, screen] = await Promise.all([
    searchParams,
    requireAdmin(),
    merchScreen(),
  ]);
  const view = listView(query.view);
  const archived = view === "archived";
  const notice = Object.keys(notices).find((key) => query[key]);
  const itemCount = (id: string) => {
    const count = screen.items.filter(
      (item) => item.collection_id === id,
    ).length;
    return `${count} ${count === 1 ? "item" : "items"}`;
  };
  return (
    <div className="admin-shell">
      <AdminHeader title="Merch" />
      {notice ? (
        <p role="status" className="success-message">
          {notices[notice]}
        </p>
      ) : null}
      <ViewTabs href="/admin/merch" view={view} label="Collections" />
      {archived ? (
        <p className="muted">
          Archived collections are off the Merch page. Restore one to show it
          again.
        </p>
      ) : (
        <>
          <p className="muted">
            Collections show on the Merch page in this order; the first one on
            sale leads the page. Each size of an item is its own Go2Pay product,
            which you make by hand in Go2Pay. Any board member can edit merch.
          </p>
          <div className="admin-actions">
            <Link
              className="button-primary"
              href="/admin/merch/collections/new"
            >
              Add a collection
            </Link>
            {admin.canEditPages ? (
              <Link className="button-secondary" href="/admin/pages/merch">
                Page opening
              </Link>
            ) : null}
            <a
              className="button-secondary"
              href="/merch"
              target="_blank"
              rel="noopener"
            >
              Open the Merch page ↗
            </a>
          </div>
        </>
      )}
      {screen.unavailable ? (
        <p role="alert" className="content-card">
          Merch could not be loaded. Check your connection and reload.
        </p>
      ) : archived ? (
        screen.archivedCollections.length ? (
          <ul className="admin-list">
            {screen.archivedCollections.map((collection) => (
              <ArchivedRow
                key={collection.id}
                name={collection.name}
                view={`/admin/merch/collections/${collection.id}`}
                fields={{ id: collection.id, version: collection.updated_at }}
                restore={{ action: restoreCollectionAction }}
              />
            ))}
          </ul>
        ) : (
          <p className="content-card">Nothing is archived.</p>
        )
      ) : screen.collections.length ? (
        <>
          <p className="muted">{systemText.order.hint}</p>
          <OrderedList
            list="merch_collections"
            label="Collections"
            rows={screen.collections.map((collection) => ({
              id: collection.id,
              version: collection.updated_at,
              name: collection.name,
              content: (
                <div className="order-row">
                  <div>
                    <h3>{collection.name}</h3>
                    <p className="admin-badges">
                      <span className="admin-badge">
                        {collection.era === "current"
                          ? "On sale now"
                          : "Not for sale"}
                      </span>
                    </p>
                    <p className="muted">{itemCount(collection.id)}</p>
                  </div>
                  <Link
                    className="button-secondary"
                    href={`/admin/merch/collections/${collection.id}`}
                  >
                    Edit<span className="sr-only"> {collection.name}</span>
                  </Link>
                </div>
              ),
            }))}
          />
        </>
      ) : (
        <p className="content-card">No collections yet.</p>
      )}
    </div>
  );
}

export default boardPage(MerchPage);
