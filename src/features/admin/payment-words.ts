import {
  CATEGORIES,
  GO2PAY_TEXT_LIMITS,
  type ClosedReason,
  type ItemFlag,
} from "@/lib/community/payment-policy";
import type { Category, Kind, PaymentItem } from "@/lib/community/payments";
import type { SideStatus } from "@/lib/community/season-policy";
import {
  dayLabel,
  longDateLabel,
  weekdayDateLabel,
} from "@/lib/time/date-label";
import {
  sessionExpired,
  staleScreen,
  systemText,
  unavailableMessage,
} from "@/lib/system-text";

/**
 * The words of the Funds, Tickets, Seasons and Payments screens (PR6 WP-5,
 * WP-6, WP-7). The category names and the two zakat rule lines come only
 * from `CATEGORIES` (ADR 0020); what is said here about a category is keyed
 * on its rule flags (`restricted`, `closesBeforeEidPrayer`), never on its
 * name. Browser-safe.
 */

/** "US$1,240.00" from cents. */
export function money(cents: number) {
  return `US$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** The category tags in `CATEGORIES` order, for choices and filters. */
export const categoryChoices = (Object.keys(CATEGORIES) as Category[]).map(
  (category) => [category, CATEGORIES[category].tag] as const,
);

/**
 * The heading of a fund's Donate-page group on the Funds list (review fixes
 * PR-2), keyed on the same rules as `donateRank`: a zakat category's tag,
 * "Funds with a season", or the category's tag.
 */
export function donateGroupName(
  item: Pick<PaymentItem, "category" | "season_id">,
): string {
  const rules = CATEGORIES[item.category];
  return !rules.restricted && item.season_id
    ? "Funds with a season"
    : rules.tag;
}

/** What a fund or ticket is called on a screen. */
export const kindWords: Record<Kind, { one: string; list: string }> = {
  fund: { one: "fund", list: "Funds" },
  priced: { one: "ticket", list: "Tickets" },
};

/** The line under a category card: its fixed rule line, else what its rules mean. */
export function categoryCardLines(category: Category): string[] {
  const rules = CATEGORIES[category];
  return [
    ...(rules.ruleLine ? [rules.ruleLine] : []),
    rules.restricted
      ? "Its own total on Payments, never added to other money."
      : "The board may use it where it is needed.",
    ...(rules.closesBeforeEidPrayer
      ? ["Closes by itself the day before Eid al-Fitr."]
      : []),
  ];
}

/**
 * The example in the empty "About this fund" box, per category: the approved
 * example slips (contract Design → Categories, D-77 d). Never saved.
 */
export const aboutExamples: Record<Category, string> = {
  zakat_al_fitr: "US$10 per person in your household.",
  zakat_al_mal: "Passed on to people in need.",
  sadaqah: "Used where it helps most.",
  general: "Keeps the Musallah and the MSA running.",
};

/**
 * The board's fund list flags (`paymentItemFlags` codes, D-72; contract
 * Design → board flags). `endDateShown`: the row already says when it ended
 * (a fund's Donate line), so an ended flag keeps only "close it in Go2Pay".
 */
export function itemFlagText(
  flag: ItemFlag,
  { endDateShown = false }: { endDateShown?: boolean } = {},
): string {
  switch (flag.code) {
    case "no_end":
      return "Shows with no end date";
    case "never_shows":
      return "Will never show: Show until is before Show from";
    case "own_date_ignored":
      return "Last year's date ignored";
    case "waiting_rerun":
      return flag.reminder
        ? "Waiting for “Running again”: the season starts soon"
        : "Waiting for “Running again”";
    case "season_unavailable":
      return "Season dates unavailable";
    case "no_link":
      return "No Go2Pay link";
    case "ended":
      return endDateShown
        ? "Close it in Go2Pay"
        : `Ended on ${dayLabel(flag.on)} · close it in Go2Pay`;
    case "locked":
      return `Locked since ${dayLabel(flag.since)}`;
  }
}

/** One reason a fund is not on the Donate page (`closedReasons`; review fixes P4). */
export function closedReasonText(reason: ClosedReason): string {
  switch (reason.code) {
    case "archived":
      return "archived";
    case "not_listed":
      return "“Show on the Donate page” is unticked";
    case "no_link":
      return "no Go2Pay link";
    case "season_unavailable":
      return "its season’s dates can’t be worked out";
    case "season_over":
      return "its season is over";
    case "waiting_rerun":
      return "waiting for “Running again”";
    case "season_not_started":
      return `its season starts on ${longDay(reason.on)}`;
    case "starts":
      return `starts on ${longDay(reason.on)}`;
    case "ended":
      return `ended on ${longDay(reason.on)}`;
  }
}

/**
 * A fund's Donate line on the Funds list (review fixes P4): on the Donate
 * page now, or why not, from the same rule that builds the page.
 */
export function donateStatusText(reasons: readonly ClosedReason[]): string {
  return reasons.length
    ? `Not on the Donate page: ${reasons.map(closedReasonText).join(", ")}`
    : "On the Donate page now";
}

/** "Mon 8 Feb 2027". */
export const longDay = longDateLabel;

/** "Mon 8 Feb – Mon 8 Mar 2027" (Gregorian only, D-78). */
export function daysText(first: string, last: string) {
  if (first === last) return longDay(first);
  const sameYear = first.slice(0, 4) === last.slice(0, 4);
  return `${sameYear ? weekdayDateLabel(first) : longDay(first)} – ${longDay(last)}`;
}

/** The badge after a season day. */
export const sideStatusWords: Record<SideStatus, string> = {
  expected: "expected",
  confirmed: "confirmed",
  typed: "typed",
};

/** The fixed category lock (D-61; contract Design → Lock). */
export const lockWords = {
  before: "Once this shows on the Donate page, its category can't change.",
  locked:
    "Givers have seen this category, so it can't change. To collect for something else, make a new fund.",
} as const;

/** Why a fund or ticket save was refused (contract Data and State Flow). */
export const itemRefusals = {
  forbidden: sessionExpired,
  fund_locked:
    "The category is locked because givers have already seen this fund. Make a new fund to collect for something else.",
  link_used_before:
    "This Go2Pay page was linked here before. A Go2Pay page can be linked only once: make a new product in Go2Pay and paste its link.",
  conflict: staleScreen,
  unavailable: unavailableMessage("save"),
} as const;

/** `link_taken` (D-17), naming the other fund or ticket. */
export const linkTaken = (other: string) =>
  `This Go2Pay page is already used by ${other}. Each fund or item needs its own Go2Pay page.`;

/** A merch item has each size once (PR5c, `payment_items_one_size`). */
export const sizeTaken = "Size: this item already has this size.";

/** `readyToList` refusals. */
export const notReady = {
  about:
    "About this fund: zakat funds need it before they show. Say how the MSA passes it on.",
  link: "Go2Pay page link: paste it before ticking Show.",
} as const;

/** The Go2Pay link box (D-58; WP-6: a page can be linked only once). */
export const linkWords = {
  label: "Go2Pay page link",
  example: "For example go2pay.gd/557",
  once: "A Go2Pay page can be linked only once. To fix a wrong link, make a new product in Go2Pay and paste its link.",
} as const;

/** Over Go2Pay's longest text: a warning, never a refusal (contract Design → Copy box). */
export const tooLong = (limit: number) =>
  `Longer than Go2Pay may accept (${limit} characters). Shorten it in Go2Pay or here.`;

/** The copy box rows and the length each is held to. */
export const copyRows = [
  { key: "title", label: "Title", limit: GO2PAY_TEXT_LIMITS.title },
  {
    key: "caption",
    label: "Description and donation caption",
    limit: GO2PAY_TEXT_LIMITS.caption,
  },
  {
    key: "receiptNote",
    label: "Note shown on receipt",
    limit: GO2PAY_TEXT_LIMITS.receiptNote,
  },
] as const;

/** A ticket's copy box: no donation box, so the description has its own limit. */
export const ticketCopyRows = [
  copyRows[0],
  {
    key: "description",
    label: "Description",
    limit: GO2PAY_TEXT_LIMITS.description,
  },
  copyRows[2],
] as const;

/** Season save and archive refusals (`SeasonEditor`). */
export const seasonRefusals = {
  name_taken: "Name: another season already has this name.",
  in_use: systemText.sguCodes.SGU08,
  conflict: staleScreen,
  unavailable: unavailableMessage("save"),
} as const;

/** The Payments screen's answers when Go2Pay could not be read (contract Failure Modes). */
export const gatewayWords = {
  off: "The Go2Pay key is off on this website, so payments can't be shown here. Use Go2Pay's own dashboard, or ask the site owner to add the key.",
  unauthorized:
    "The Go2Pay key doesn't work. Ask the site owner to make a new “Take payments only” key.",
  unreachable: "Go2Pay can't be reached right now. Try again in a few minutes.",
  too_broad:
    "Replace the Go2Pay key with a “Take payments only” key. This key can do more than take payments, so the website will not use it.",
  unreadable:
    "Go2Pay answered in a way the website does not understand, so no totals are shown (a missing order would hide money). Tell the developer.",
  partial: "Only part of the orders could be read; narrow the dates.",
} as const;

/**
 * A season's anchor read as a rule (D-78: the Hijri anchor stays the rule;
 * no Hijri date is shown): "Starts on 1 Ramadan, until the end of Ramadan",
 * "On 1 Shawwal", or "Days typed by the board".
 */
export function seasonRule(
  season: {
    hijri_month: number | null;
    hijri_first_day: number | null;
    hijri_last_day: number | null;
  },
  monthNames: readonly string[],
): string {
  const { hijri_month: month, hijri_first_day: first } = season;
  if (month === null || first === null) return "Days typed by the board";
  const name = monthNames[month - 1] ?? `month ${month}`;
  const last = season.hijri_last_day;
  if (last === first) return `On ${first} ${name}`;
  return `Starts on ${first} ${name}, until ${
    last === null ? `the end of ${name}` : `${last} ${name}`
  }`;
}

/** When a fund or ticket shows, in Gregorian days (D-78); null when blocked (its flag says why). */
export function windowWords(window: {
  from: string | null;
  until: string | null;
  blocked: string | null;
}): string | null {
  if (window.blocked) return null;
  if (window.from && window.until)
    return `Shows ${daysText(window.from, window.until)}`;
  if (window.from) return `Shows from ${longDay(window.from)}`;
  if (window.until) return `Shows until ${longDay(window.until)}`;
  return "Shows any day";
}
