import "server-only";
import { getRecords } from "@/lib/community/queries";
import {
  contentProvider,
  paymentGateway,
  paymentsProvider,
} from "@/lib/runtime/providers";
import {
  canPayNow,
  donateGroups,
  donateOrder,
  donateSlip,
  GIVING_FINE_PRINT,
  paymentItemVisible,
  paymentItemWindow,
  readyDonatePage,
  ticketOnSale,
  zakatAlFitrLastDay,
} from "@/lib/community/payment-policy";
import {
  currentLinks,
  type DonateGroup,
  type DonatePageData,
  type PaymentItem,
  type PricedItemButton,
} from "@/lib/community/payments";
import {
  merchPage,
  type MerchPageData,
  type MerchSize,
} from "@/lib/community/merch";
import { seasonContext } from "@/lib/community/season-policy";
import type { Season } from "@/lib/community/seasons";
import { localDate } from "@/lib/community/schema";

/** The board's Hijri adjustment, or null when prayer settings cannot be read (never a silent 0). */
async function hijriAdjustment() {
  const prayer = await contentProvider().getPrayerSettings();
  return prayer.unavailable ? null : prayer.settings.hijri_adjustment;
}

/** Each item's window as of `today`, from the seasons and the adjustment. */
function windowsFor(
  seasons: readonly Season[],
  today: string,
  adjustment: Awaited<ReturnType<typeof hijriAdjustment>>,
) {
  const resolved = seasonContext(seasons, today, adjustment);
  const zakatLastDay = zakatAlFitrLastDay(seasons, today, adjustment);
  return (item: PaymentItem) =>
    paymentItemWindow(
      item,
      item.season_id ? (resolved.get(item.season_id) ?? null) : null,
      zakatLastDay,
    );
}

/**
 * The funds visitors see now (`paymentItemVisible`), each with its window,
 * and today; null when the giving rows cannot be read.
 */
async function openFunds(now: Date) {
  const today = localDate(now);
  const provider = paymentsProvider();
  const [rows, seasons, adjustment] = await Promise.all([
    provider.items(),
    provider.seasons(),
    hijriAdjustment(),
  ]);
  if (rows.unavailable || seasons.unavailable) return null;
  const windowOf = windowsFor(seasons.seasons, today, adjustment);
  const links = currentLinks(rows.links);
  const open = rows.items.flatMap((item) => {
    if (item.kind !== "fund") return [];
    const window = windowOf(item);
    return paymentItemVisible(
      item,
      links.get(item.id) ?? null,
      window,
      null,
      today,
    )
      ? [{ ...item, window }]
      : [];
  });
  return { open, today };
}

/**
 * The Donate page (PR6 D-49, D-62, D-76, D-77): the open funds as slips in
 * the approved order, grouped under the board's optional headings, with the
 * intention line and the fine print. `now` is the shared server clock.
 * Priced items are never on the Donate page.
 */
export async function loadDonatePage(now: Date): Promise<DonatePageData> {
  const funds = await openFunds(now);
  if (!funds) return { state: "unavailable" };
  const { open, today } = funds;
  if (!open.length) return { state: "empty", finePrint: [GIVING_FINE_PRINT] };
  return readyDonatePage(
    donateGroups(
      donateOrder(open).map((item) => donateSlip(item, item.window, today)),
    ),
  );
}

/**
 * A season page's funds (PR5c): the open funds tied to the season, as the
 * Donate page groups them. Empty when none is open or giving cannot be read
 * (the page then shows no funds section).
 */
export async function loadSeasonFunds(
  seasonId: string,
  now: Date,
): Promise<DonateGroup[]> {
  const funds = await openFunds(now);
  if (!funds) return [];
  const { open, today } = funds;
  return donateGroups(
    donateOrder(open.filter((item) => item.season_id === seasonId)).map(
      (item) => donateSlip(item, item.window, today),
    ),
  );
}

/**
 * Whether the Donate page shows funds now (D-41): the Home and Ramadan bands
 * link to it only then.
 */
export async function donatePageShowsFunds(now: Date): Promise<boolean> {
  return (await loadDonatePage(now)).state === "ready";
}

/**
 * A ticket's event as Give sees it (D-23, D-81): on sale only while a visible
 * event sells it and that event has not ended or been cancelled, and is not
 * postponed without a new date. A ticket no
 * visible event sells (unpublished, archived, or none) is not on sale.
 * Null when the events cannot be read.
 */
async function ticketEventState(
  itemId: string,
  now: Date,
): Promise<{ onSale: boolean } | null> {
  const events = await getRecords("events");
  if (events.unavailable) return null;
  const event = events.records.find(
    (record) => record.ticket_payment_item_id === itemId,
  );
  return { onSale: Boolean(event && ticketOnSale(event, now)) };
}

/**
 * Whether a merch size's item is on sale (PR5c): a current item in a
 * current collection that is on sale now. Null when merch cannot be read.
 */
