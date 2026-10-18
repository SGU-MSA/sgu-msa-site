import {
  scheduleEndReminderDays,
  scheduleEndStatus,
  type ScheduleEndStatus,
} from "../prayer/congregation";
import {
  paymentItemFlags,
  paymentItemWindow,
  SEASON_RERUN_REMINDER_DAYS,
  zakatAlFitrLastDay,
} from "./payment-policy";
import {
  currentLinks,
  type Kind,
  type PaymentItem,
  type PaymentItemLink,
} from "./payments";
import type { PrayerSettings } from "./schema";
import { resolveSeason, seasonContext } from "./season-policy";
import type { Season } from "./seasons";
import {
  sizeLabel,
  storageLevel,
  storagePercent,
  STORAGE_LIMIT_LABEL,
} from "../media/storage-space";
import { longDateLabel, weekdayDateLabel } from "../time/date-label";
import { addDays, daysBetween } from "../time/days";

/**
 * What needs the board's attention today, and which warning email is due
 * (daily-check contract, D-13). One pure policy for the dashboard's "Needs
 * attention" box and the nightly email, so they never disagree. No env,
 * clock or Supabase: callers pass the facts and today's Grenada date.
 * Each fact's rule stays with its owner (iqamah: `scheduleEndStatus`;
 * season days: `resolveSeason`; ended and waiting funds: `paymentItemFlags`;
 * space: `storageLevel`).
 */

/** A season day still "expected": email 1 this many days before (stage 2). */
export const SEASON_CONFIRM_FIRST_DAYS = 3;
/** A deadline's last call goes this many days before it. */
export const LAST_CALL_DAYS_BEFORE = 1;
/** A problem with no deadline gets its last call this many nights after email 1. */
export const OPEN_LAST_CALL_AFTER_DAYS = 3;

export type EmailStep = "first" | "last_call";
/** The tag in each email line, so Gmail filters can forward one topic (D-15). */
export type AttentionTopic = "Prayer" | "Seasons" | "Go2Pay" | "Photos";

export type AttentionItem = Readonly<{
  /** Stable while the problem is the same; fixing it changes or removes it. */
  key: string;
  topic: AttentionTopic;
  timing:
    | { type: "deadline"; deadline: string; firstFrom: string }
    | { type: "open" };
  /** "Iqamah times end on Thu 15 Oct (in 7 days)". */
  title: string;
  /** One sentence of consequence (email only). */
  detail: string;
  /** The dashboard page that fixes it. */
  href: string;
  /** The dashboard link's words, without the arrow. */
  linkLabel: string;
}>;

/** A season day the board has not confirmed yet ("expected"), in its current or next occurrence. */
export type SeasonDayFact = Readonly<{
  seasonId: string;
  name: string;
  /** "day": a one-day season (an Eid); else its first or last day. */
  side: "first" | "last" | "day";
  day: string;
  hijriYear: number | null;
}>;
/** A shown fund or ticket whose dates ended: its Go2Pay page is closed by hand (PR6 D-72). */
export type ClosedFundFact = Readonly<{
  itemId: string;
  kind: Kind;
  name: string;
  endedOn: string;
}>;
/** A shown fund or ticket waiting for "Running again" near its season (PR6 D-14). */
export type RerunFact = Readonly<{
  itemId: string;
  kind: Kind;
  name: string;
  seasonName: string;
  seasonStarts: string;
  seasonYear: number | null;
}>;

/**
 * The facts the policy reads; "unavailable" when they could not be read
 * (the dashboard then lists the rest; the nightly check sends nothing).
 */
export type AttentionFacts = Readonly<{
  prayer: ScheduleEndStatus | "unavailable";
  seasons: readonly SeasonDayFact[] | "unavailable";
  closedFunds: readonly ClosedFundFact[] | "unavailable";
  reruns: readonly RerunFact[] | "unavailable";
  /** Bytes the uploaded photos and PDFs take. */
  storage: { bytes: number } | "unavailable";
}>;

/** What the dashboard and the nightly check read, each null when it could not be read. */
export type AttentionReads = {
  prayer: Pick<PrayerSettings, "valid_until" | "hijri_adjustment"> | null;
  /** Current seasons and the funds and tickets visitors can see, with their links. */
  giving: {
    seasons: readonly Season[];
    items: readonly PaymentItem[];
    links: readonly PaymentItemLink[];
  } | null;
  storageBytes: number | null;
};

/**
 * The season days still "expected" and the funds and tickets to act on, from
 * their owners' rules. Only shown ("listed"), current items count, so the
 * dashboard (which reads every item) and the nightly check (which reads what
 * visitors can) list the same ones.
 */
