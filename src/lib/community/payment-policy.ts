import {
  type Category,
  type DonateGroup,
  type DonatePageData,
  type DonateSlip,
  type Go2PayOrder,
  type PaymentItem,
  type PaymentItemLink,
} from "./payments";
import { resolveAnchorDay, type SeasonDates } from "./season-policy";
import type { Season } from "./seasons";
import {
  isUpcoming,
  type EventTimes,
  localDate,
  type EventStatus,
  type PrayerSettings,
} from "./schema";
import { addDays, daysBetween } from "../time/days";
import { csvFile } from "../csv";

/**
 * The fixed giving rules (PR6 contract, ADR 0020): the four categories, the
 * Go2Pay link, when a fund or item is open, the Donate slips and the
 * Payments report. Pure: "today" (a Grenada day) and every read are passed
 * in. The category wording lives only in `CATEGORIES`; no rule branches on a
 * fund, heading or season name.
 */

type CategoryRules = {
  /** The slip's tag. */
  tag: string;
  /** Zakat categories only (D-77 d). */
  ruleLine: string | null;
  /** "About this fund" must be filled before listing. */
  aboutRequired: boolean;
  /** Closes at the end of the Grenada day before 1 Shawwal (D-30). */
  closesBeforeEidPrayer: boolean;
  /** Its own box on Payments, never added to any other total (D-64). */
  restricted: boolean;
};

/** The four fixed categories (D-59, D-77). */
export const CATEGORIES: Readonly<Record<Category, CategoryRules>> = {
  zakat_al_fitr: {
    tag: "Zakat al-Fitr",
    ruleLine: "Goes to people in need before Eid prayer.",
    aboutRequired: true,
    closesBeforeEidPrayer: true,
    restricted: true,
  },
  zakat_al_mal: {
    tag: "Zakat al-Mal",
    ruleLine: "Goes only to people who can receive zakat.",
    aboutRequired: true,
    closesBeforeEidPrayer: false,
    restricted: true,
  },
  sadaqah: {
    tag: "Sadaqah",
    ruleLine: null,
    aboutRequired: false,
    closesBeforeEidPrayer: false,
    restricted: false,
  },
  general: {
    tag: "General",
    ruleLine: null,
    aboutRequired: false,
    closesBeforeEidPrayer: false,
    restricted: false,
  },
};

/**
 * A slip's button (D-49; review fixes P4: it names Go2Pay and opens a new
 * tab); the "↗" is the button's arrow icon.
 */
export const GIVE_BUTTON = "Give on Go2Pay";
/** A ticket's button on its event page (P-72 B): Go2Pay shows the price and stock; the "↗" is the arrow icon. */
export const TICKET_BUTTON = "See price and buy";
/** Above all slips (D-62). */
export const INTENTION_LINE = "The fund you choose is your intention.";
/**
 * The Go2Pay notice near the top of the Donate page and of a season page's
 * funds (review fixes P4, the user's words, 2026-10-06): givers know they
 * leave the site and what the fees are. The only fee number on our pages
 * (D-76).
 */
export const FEE_LINE =
  "Payments are made on Go2Pay, an outside service. About 5% goes to fees.";
/** The giving fine print (D-31). */
export const GIVING_FINE_PRINT =
  "Payments are handled by Go2Pay, an independent payment service not affiliated with the SGU MSA. This website doesn't store your payment details.";
/** The longest optional heading (D-77). */
export const HEADING_MAX = 40;
/** A slip shows "Closes …" in its last 3 days (D-68). */
export const CLOSING_SOON_DAYS = 3;
/** An ended fund shows "close it in Go2Pay" on the board's list this long (D-72). */
export const ENDED_REMINDER_DAYS = 7;
/** A season item's own date further than this from the season's day is last year's (D-11). */
export const OWN_DATE_REACH_DAYS = 60;
/** "Running again" reminder before the season (D-14). */
export const SEASON_RERUN_REMINDER_DAYS = 45;
/** The Payments screen's whole Go2Pay read (D-74). */
export const GATEWAY_TIME_BUDGET_MS = 8_000;
/** At most this many pages of 20 orders per Go2Pay product (D-74). */
export const MAX_ORDER_PAGES_PER_PRODUCT = 25;
/** Zakat al-Fitr closes at the end of the Grenada day before 1 Shawwal (D-30). */
export const ZAKAT_AL_FITR_CLOSE = {
  hijriMonth: 10,
  hijriDay: 1,
  daysBefore: 1,
} as const;
/** Go2Pay's longest texts we copy into its product form (lower bounds seen, D-71). */
export const GO2PAY_TEXT_LIMITS = {
  title: 118,
  description: 152,
  caption: 75,
  receiptNote: 151,
} as const;

