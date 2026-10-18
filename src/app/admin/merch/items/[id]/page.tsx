import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "@/lib/validation/zod";
import { productLabel } from "@/lib/community/payment-policy";
import { AdminHeader } from "@/features/admin/AdminHeader";
import { OrderedList } from "@/features/admin/OrderedList";
import { ArchivedRow } from "@/features/admin/ArchiveActions";
import {
  MerchItemEditor,
  type EditableMerchItem,
} from "@/features/admin/merch/MerchItemEditor";
import { ArchivedEntry } from "@/features/admin/ArchivedEntry";
import { restoreMerchItemAction } from "@/features/admin/merch/merch-actions";
import { merchScreen } from "@/features/admin/merch/merch-screen";
import { restorePaymentItemAction } from "@/features/admin/payment-actions";
import { windowWords } from "@/features/admin/payment-words";
import { boardPage } from "@/features/admin/page-state/board-page";
import { systemText } from "@/lib/system-text";
import { AppearsOn } from "@/features/admin/AppearsOn";

const notices: Record<string, string> = {
  archived: "Size archived. Find it under “Archived sizes” below.",
  restored: "Size restored.",
};

/**
 * Add or edit a merch item (PR5c, D-27; any board member): its words and
 * photos, then its sizes in the order of their buttons (drag to reorder),
 * each its own Go2Pay product.
 */
async function ItemPage({
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
        <AdminHeader
          title="Item"
          parents={[{ label: "Merch", href: "/admin/merch" }]}
        />
        <p role="alert" className="content-card">
          This page could not be loaded. Check your connection and reload.
        </p>
      </div>
    );
  const row = isNew
    ? null
    : ([...screen.items, ...screen.archivedItems].find(
        (item) => item.id === id,
      ) ?? null);
  const collectionId =
    row?.collection_id ??
    (typeof query.collection === "string" ? query.collection : "");
  const collection = screen.collections.find(
    (other) => other.id === collectionId,
  );
  if ((!isNew && !row) || !collection) notFound();
  const parents = [
    { label: "Merch", href: "/admin/merch" },
    {
      label: collection.name,
      href: `/admin/merch/collections/${collection.id}`,
    },
  ];
  if (row?.archived_at)
    return (
      <div className="admin-shell narrow">
        <AdminHeader
          title={`Archived · ${row.name}`}
          parents={parents}
          current={row.name}
        />
        <ArchivedEntry
          heading={row.name}
          intro="This item is not on the Merch page and cannot be edited. Restore it to edit it again."
          target={{
            id: row.id,
            version: row.updated_at,
            collection_id: collection.id,
          }}
          restore={{ action: restoreMerchItemAction }}
        />
      </div>
    );
  const editable: EditableMerchItem = {
    id: row?.id ?? crypto.randomUUID(),
    collection_id: collection.id,
    name: row?.name ?? "",
    description: row?.description ?? "",
    garment: row?.garment ?? "",
    colorway: row?.colorway ?? "",
    photos: JSON.stringify(row?.photos ?? []),
    position: String(row?.position ?? screen.nextItemPosition(collection.id)),
    version: row?.updated_at ?? null,
  };
  const sizes = row ? screen.sizesOf(row.id) : [];
  const current = sizes.filter((size) => !size.archived_at);
  const archived = sizes.filter((size) => size.archived_at);
  const notice = Object.keys(notices).find((key) => query[key]);
  const title = row ? row.name : "Add an item";
  const view = screen.viewOf(collection.id) ?? {
    ...collection,
    items: [],
  };
  return (
    <div className="admin-shell">
      <AdminHeader title={title} parents={parents} current={title} />
      <AppearsOn area="merch" />
      {notice ? (
        <p role="status" className="success-message">
          {notices[notice]}
        </p>
      ) : null}
      <MerchItemEditor item={editable} collection={view} page={screen.page} />
      {row ? (
        <section className="content-card" aria-labelledby="item-sizes">
          <h2 id="item-sizes">Sizes</h2>
          <p className="muted">
            Each size is its own Go2Pay product with its own price and stock,
            which you make by hand in Go2Pay. The Merch page shows “See price
            and buy ↗” and a button for each size on sale, in this order.
          </p>
          {current.length ? (
            <>
              <p className="muted">{systemText.order.hint}</p>
              <OrderedList
                list="payment_items"
                label={`Sizes of ${row.name}`}
                rows={current.map((size) => {
                  const link = screen.giving.linkOf(size.id);
                  return {
                    id: size.id,
                    version: size.updated_at,
                    name: `Size ${size.size_label}`,
                    content: (
                      <div className="order-row">
                        <div>
                          <h3>{size.size_label}</h3>
                          <p className="admin-badges">
                            <span className="admin-badge">
                              {size.listed ? "On sale" : "Not shown"}
                            </span>
                          </p>
                          <p className="muted">
                            {[
                              windowWords(screen.giving.windowOf(size)),
                              link
                                ? `Opens ${productLabel(link.go2pay_product_id)}`
                                : "No Go2Pay page yet",
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        <Link
                          className="button-secondary"
                          href={`/admin/merch/sizes/${size.id}?item=${row.id}`}
                        >
                          Edit
                          <span className="sr-only">
                            {" "}
                            size {size.size_label}
                          </span>
                        </Link>
                      </div>
                    ),
                  };
                })}
              />
            </>
          ) : (
            <p>No sizes yet.</p>
          )}
          <div className="admin-actions">
            <Link
              className="button-primary"
              href={`/admin/merch/sizes/new?item=${row.id}`}
            >
              Add a size
            </Link>
          </div>
          {archived.length ? (
            <details>
              <summary>Archived sizes ({archived.length})</summary>
              <ul className="admin-list">
                {archived.map((size) => (
                  <ArchivedRow
                    key={size.id}
                    name={size.size_label}
                    heading="h3"
                    itemName={`size ${size.size_label}`}
                    view={`/admin/merch/sizes/${size.id}?item=${row.id}`}
                    fields={{
                      id: size.id,
                      version: size.updated_at,
                      kind: "priced",
                      merch_item_id: row.id,
                    }}
                    restore={{ action: restorePaymentItemAction }}
                  />
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ) : (
        <p className="muted">Save the item first, then add its sizes.</p>
      )}
    </div>
  );
}

export default boardPage(ItemPage);