function givingFacts(
  giving: NonNullable<AttentionReads["giving"]>,
  adjustment: PrayerSettings["hijri_adjustment"],
  today: string,
): Pick<AttentionFacts, "seasons" | "closedFunds" | "reruns"> {
  const seasons: SeasonDayFact[] = [];
  for (const season of giving.seasons) {
    const dates = resolveSeason(season, today, adjustment);
    if (dates.state !== "dates") continue;
    const fact = (side: SeasonDayFact["side"], day: string) =>
      seasons.push({
        seasonId: season.id,
        name: season.name,
        side,
        day,
        hijriYear: dates.hijriYear,
      });
    if (dates.first === dates.last) {
      if (dates.firstStatus === "expected") fact("day", dates.first);
      continue;
    }
    if (dates.firstStatus === "expected") fact("first", dates.first);
    if (dates.lastStatus === "expected") fact("last", dates.last);
  }
  const resolved = seasonContext(giving.seasons, today, adjustment);
  const zakatLastDay = zakatAlFitrLastDay(giving.seasons, today, adjustment);
  const links = currentLinks(giving.links);
  const closedFunds: ClosedFundFact[] = [];
  const reruns: RerunFact[] = [];
  const seasonName = new Map(giving.seasons.map((s) => [s.id, s.name]));
  for (const item of giving.items) {
    if (!item.listed || (item as { archived_at?: string | null }).archived_at)
      continue;
    const window = paymentItemWindow(
      item,
      item.season_id ? (resolved.get(item.season_id) ?? null) : null,
      zakatLastDay,
    );
    for (const flag of paymentItemFlags(
      item,
      links.get(item.id) ?? null,
      window,
      today,
    )) {
      if (flag.code === "ended")
        closedFunds.push({
          itemId: item.id,
          kind: item.kind,
          name: item.name,
          endedOn: flag.on,
        });
      if (flag.code === "waiting_rerun" && flag.reminder && window.season)
        reruns.push({
          itemId: item.id,
          kind: item.kind,
          name: item.name,
          seasonName: seasonName.get(item.season_id) ?? "",
          seasonStarts: window.season.first,
          seasonYear: window.seasonYear,
        });
    }
  }
  return { seasons, closedFunds, reruns };
}

/**
 * The facts from what was read. The dashboard and the nightly route both
 * build their facts here. Season days and funds need the Hijri adjustment,
 * so they are unavailable when the prayer settings are.
 */
export function attentionFacts(
  reads: AttentionReads,
  today: string,
): AttentionFacts {
  const giving =
    reads.giving && reads.prayer
      ? givingFacts(reads.giving, reads.prayer.hijri_adjustment, today)
      : null;
  return {
    prayer: reads.prayer
      ? scheduleEndStatus(reads.prayer, today)
      : "unavailable",
    seasons: giving?.seasons ?? "unavailable",
    closedFunds: giving?.closedFunds ?? "unavailable",
    reruns: giving?.reruns ?? "unavailable",
    storage:
      reads.storageBytes === null
        ? "unavailable"
        : { bytes: reads.storageBytes },
  };
}

/** Whether any fact could not be read (the nightly check then sends nothing). */
export function factsUnavailable(facts: AttentionFacts): boolean {
  return Object.values(facts).some((fact) => fact === "unavailable");
}

/** Key → step → the Grenada date that email was sent. */
export type SentSteps = ReadonlyMap<string, Partial<Record<EmailStep, string>>>;
export type DueEmail = { item: AttentionItem; step: EmailStep };

