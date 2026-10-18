import { notFound } from "next/navigation";
import { z } from "@/lib/validation/zod";
import { CATEGORIES, productLabel } from "@/lib/community/payment-policy";
import type { Kind } from "@/lib/community/payments";
import { AdminHeader } from "./AdminHeader";
import { FundEditor } from "./FundEditor";
import { PricedItemEditor } from "./PricedItemEditor";
import { ArchivedEntry } from "./ArchivedEntry";
import { ticketUsers } from "./event-tickets";
import { restorePaymentItemAction } from "./payment-actions";
import {
  editableItem,
  givingScreen,
  lockedDay,
  receiptNote,
  seasonChoices,
} from "./payment-pages";
import { kindWords } from "./payment-words";
import { AppearsOn } from "./AppearsOn";

/** "Start with the general fund" (contract Board Self-Sufficiency → Empty state). */
const generalStart = { name: "MSA & Musallah", category: "general" } as const;

/**
 * Add or edit one fund or ticket (PR6 WP-6), or restore an archived one.
 * Any board member (D-65). With `merch`, a size of that merch item (PR5c,
 * D-27): a priced item reached from the merch item's screen.
 */
export async function PaymentItemPage({
  kind,
  id,
  start,
  canEditPages,
  merch = null,
}: {
  kind: Kind;
  id: string;
  /** `?start=general` on a new fund. */
  start?: string;
  /** Whether this board member edits Pages (review 3 B): the receipt note is there. */
  canEditPages: boolean;
  /** A merch size's merch item. */
  merch?: { itemId: string; itemName: string } | null;
}) {
  const isNew = id === "new";
  if (!isNew && !z.uuid().safeParse(id).success) notFound();
  const words = merch ? { one: "size", list: "Sizes" } : kindWords[kind];
  const listHref = `/admin/payments/${kind === "fund" ? "funds" : "tickets"}`;
  const parents = merch
    ? [
        { label: "Merch", href: "/admin/merch" },
        { label: merch.itemName, href: `/admin/merch/items/${merch.itemId}` },
      ]
    : [
        { label: "Payments", href: "/admin/payments" },
        { label: words.list, href: listHref },
      ];
  const [screen, note] = await Promise.all([givingScreen(), receiptNote()]);
  if (screen.unavailable)
    return (
      <div className="admin-shell narrow">
        <AdminHeader title={words.list} parents={parents} />
        <p role="alert" className="content-card">
          This page could not be loaded. Check your connection and reload.
        </p>
      </div>
    );
  const row = isNew
    ? null
    : (screen.items.find((item) => item.id === id) ?? null);
  if (!isNew && (!row || row.kind !== kind)) notFound();
  // A size only on its own item's screens; a ticket never there.
  if (row && row.merch_item_id !== (merch?.itemId ?? "")) notFound();

  if (row?.archived_at) {
    const link = screen.linkOf(row.id);
    return (
      <div className="admin-shell narrow">
        <AdminHeader
          title={`Archived · ${row.name}`}
          parents={parents}
          current={row.name}
        />
        <ArchivedEntry
          heading={row.name}
          badges={[CATEGORIES[row.category].tag]}
          more={
            <>
              {row.about ? <p>{row.about}</p> : null}
              {link ? (
                <p>Linked to {productLabel(link.go2pay_product_id)}.</p>
              ) : null}
            </>
          }
          intro={`This ${words.one} is archived and cannot be edited. Restore it to edit it again: it comes back as it was, and shows again if “Show” was ticked.`}
          target={{
            id: row.id,
            version: row.updated_at,
            kind,
            ...(merch ? { merch_item_id: merch.itemId } : {}),
          }}
          restore={{ action: restorePaymentItemAction }}
        />
      </div>
    );
  }

  const prefill = kind === "fund" && isNew && start === "general";
  const { item, current, earlier } = editableItem(row, screen.links, {
    id: crypto.randomUUID(),
    position: screen.nextPosition(kind),
    ...(prefill ? generalStart : {}),
    ...(merch ? { merch_item_id: merch.itemId } : {}),
  });
  const title = row
    ? merch
      ? `Size ${row.size_label}`
      : row.name
    : kind === "fund"
      ? "Add a fund"
      : merch
        ? "Add a size"
        : "Add a ticket";

  if (kind === "priced") {
    const usedBy =
      row && !merch ? (await ticketUsers()).get(row.id) : undefined;
    return (
      <div className="admin-shell narrow">
        <AdminHeader title={title} parents={parents} current={title} />
        <AppearsOn area={merch ? "merch" : "tickets"} />
        {usedBy ? <p className="muted">Used by {usedBy}</p> : null}
        <PricedItemEditor
          item={item}
          current={current}
          earlier={earlier}
          receiptNote={note}
          canEditPages={canEditPages}
          size={merch}
        />
      </div>
    );
  }

  const seasons = seasonChoices(screen.context);
  const window = row ? screen.windowOf(row) : null;
  const seasonName = seasons.find((s) => s.id === row?.season_id)?.name;
  const rerunLabel =
    window?.blocked === "waiting_rerun" && window.season && seasonName
      ? `Running again in ${seasonName} ${window.season.first.slice(0, 4)}`
      : null;
  return (
    <div className="admin-shell">
      <AdminHeader title={title} parents={parents} current={title} />
      <AppearsOn area="funds" />
      <FundEditor
        item={item}
        seasonYear={row?.season_year ?? null}
        lockedSince={lockedDay(row)}
        current={current}
        earlier={earlier}
        seasons={seasons}
        zakatLastDay={screen.context.zakatLastDay}
        today={screen.context.today}
        receiptNote={note}
        canEditPages={canEditPages}
        others={screen.shownFunds()}
        rerunLabel={rerunLabel}
      />
    </div>
  );
}