async function merchItemOnSale(
  itemId: string,
): Promise<{ onSale: boolean } | null> {
  const merch = await paymentsProvider().merch();
  if (merch.unavailable) return null;
  const item = merch.items.find((row) => row.id === itemId);
  const collection = merch.collections.find(
    (row) => row.id === item?.collection_id,
  );
  return { onSale: collection?.era === "current" };
}

/**
 * The `/merch` page (PR5c, D-27, P-72 B): current collections and items in
 * the board's order, each item's sizes that are open now as "See price and
 * buy ↗" buttons to their Give addresses. No price, stock or Go2Pay address
 * on our page. `unavailable` when merch cannot be read; sizes are left out
 * (the items still show) when giving cannot be read.
 */
export async function loadMerchPage(now: Date): Promise<MerchPageData> {
  const today = localDate(now);
  const provider = paymentsProvider();
  const [merch, rows, seasons, adjustment] = await Promise.all([
    provider.merch(),
    provider.items(),
    provider.seasons(),
    hijriAdjustment(),
  ]);
  if (merch.unavailable) return { state: "unavailable" };
  const sizes = new Map<string, MerchSize[]>();
  if (!rows.unavailable && !seasons.unavailable) {
    const windowOf = windowsFor(seasons.seasons, today, adjustment);
    const links = currentLinks(rows.links);
    const ordered = [...rows.items].sort(
      (a, b) => a.position - b.position || a.name.localeCompare(b.name),
    );
    for (const item of ordered) {
      if (item.kind !== "priced" || !item.merch_item_id) continue;
      const visible = paymentItemVisible(
        item,
        links.get(item.id) ?? null,
        windowOf(item),
        { onSale: true },
        today,
      );
      if (!visible) continue;
      const list = sizes.get(item.merch_item_id) ?? [];
      list.push({
        label: item.size_label,
        giveHref: `/donate/${item.slug}/give`,
      });
      sizes.set(item.merch_item_id, list);
    }
  }
  return merchPage(merch.collections, merch.items, sizes);
}

/**
 * Where `/donate/<slug>/give` sends a visitor (D-53): the item's Go2Pay page
 * (or the sandbox checkout) while our own row and dates say it is open, and,
 * for a ticket, while its event is on sale (D-23), and for a merch size,
 * while its item is in a current collection (PR5c); `closed` for a closed,
 * archived or unknown slug (a 404); `unavailable` when our database cannot
 * be read. No Go2Pay call is made (D-74).
 */
export async function loadGiveTarget(
  slug: string,
  now: Date,
): Promise<
  { state: "redirect"; url: string } | { state: "closed" | "unavailable" }
> {
  const today = localDate(now);
  const provider = paymentsProvider();
  const [read, seasons, adjustment] = await Promise.all([
    provider.itemBySlug(slug),
    provider.seasons(),
    hijriAdjustment(),
  ]);
  if (read.unavailable || seasons.unavailable) return { state: "unavailable" };
  if (!read.found) return { state: "closed" };
  const { item, link } = read.found;
  const window = windowsFor(seasons.seasons, today, adjustment)(item);
  if (!link || canPayNow(item, link, window, today) !== "ok")
    return { state: "closed" };
  if (item.kind === "priced") {
    // A merch size sells while its item is on sale (PR5c); a ticket while its event is (D-23).
    const event = item.merch_item_id
      ? await merchItemOnSale(item.merch_item_id)
      : await ticketEventState(item.id, now);
    if (!event) return { state: "unavailable" };
    if (!paymentItemVisible(item, link, window, event, today))
      return { state: "closed" };
  }
  return {
    state: "redirect",
    url: paymentGateway().checkoutUrl(link.go2pay_product_id),
  };
}

/**
 * An event's ticket button (P-72 B, D-23, D-81): the ticket's Give address
 * while the event is on sale and the ticket is listed, linked and inside its
 * dates; null otherwise, and when giving cannot be read (the event page then
 * hides only the button).
 */
export async function loadEventTicket(
  event: {
    ticket_payment_item_id?: string | null;
    date: string;
    start_time?: string | null;
    end_date?: string | null;
    end_time?: string | null;
    status?: "scheduled" | "cancelled" | "postponed" | null;
  },
  now: Date,
): Promise<PricedItemButton | null> {
  const id = event.ticket_payment_item_id;
  if (!id || !ticketOnSale(event, now)) return null;
  const today = localDate(now);
  const provider = paymentsProvider();
  const [rows, seasons, adjustment] = await Promise.all([
    provider.items(),
    provider.seasons(),
    hijriAdjustment(),
  ]);
  if (rows.unavailable || seasons.unavailable) return null;
  const item = rows.items.find((row) => row.id === id && row.kind === "priced");
  if (!item) return null;
  const link = currentLinks(rows.links).get(item.id) ?? null;
  const window = windowsFor(seasons.seasons, today, adjustment)(item);
  return paymentItemVisible(item, link, window, { onSale: true }, today)
    ? {
        slug: item.slug,
        title: item.name,
        giveHref: `/donate/${item.slug}/give`,
      }
    : null;
}