function inDays(days: number) {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

function iqamahItem(status: ScheduleEndStatus, today: string) {
  if (status.state === "none") return [];
  const { end } = status;
  const title =
    status.state === "ended"
      ? `Iqamah times ended on ${weekdayDateLabel(end)} — update them`
      : `Iqamah times end on ${weekdayDateLabel(end)} (${inDays(daysBetween(today, end))})`;
  const item: AttentionItem = {
    // A new end date is a new problem (and a fresh pair of emails).
    key: `iqamah:${end}`,
    topic: "Prayer",
    timing: {
      type: "deadline",
      deadline: end,
      firstFrom: addDays(end, -scheduleEndReminderDays),
    },
    title,
    detail: "After that day the website stops showing iqamah times.",
    href: "/admin/prayer-times",
    linkLabel: "Open Prayer & iqamah",
  };
  return [item];
}

const sideWords: Record<SeasonDayFact["side"], (name: string) => string> = {
  day: (name) => name,
  first: (name) => `${name}’s first day`,
  last: (name) => `${name}’s last day`,
};

/** W2: from 3 days before an "expected" season day until that day. */
function seasonItems(facts: readonly SeasonDayFact[], today: string) {
  return facts.flatMap((fact): AttentionItem[] => {
    const firstFrom = addDays(fact.day, -SEASON_CONFIRM_FIRST_DAYS);
    if (today < firstFrom || today > fact.day) return [];
    return [
      {
        key: `season:${fact.seasonId}:${fact.side}:${fact.hijriYear ?? fact.day}`,
        topic: "Seasons",
        timing: { type: "deadline", deadline: fact.day, firstFrom },
        title: `${sideWords[fact.side](fact.name)} is still “expected” on ${longDateLabel(fact.day)}`,
        detail: "Confirm the day once the moon is announced.",
        href: `/admin/seasons/${fact.seasonId}`,
        linkLabel: `Open ${fact.name}`,
      },
    ];
  });
}

const itemPage = (kind: Kind, id: string) =>
  `/admin/payments/${kind === "fund" ? "funds" : "tickets"}/${id}`;
const itemWord = (kind: Kind) => (kind === "fund" ? "fund" : "ticket");

/** W4: an ended fund or ticket, while its board list says "close it in Go2Pay". */
function closedItems(facts: readonly ClosedFundFact[]) {
  return facts.map((fact): AttentionItem => ({
    // A new end day (after running again) is a new problem.
    key: `close-in-go2pay:${fact.itemId}:${fact.endedOn}`,
    topic: "Go2Pay",
    timing: { type: "open" },
    title: `“${fact.name}” ended on ${weekdayDateLabel(fact.endedOn)}: close its Go2Pay page`,
    detail:
      "Until it is closed in Go2Pay, old shared links still take payments.",
    href: itemPage(fact.kind, fact.itemId),
    linkLabel: `Open the ${itemWord(fact.kind)}`,
  }));
}

/** W6: from 45 days before the season, a fund or ticket still waiting for "Running again". */
function rerunItems(facts: readonly RerunFact[], today: string) {
  return facts.map((fact): AttentionItem => ({
    key: `rerun:${fact.itemId}:${fact.seasonYear ?? fact.seasonStarts}`,
    topic: "Seasons",
    timing: {
      type: "deadline",
      deadline: fact.seasonStarts,
      firstFrom: addDays(fact.seasonStarts, -SEASON_RERUN_REMINDER_DAYS),
    },
    title: `“${fact.name}” is waiting for “Running again”: ${fact.seasonName} ${fact.seasonStarts < today ? "started" : "starts"} on ${longDateLabel(fact.seasonStarts)}`,
    detail: `Until “Running again” is ticked, the ${itemWord(fact.kind)} stays closed this season.`,
    href: itemPage(fact.kind, fact.itemId),
    linkLabel: `Open the ${itemWord(fact.kind)}`,
  }));
}

/** Photo space at 80% or 95% full: one item, for the highest level reached. */
function storageItem(bytes: number): AttentionItem[] {
  const level = storageLevel(bytes);
  if (!level) return [];
  return [
    {
      key: `storage:${level}`,
      topic: "Photos",
      timing: { type: "open" },
      title: `Photo space is ${storagePercent(bytes)}% full (${sizeLabel(bytes)} of ${STORAGE_LIMIT_LABEL})`,
      detail:
        "When it is full, no more photos or PDFs can be uploaded. Delete the ones nothing uses.",
      href: "/admin/photos",
      linkLabel: "Open Photos",
    },
  ];
}

/** Everything that needs attention today, in a fixed order. */
export function attentionItems(
  facts: AttentionFacts,
  today: string,
): AttentionItem[] {
  const listed = <T>(
    fact: T | "unavailable",
    items: (fact: T) => AttentionItem[],
  ) => (fact === "unavailable" ? [] : items(fact));
  return [
    ...listed(facts.prayer, (prayer) => iqamahItem(prayer, today)),
    ...listed(facts.seasons, (seasons) => seasonItems(seasons, today)),
    ...listed(facts.closedFunds, closedItems),
    ...listed(facts.reruns, (reruns) => rerunItems(reruns, today)),
    ...listed(facts.storage, ({ bytes }) => storageItem(bytes)),
  ];
}

function dueStep(
  item: AttentionItem,
  sent: Partial<Record<EmailStep, string>>,
  today: string,
): EmailStep | null {
  if (sent.last_call) return null;
  if (item.timing.type === "deadline") {
    const { deadline, firstFrom } = item.timing;
    // After the deadline: the dashboard only (D-3).
    if (today > deadline || today < firstFrom) return null;
    // A missed email 1 is skipped once the last call is due (catch-up).
    if (today >= addDays(deadline, -LAST_CALL_DAYS_BEFORE)) return "last_call";
    return sent.first ? null : "first";
  }
  if (!sent.first) return "first";
  return daysBetween(sent.first, today) >= OPEN_LAST_CALL_AFTER_DAYS
    ? "last_call"
    : null;
}

/** The emails due tonight: at most one step per item, never one already sent (D-13). */
export function emailsDue(
  items: readonly AttentionItem[],
  sent: SentSteps,
  today: string,
): DueEmail[] {
  return items.flatMap((item) => {
    const step = dueStep(item, sent.get(item.key) ?? {}, today);
    return step ? [{ item, step }] : [];
  });
}

/** One plain-text email listing every due warning (approved wording, Q20 A). */
export function warningEmail(
  due: readonly DueEmail[],
  siteUrl: string,
): { subject: string; text: string } {
  const count = due.length;
  const subject = `SGU MSA website: ${count} ${count === 1 ? "thing needs" : "things need"} attention`;
  const lines = due.map(
    ({ item }, index) =>
      `${index + 1}. [${item.topic}] ${item.title}. ${item.detail}\n` +
      `   Fix it: ${siteUrl}${item.href}`,
  );
  const text = [
    ...lines,
    "Sent to the MSA Gmail by the website's nightly check.\nIt only writes when something needs fixing.",
  ].join("\n\n");
  return { subject, text: `${text}\n` };
}
