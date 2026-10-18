import "server-only";
import {
  clock,
  contentEditor,
  paymentGateway,
  paymentItemEditor,
  seasonEditor,
} from "@/lib/runtime/providers";
import {
  paymentsReport,
  zakatAlFitrLastDay,
  type PaymentsReport,
} from "../community/payment-policy";
import type { Category, PaymentItemLink } from "../community/payments";
import { seasonContext, type SeasonDates } from "../community/season-policy";
import { localDate } from "../community/schema";
import { collectOrders } from "../integrations/payments/orders";
import type {
  GatewayProblem,
  PaymentGateway,
} from "../integrations/payments/providers/contract";
import { requireAdmin } from "./server";
import type {
  AdminIdentity,
  ListView,
  VersionedPaymentItem,
} from "./providers/contract";

/**
 * Protected board reads for giving (PR6 WP-5, WP-6, WP-7), through the
 * ports. Any admin reads funds, tickets and seasons (D-65); only "manage
 * money" holders read Go2Pay's orders (D-64), checked here for the page and
 * the CSV alike.
 */

export async function listAdminPaymentItems(view?: ListView) {
  await requireAdmin();
  return paymentItemEditor().listItems(view);
}

export async function listAdminSeasons(view?: ListView) {
  await requireAdmin();
  return seasonEditor().listSeasons(view);
}

/**
 * Today (Grenada), the board's Hijri adjustment (null when prayer settings
 * cannot be read: never a silent 0), every season current and archived, and
 * each current season's days and the zakat al-Fitr last day as of today.
 */
export async function adminSeasonContext() {
  await requireAdmin();
  const today = localDate(clock().now());
  const [current, archived, prayer] = await Promise.all([
    seasonEditor().listSeasons(),
    seasonEditor().listSeasons("archived"),
    contentEditor().readPrayer(),
  ]);
  const adjustment = prayer ? prayer.settings.hijri_adjustment : null;
  return {
    today,
    adjustment,
    seasons: current.seasons,
    archived: archived.seasons,
    unavailable: current.unavailable || archived.unavailable,
    dates: seasonContext(current.seasons, today, adjustment) as ReadonlyMap<
      string,
      SeasonDates
    >,
    zakatLastDay: zakatAlFitrLastDay(current.seasons, today, adjustment),
  };
}

/** Every fund and ticket, current and archived, with every link (old links still count). */
export async function allAdminPaymentItems(): Promise<{
  items: VersionedPaymentItem[];
  links: PaymentItemLink[];
  unavailable: boolean;
}> {
  await requireAdmin();
  const [current, archived] = await Promise.all([
    paymentItemEditor().listItems(),
    paymentItemEditor().listItems("archived"),
  ]);
  return {
    items: [...current.items, ...archived.items],
    links: [...current.links, ...archived.links],
    unavailable: current.unavailable || archived.unavailable,
  };
}

/** Whether this board member may see orders, names and notes (D-64, D-65). */
export const canSeeMoney = (admin: AdminIdentity | null) =>
  Boolean(admin?.canManageMoney);

export type MoneyIn =
  | { state: "forbidden" }
  /** Our own database could not be read. */
  | { state: "unavailable" }
  | { state: "gateway"; problem: GatewayProblem; mode: PaymentGateway["mode"] }
  | {
      state: "ready";
      report: PaymentsReport;
      /** Time or pages ran out: some older orders are missing. */
      partial: boolean;
      mode: PaymentGateway["mode"];
      /** A key that can do more than take payments (warned off the live site). */
      broadKey: boolean;
    };

/**
 * What came in between two Grenada days, per fund and ticket (D-64, D-74),
 * read live from Go2Pay for a "manage money" holder: the key is checked,
 * then the orders of every product the chosen funds and tickets ever
 * linked. Names and notes are returned for the screen only; nothing is
 * stored, cached or logged.
 */
export async function readMoneyIn(
  admin: AdminIdentity | null,
  filters: {
    from: string;
    until: string;
    category: Category | "";
    item: string;
    status: string;
  },
  /** The rows when the caller has them already. */
  rows?: Awaited<ReturnType<typeof allAdminPaymentItems>>,
  /** The configured gateway unless given (tests). */
  gateway: PaymentGateway = paymentGateway(),
): Promise<MoneyIn> {
  if (!canSeeMoney(admin)) return { state: "forbidden" };
  const all = rows ?? (await allAdminPaymentItems());
  if (all.unavailable) return { state: "unavailable" };
  const items = all.items.filter(
    (item) =>
      (!filters.category || item.category === filters.category) &&
      (!filters.item || item.id === filters.item),
  );
  const ids = new Set(items.map((item) => item.id));
  const links = all.links.filter((link) => ids.has(link.payment_item_id));
  const key = await gateway.checkKey();
  if (!key.ok)
    return { state: "gateway", problem: key.reason, mode: gateway.mode };
  const read = await collectOrders({
    gateway,
    productIds: links.map((link) => link.go2pay_product_id),
    from: filters.from,
    until: filters.until,
    elapsed: () => performance.now(),
  });
  if (!read.ok)
    return { state: "gateway", problem: read.reason, mode: gateway.mode };
  const orders =
    filters.status === "all"
      ? read.orders
      : read.orders.filter((order) => order.status === filters.status);
  return {
    state: "ready",
    report: paymentsReport(orders, items, links),
    partial: read.partial,
    mode: gateway.mode,
    broadKey: key.scope === "too_broad",
  };
}
