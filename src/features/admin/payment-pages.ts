import "server-only";
import {
  adminSeasonContext,
  allAdminPaymentItems,
} from "@/lib/backend/admin-payments";
import type { VersionedPaymentItem } from "@/lib/backend/providers/contract";
import {
  closedReasons,
  donateSlip,
  paymentItemFlags,
  paymentItemVisible,
  paymentItemWindow,
  type ItemWindow,
  productLabel,
} from "@/lib/community/payment-policy";
import {
  currentLinks,
  type Kind,
  type PaymentItemLink,
} from "@/lib/community/payments";
import { nextPosition } from "@/lib/community/order";
import { localDate } from "@/lib/community/schema";
import { getIntegrations } from "@/lib/content";
import type { EditableItem, OrderedFund, SeasonChoice } from "./FundEditor";

/**
 * What the Funds and Tickets screens show (PR6 WP-6), worked out on the
 * server from the board's rows, the seasons and today: each item's window,
 * flags and links. Pure policy calls only; nothing here calls Go2Pay.
 */
export async function givingScreen() {
  const [all, context] = await Promise.all([
    allAdminPaymentItems(),
    adminSeasonContext(),
  ]);
  const current = currentLinks(all.links);
  const windowOf = (item: VersionedPaymentItem): ItemWindow =>
    paymentItemWindow(
      item,
      item.season_id ? (context.dates.get(item.season_id) ?? null) : null,
      context.zakatLastDay,
    );
  return {
    ...all,
    context,
    unavailable: all.unavailable || context.unavailable,
    linkOf: (id: string): PaymentItemLink | null => current.get(id) ?? null,
    windowOf,
    /** Why visitors can't give to it today (`closedReasons`, the Donate page's own rule). */
    closedReasonsOf: (item: VersionedPaymentItem) =>
      closedReasons(
        item,
        current.get(item.id) ?? null,
        windowOf(item),
        context.today,
      ),
    flagsOf: (item: VersionedPaymentItem) =>
      paymentItemFlags(
        item,
        current.get(item.id) ?? null,
        windowOf(item),
        context.today,
      ),
    /** Funds visitors see on the Donate page today, as their slips (the fund editor's Preview). */
    shownFunds: (): OrderedFund[] =>
      all.items
        .filter(
          (item) =>
            item.kind === "fund" &&
            !item.archived_at &&
            paymentItemVisible(
              item,
              current.get(item.id) ?? null,
              windowOf(item),
              null,
              context.today,
            ),
        )
        .map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          season_id: item.season_id,
          position: item.position,
          slip: donateSlip(item, windowOf(item), context.today),
        })),
    /** The next order number for a new item of this kind. */
    nextPosition: (kind: Kind) =>
      nextPosition(all.items.filter((item) => item.kind === kind)),
  };
}

/** The board's receipt note (D-32) from the page texts; "" when unset. */
export async function receiptNote() {
  return (await getIntegrations()).payments.receipt_note?.trim() ?? "";
}

/** An item's form values, its current link and its earlier links (newest first). */
export function editableItem(
  item: VersionedPaymentItem | null,
  links: readonly PaymentItemLink[],
  defaults: {
    id: string;
    position: number;
    name?: string;
    category?: string;
    merch_item_id?: string;
  },
): { item: EditableItem; current: number | null; earlier: number[] } {
  const own = item
    ? links
        .filter((link) => link.payment_item_id === item.id)
        .sort((a, b) => Date.parse(b.added_at) - Date.parse(a.added_at))
        .map((link) => link.go2pay_product_id)
    : [];
  const [current = null, ...earlier] = own;
  return {
    item: {
      id: item?.id ?? defaults.id,
      slug: item?.slug ?? null,
      name: item?.name ?? defaults.name ?? "",
      category: item?.category ?? defaults.category ?? "",
      about: item?.about ?? "",
      heading: item?.heading ?? "",
      position: String(item?.position ?? defaults.position),
      listed: item?.listed ? "on" : "",
      season_id: item?.season_id ?? "",
      shows_from: item?.shows_from ?? "",
      shows_until: item?.shows_until ?? "",
      merch_item_id: item?.merch_item_id ?? defaults.merch_item_id ?? "",
      size_label: item?.size_label ?? "",
      link: current === null ? "" : productLabel(current),
      version: item?.updated_at ?? null,
    },
    current,
    earlier,
  };
}

/** The Grenada day a fund's category locked, or null. */
export const lockedDay = (item: VersionedPaymentItem | null) =>
  item?.first_shown_at ? localDate(new Date(item.first_shown_at)) : null;

/** The seasons a fund can follow, with today's days. */
export function seasonChoices(
  context: Awaited<ReturnType<typeof adminSeasonContext>>,
): SeasonChoice[] {
  return context.seasons.map((season) => ({
    id: season.id,
    name: season.name,
    dates: context.dates.get(season.id) ?? { state: "unavailable" },
  }));
}