// --- The Go2Pay link -------------------------------------------------------

/** The refusal for anything that is not a Go2Pay page link (D-58). */
export const GO2PAY_LINK_ERROR =
  "Paste the Go2Pay page link, for example go2pay.gd/557.";
const go2payLink =
  /^(?:https:\/\/)?(?:www\.)?go2pay\.gd\/(\d{1,12})\/?(?:[?#].*)?$/i;

/**
 * The product id of a pasted Go2Pay page link: `go2pay.gd/1650`, with an
 * optional `https://`, `www.`, trailing slash, query or fragment. The one
 * link parser (editor, action and tests); the site stores only the id.
 */
export function parseGo2PayLink(
  text: string,
): { ok: true; id: number } | { ok: false; error: string } {
  const match = go2payLink.exec(text.trim());
  const id = match ? Number(match[1]) : 0;
  return id > 0 && Number.isSafeInteger(id)
    ? { ok: true, id }
    : { ok: false, error: GO2PAY_LINK_ERROR };
}

/** The Go2Pay page of a product: the Give route's redirect (never stored). */
export function go2payPageUrl(id: number): string {
  return `https://go2pay.gd/${id}`;
}

/** "go2pay.gd/1650": how a linked product is named on every screen and in Recent changes (never stored). */
export const productLabel = (id: number) => `go2pay.gd/${id}`;

// --- Slugs ---------------------------------------------------------------

const SLUG_LIMIT = 60;

/**
 * The Give address part for a new item: ASCII, lowercase, hyphens; "-2",
 * "-3" … when taken by any item, archived ones included (slugs are never
 * reused). Made once; it never changes.
 */
export function slugFor(name: string, taken: ReadonlySet<string>): string {
  const base =
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, SLUG_LIMIT - 4)
      .replace(/-+$/g, "") || "give";
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

// --- Ready to list --------------------------------------------------------

/** What a fund or item still needs before "Show" can be ticked. */
export function readyToList(
  item: Pick<PaymentItem, "category" | "about">,
  link: PaymentItemLink | null,
): { ok: true } | { ok: false; missing: ("about" | "link")[] } {
  const missing: ("about" | "link")[] = [];
  if (CATEGORIES[item.category].aboutRequired && !item.about.trim())
    missing.push("about");
  if (!link) missing.push("link");
  return missing.length ? { ok: false, missing } : { ok: true };
}

// --- Windows ----------------------------------------------------------------

/** When an item may show: its own dates, its season's, or both (D-11). */
export type ItemWindow = {
  /** First open day, or null (no start). */
  from: string | null;
  /** Last open day, or null (no end). */
  until: string | null;
  /** Why it is closed whatever the day; null when only the dates decide. */
  blocked: null | "season_unavailable" | "season_over" | "waiting_rerun";
  /** An own date was ignored as last year's. */
  ownDateIgnored: boolean;
  /** The season occurrence it would run for (D-14), when Islamic. */
  seasonYear: number | null;
  /** The season's days, for the board's screens. */
  season: { first: string; last: string } | null;
};

/**
 * The day before the next 1 Shawwal (D-30), from the season with that anchor
 * when there is one (its confirmed day counts), else the expected day.
 */
export function zakatAlFitrLastDay(
  seasons: readonly Season[],
  today: string,
  adjustment: PrayerSettings["hijri_adjustment"] | null,
): string | null {
  const eid = resolveAnchorDay(ZAKAT_AL_FITR_CLOSE, seasons, today, adjustment);
  return eid ? addDays(eid, -ZAKAT_AL_FITR_CLOSE.daysBefore) : null;
}

/**
 * Each side: the item's own date if set, else the season's if tied, else no
 * limit. While a season's last day is still expected, items closing with it
 * stay open one extra day (D-22), except zakat al-Fitr, which is capped at
 * `zakatLastDay` and closes exactly (closing early is safe, late is not).
 * `season` is null for an item with no season; an item tied to a season that
 * is not given (archived) reads as unavailable.
 */
export function paymentItemWindow(
  item: Pick<
    PaymentItem,
    "category" | "season_id" | "season_year" | "shows_from" | "shows_until"
  >,
  season: SeasonDates | null,
  zakatLastDay: string | null,
): ItemWindow {
  const window: ItemWindow = {
    from: item.shows_from || null,
    until: item.shows_until || null,
    blocked: null,
    ownDateIgnored: false,
    seasonYear: null,
    season: null,
  };
  if (item.season_id) {
    if (!season || season.state === "unavailable")
      window.blocked = "season_unavailable";
    else if (season.state === "over") window.blocked = "season_over";
    else {
      window.season = { first: season.first, last: season.last };
      window.seasonYear = season.hijriYear;
      const stale = (own: string, of: string) =>
        Math.abs(daysBetween(of, own)) > OWN_DATE_REACH_DAYS;
      if (window.from && stale(window.from, season.first)) {
        window.from = null;
        window.ownDateIgnored = true;
      }
      if (window.until && stale(window.until, season.last)) {
        window.until = null;
        window.ownDateIgnored = true;
      }
      const grace =
        season.lastStatus === "expected" &&
        !CATEGORIES[item.category].closesBeforeEidPrayer
          ? 1
          : 0;
      window.from ??= season.first;
      window.until ??= addDays(season.last, grace);
      if (
        item.season_year !== null &&
        season.hijriYear !== null &&
        item.season_year !== season.hijriYear
      )
        window.blocked = "waiting_rerun";
    }
  }
  if (CATEGORIES[item.category].closesBeforeEidPrayer) {
    if (!zakatLastDay) window.blocked ??= "season_unavailable";
    else if (!window.until || zakatLastDay < window.until)
      window.until = zakatLastDay;
  }
  return window;
}

/** Whether the window is open on `today` (a Grenada day). */
export function windowOpen(window: ItemWindow, today: string): boolean {
  return (
    !window.blocked &&
    (!window.from || window.from <= today) &&
    (!window.until || today <= window.until)
  );
}

type Listing = Pick<PaymentItem, "listed"> & { archived_at?: string | null };

/**
 * Why a fund or item is not open on `today` (review fixes P4: the Funds list
 * says why a fund is not on Donate yet), each reason once, in the order the
 * board fixes them. Empty: Give may send visitors to Go2Pay now. The one
 * rule behind `canPayNow`, so the list, the Donate page and Give never
 * disagree.
 */
export type ClosedReason =
  | { code: "archived" }
  | { code: "not_listed" }
  | { code: "no_link" }
  | { code: "season_unavailable" }
  | { code: "season_over" }
  | { code: "waiting_rerun" }
  | { code: "season_not_started"; on: string }
  | { code: "starts"; on: string }
  | { code: "ended"; on: string };

export function closedReasons(
  item: Listing,
  link: PaymentItemLink | null,
  window: ItemWindow,
  today: string,
): ClosedReason[] {
  const reasons: ClosedReason[] = [];
  if (item.archived_at) reasons.push({ code: "archived" });
  if (!item.listed) reasons.push({ code: "not_listed" });
  if (!link) reasons.push({ code: "no_link" });
  if (window.blocked) reasons.push({ code: window.blocked });
  else {
    if (window.from && today < window.from)
      reasons.push(
        window.season && window.from === window.season.first
          ? { code: "season_not_started", on: window.from }
          : { code: "starts", on: window.from },
      );
    if (window.until && window.until < today)
      reasons.push({ code: "ended", on: window.until });
  }
  return reasons;
}

/** Whether Give may send a visitor to Go2Pay now: our own rows and dates only (D-53, D-74). */
export function canPayNow(
  item: Listing,
  link: PaymentItemLink | null,
  window: ItemWindow,
  today: string,
): "ok" | "closed" {
  return closedReasons(item, link, window, today).length ? "closed" : "ok";
}

/**
 * Whether visitors see the fund or item. A ticket also needs its event on
 * sale (D-23: decided by the caller from the event; null = no event).
 */
export function paymentItemVisible(
  item: Listing & Pick<PaymentItem, "kind">,
  link: PaymentItemLink | null,
  window: ItemWindow,
  event: { onSale: boolean } | null,
  today: string,
): boolean {
  return (
    canPayNow(item, link, window, today) === "ok" &&
    (item.kind === "fund" || !event || event.onSale)
  );
}

/**
 * Whether an event's ticket is on sale (D-23): until the event ends, and not
 * once it is cancelled. A postponed event sells again once the board sets
 * its new date and Scheduled (D-81; review 2); meanwhile it stays visible
 * with "new date to be announced". Archived and unpublished
 * events are not visible, so callers pass only events visitors can see.
 */
export function ticketOnSale(
  event: EventTimes & { status?: EventStatus | null },
  now: Date,
): boolean {
  // Postponed means the new date is not known yet (review 2, 2026-10-05):
  // the ticket pauses until the event is Scheduled again on its new date.
  if (event.status === "cancelled" || event.status === "postponed")
    return false;
  return isUpcoming(event, now);
}

/** The last 3 days of a window with an end (D-68). */
export function closingSoon(
  window: ItemWindow,
  today: string,
): { daysLeft: 0 | 1 | 2 } | null {
  if (!window.until || !windowOpen(window, today)) return null;
  const left = daysBetween(today, window.until);
  return left >= 0 && left < CLOSING_SOON_DAYS
    ? { daysLeft: left as 0 | 1 | 2 }
    : null;
}

const closingWords = ["Closes today", "Closes tomorrow", "Closes in 2 days"];

/** What the board's fund list flags (D-72 and Design → board flags); words are the screen's. */
export type ItemFlag =
  | { code: "no_end" }
  | { code: "never_shows" }
  | { code: "own_date_ignored" }
  | { code: "waiting_rerun"; reminder: boolean }
  | { code: "season_unavailable" }
  | { code: "no_link" }
  | { code: "ended"; on: string }
  | { code: "locked"; since: string };

export function paymentItemFlags(
  item: Listing & Pick<PaymentItem, "first_shown_at">,
  link: PaymentItemLink | null,
  window: ItemWindow,
  today: string,
): ItemFlag[] {
  const flags: ItemFlag[] = [];
  if (window.blocked === "season_unavailable")
    flags.push({ code: "season_unavailable" });
  if (window.blocked === "waiting_rerun")
    flags.push({
      code: "waiting_rerun",
      reminder:
        window.season !== null &&
        daysBetween(today, window.season.first) <= SEASON_RERUN_REMINDER_DAYS,
    });
  if (window.ownDateIgnored) flags.push({ code: "own_date_ignored" });
  if (!link) flags.push({ code: "no_link" });
  if (window.from && window.until && window.until < window.from)
    flags.push({ code: "never_shows" });
  else if (item.listed && !window.blocked && !window.until)
    flags.push({ code: "no_end" });
  if (
    item.listed &&
    window.until &&
    window.until < today &&
    daysBetween(window.until, today) <= ENDED_REMINDER_DAYS
  )
    flags.push({ code: "ended", on: window.until });
  if (item.first_shown_at)
    flags.push({
      code: "locked",
      since: localDate(new Date(item.first_shown_at)),
    });
  return flags;
}

// --- The Donate page ----------------------------------------------------------

/** One slip, every word worked out here (D-49, D-68, D-77). */
export function donateSlip(
  item: Pick<PaymentItem, "slug" | "name" | "category" | "about" | "heading">,
  window: ItemWindow,
  today: string,
): DonateSlip {
  const rules = CATEGORIES[item.category];
  const soon = closingSoon(window, today);
  return {
    slug: item.slug,
    title: item.name,
    category: item.category,
    tag: rules.tag,
    ruleLine: rules.ruleLine,
    about: item.about.trim() || null,
    heading: item.heading.trim() || null,
    closingSoon: soon ? closingWords[soon.daysLeft] : null,
    giveHref: `/donate/${item.slug}/give`,
  };
}

/** The restricted (zakat) categories, in `CATEGORIES` order (D-64). */
const RESTRICTED = (Object.keys(CATEGORIES) as Category[]).filter(
  (category) => CATEGORIES[category].restricted,
);

/**
 * A fund's group on the Donate page (D-77 c), as a rank: each zakat category,
 * then season-tied funds, then Sadaqah, then General. The board orders funds
 * only within their group (the Funds list has one dragged list per group).
 */
export const donateRank = (
  item: Pick<PaymentItem, "category" | "season_id">,
) => {
  const restricted = RESTRICTED.indexOf(item.category);
  if (restricted >= 0) return restricted;
  return (
    RESTRICTED.length +
    (item.season_id ? 0 : item.category === "sadaqah" ? 1 : 2)
  );
};

/**
 * The slip order (D-77 c): Zakat al-Fitr, Zakat al-Mal, season-tied funds,
 * Sadaqah, General; then the board's order number, then the name.
 */
export function donateOrder<
  T extends Pick<PaymentItem, "category" | "season_id" | "position" | "name">,
>(items: readonly T[]): T[] {
  return [...items].sort(
    (a, b) =>
      donateRank(a) - donateRank(b) ||
      a.position - b.position ||
      a.name.localeCompare(b.name),
  );
}

/**
 * Runs of slips next to each other with the same heading share it (D-77 b);
 * a slip with no heading starts or continues a run with none.
 */
export function donateGroups(slips: readonly DonateSlip[]): DonateGroup[] {
  const groups: DonateGroup[] = [];
  for (const slip of slips) {
    const last = groups.at(-1);
    if (last && last.heading === slip.heading) last.slips.push(slip);
    else groups.push({ heading: slip.heading, slips: [slip] });
  }
  return groups;
}

/**
 * The Donate page with funds to show (D-49, D-76): the Go2Pay notice near
 * the top (review fixes P4), the slips in their groups, the intention line
 * and the fine print. The public page and the fund editor's Preview both
 * draw this.
 */
export function readyDonatePage(groups: DonateGroup[]): DonatePageData {
  return {
    state: "ready",
    notice: FEE_LINE,
    intentionLine: INTENTION_LINE,
    groups,
    finePrint: [GIVING_FINE_PRINT],
  };
}

// --- Copying into Go2Pay -----------------------------------------------------

/**
 * The texts the board copies into Go2Pay's product form (D-32, D-71), from
 * our row, so the zakat rule line is written once. `receiptNote` is the
 * MSA's receipt wording.
 */
export function go2payCopyText(
  item: Pick<PaymentItem, "name" | "category" | "about">,
  receiptNote: string,
): {
  title: string;
  description: string;
  caption: string;
  receiptNote: string;
} {
  const rules = CATEGORIES[item.category];
  const description = [`${rules.tag}.`, rules.ruleLine, item.about.trim()]
    .filter(Boolean)
    .join(" ");
  return {
    title: item.name.trim(),
    description,
    caption: description,
    receiptNote: `${item.name.trim()} (${rules.tag}). ${receiptNote.trim()}`,
  };
}

// --- Payments -------------------------------------------------------------------

/** Only real payments count; unfinished attempts are hidden (D-64). */
export const COUNTED_STATUSES = ["PAID", "PARTIAL REFUND", "REFUNDED"] as const;

/** The Grenada day of a Go2Pay `created` time (Grenada local time, or with an offset). */
export function orderDay(created: string): string {
  const text = created.trim();
  if (/(?:z|[+-]\d{2}:?\d{2})$/i.test(text)) {
    const at = new Date(text.replace(" ", "T"));
    if (Number.isFinite(at.getTime())) return localDate(at);
  }
  return text.slice(0, 10);
}

export type ReportLine = {
  itemId: string;
  name: string;
  category: Category;
  tag: string;
  /** Every Go2Pay product the item ever linked (old links still count). */
  productIds: number[];
  orders: number;
  /** In cents: gifts (`subtotal`), what buyers paid, refunds. */
  gift: number;
  buyerPaid: number;
  refunded: number;
};

export type ReportRow = {
  day: string;
  itemId: string;
  itemName: string;
  category: Category;
  tag: string;
  productId: number;
  orderId: number;
  /** On screen only; never in the CSV (D-39). */
  giver: string;
  note: string;
  gift: number;
  buyerPaid: number;
  refunded: number;
  status: string;
  test: boolean;
};

export type PaymentsReport = {
  /** Zakat al-Fitr, then Zakat al-Mal: each its own box, never added to anything. */
  restricted: { category: Category; tag: string; lines: ReportLine[] }[];
  /** Sadaqah, General, season funds and sales: a line each and a subtotal. No grand total. */
  unrestricted: {
    lines: ReportLine[];
    subtotal: { gift: number; buyerPaid: number; refunded: number };
  };
  /** Newest first. */
  rows: ReportRow[];
};

/**
 * Totals per fund and item from the orders read (already limited to the
 * chosen days by the caller), grouped by category (D-64).
 */
export function paymentsReport(
  orders: readonly Go2PayOrder[],
  items: readonly Pick<PaymentItem, "id" | "name" | "category" | "position">[],
  links: readonly PaymentItemLink[],
): PaymentsReport {
  const itemOf = new Map(links.map((l) => [l.go2pay_product_id, l]));
  const byId = new Map(items.map((item) => [item.id, item]));
  const lines = new Map<string, ReportLine>();
  const rows: ReportRow[] = [];
  const seen = new Set<number>();
  for (const order of orders) {
    if (seen.has(order.id)) continue;
    seen.add(order.id);
    if (!(COUNTED_STATUSES as readonly string[]).includes(order.status))
      continue;
    const item = byId.get(itemOf.get(order.product_id)?.payment_item_id ?? "");
    if (!item) continue;
    const rules = CATEGORIES[item.category];
    const line =
      lines.get(item.id) ??
      lines
        .set(item.id, {
          itemId: item.id,
          name: item.name,
          category: item.category,
          tag: rules.tag,
          productIds: links
            .filter((l) => l.payment_item_id === item.id)
            .map((l) => l.go2pay_product_id),
          orders: 0,
          gift: 0,
          buyerPaid: 0,
          refunded: 0,
        })
        .get(item.id)!;
    line.orders += 1;
    line.gift += order.subtotal;
    line.buyerPaid += order.customer_total;
    line.refunded += order.refunded;
    rows.push({
      day: orderDay(order.created),
      itemId: item.id,
      itemName: item.name,
      category: item.category,
      tag: rules.tag,
      productId: order.product_id,
      orderId: order.id,
      giver: [order.first_name, order.last_name].filter(Boolean).join(" "),
      note: order.note,
      gift: order.subtotal,
      buyerPaid: order.customer_total,
      refunded: order.refunded,
      status: order.status,
      test: order.test_mode,
    });
  }
  const order = (a: ReportLine, b: ReportLine) =>
    (byId.get(a.itemId)?.position ?? 0) - (byId.get(b.itemId)?.position ?? 0) ||
    a.name.localeCompare(b.name);
  const all = [...lines.values()].sort(order);
  const unrestricted = all.filter((l) => !CATEGORIES[l.category].restricted);
  return {
    restricted: RESTRICTED.map((category) => ({
      category,
      tag: CATEGORIES[category].tag,
      lines: all.filter((l) => l.category === category),
    })),
    unrestricted: {
      lines: unrestricted,
      subtotal: unrestricted.reduce(
        (sum, l) => ({
          gift: sum.gift + l.gift,
          buyerPaid: sum.buyerPaid + l.buyerPaid,
          refunded: sum.refunded + l.refunded,
        }),
        { gift: 0, buyerPaid: 0, refunded: 0 },
      ),
    },
    rows: rows.sort(
      (a, b) => b.day.localeCompare(a.day) || b.orderId - a.orderId,
    ),
  };
}

/** "25.00" from 2500 cents. */
export const amountText = (cents: number) => (cents / 100).toFixed(2);

const CSV_HEADER = [
  "Date",
  "Fund or item",
  "Category",
  "Go2Pay product",
  "Order no.",
  "Gift",
  "Buyer paid",
  "Refunded",
  "Status",
  "Note",
] as const;

/**
 * The Payments CSV (D-39, D-64): notes but never names, built per request
 * and never stored.
 */
export function paymentsCsv(rows: readonly ReportRow[]): string {
  return csvFile(
    CSV_HEADER,
    rows.map((row) => [
      row.day,
      row.itemName,
      row.tag,
      String(row.productId),
      String(row.orderId),
      amountText(row.gift),
      amountText(row.buyerPaid),
      amountText(row.refunded),
      row.status,
      row.note,
    ]),
  );
}
