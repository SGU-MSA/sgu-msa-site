import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "@/lib/validation/zod";
import { AdminHeader } from "@/features/admin/AdminHeader";
import { OrderedList } from "@/features/admin/OrderedList";
import { ArchivedRow } from "@/features/admin/ArchiveActions";
import {
  MerchCollectionEditor,
  type EditableCollection,
} from "@/features/admin/merch/MerchCollectionEditor";
import { ArchivedEntry } from "@/features/admin/ArchivedEntry";
import {
  restoreCollectionAction,
  restoreMerchItemAction,
} from "@/features/admin/merch/merch-actions";
import { merchScreen } from "@/features/admin/merch/merch-screen";
import { boardPage } from "@/features/admin/page-state/board-page";
import { systemText } from "@/lib/system-text";
import { AppearsOn } from "@/features/admin/AppearsOn";

const parents = [{ label: "Merch", href: "/admin/merch" }];
const notices: Record<string, string> = {
  archived: "Item archived. Find it under “Archived items” below.",
  restored: "Item restored.",
};

/**
 * Add or edit a merch collection (PR5c; any board member), with its items in
 * the order the Merch page shows them (drag to reorder).
 */
async function CollectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query, screen] = await Promise.all([
    params,
    searchParams,
    merchScreen(),
  ]);
  const isNew = id === "new";
  if (!isNew && !z.uuid().safeParse(id).success) notFound();
  if (screen.unavailable)
    return (
      <div className="admin-shell narrow">
        <AdminHeader title="Collection" parents={parents} />
        <p role="alert" className="content-card">
          This page could not be loaded. Check your connection and reload.
        </p>
      </div>
    );
  const row = isNew
    ? null
    : (screen.collections.find((collection) => collection.id === id) ?? null);
  const gone = isNew
    ? null
    : (screen.archivedCollections.find((collection) => collection.id === id) ??
      null);
  if (!isNew && !row && !gone) notFound();
  if (gone)
    return (
      <div className="admin-shell narrow">
        <AdminHeader
          title={`Archived · ${gone.name}`}
          parents={parents}
          current={gone.name}
        />
        <ArchivedEntry
          heading={gone.name}
          intro="This collection is not on the Merch page and cannot be edited. Restore it to edit it again."
          target={{ id: gone.id, version: gone.updated_at }}
          restore={{ action: restoreCollectionAction }}
        />
      </div>
    );
  const editable: EditableCollection = {
    id: row?.id ?? crypto.randomUUID(),
    name: row?.name ?? "",
    arabic: row?.arabic ?? "",
    quote: row?.quote ?? "",
    year: row?.year ?? "",
    description: row?.description ?? "",
    era: row?.era ?? "",
    position: String(row?.position ?? screen.nextCollectionPosition()),
    version: row?.updated_at ?? null,
  };
  const items = row
    ? screen.items.filter((item) => item.collection_id === row.id)
    : [];
  const archivedItems = row
    ? screen.archivedItems.filter((item) => item.collection_id === row.id)
    : [];
  const notice = Object.keys(notices).find((key) => query[key]);
  const title = row ? row.name : "Add a collection";
  return (
    <div className="admin-shell">
      <AdminHeader title={title} parents={parents} current={title} />
      <AppearsOn area="merch" />
      {notice ? (
        <p role="status" className="success-message">
          {notices[notice]}
        </p>
      ) : null}
      <MerchCollectionEditor
        collection={editable}
        items={screen.viewOf(editable.id)?.items ?? []}
        page={screen.page}
      />
      {row ? (
        <section className="content-card" aria-labelledby="collection-items">
          <h2 id="collection-items">Items</h2>
          <p className="muted">
            The Merch page shows them in this order. Open an item to change its
            photos and sizes.
          </p>
          {items.length ? (
            <>
              <p className="muted">{systemText.order.hint}</p>
              <OrderedList
                list="merch_items"
                label={`Items in ${row.name}`}
                rows={items.map((item) => ({
                  id: item.id,
                  version: item.updated_at,
                  name: item.name,
                  content: (
                    <div className="order-row">
                      <div>
                        <h3>{item.name}</h3>
                        <p className="muted">
                          {item.photos.length}{" "}
                          {item.photos.length === 1 ? "photo" : "photos"} ·{" "}
                          {screen
                            .sizesOf(item.id)
                            .filter((size) => !size.archived_at)
                            .map((size) => size.size_label)
                            .join(", ") || "no sizes yet"}
                        </p>
                      </div>
                      <Link
                        className="button-secondary"
                        href={`/admin/merch/items/${item.id}`}
                      >
                        Edit<span className="sr-only"> {item.name}</span>
                      </Link>
                    </div>
                  ),
                }))}
              />
            </>
          ) : (
            <p>No items yet.</p>
          )}
          <div className="admin-actions">
            <Link
              className="button-primary"
              href={`/admin/merch/items/new?collection=${row.id}`}
            >
              Add an item
            </Link>
          </div>
          {archivedItems.length ? (
            <details>
              <summary>Archived items ({archivedItems.length})</summary>
              <ul className="admin-list">
                {archivedItems.map((item) => (
                  <ArchivedRow
                    key={item.id}
                    name={item.name}
                    heading="h3"
                    view={`/admin/merch/items/${item.id}`}
                    fields={{
                      id: item.id,
                      version: item.updated_at,
                      collection_id: row.id,
                    }}
                    restore={{ action: restoreMerchItemAction }}
                  />
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

export default boardPage(CollectionPage);
