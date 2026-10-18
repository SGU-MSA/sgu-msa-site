import {
  COUNTED_STATUSES,
  GO2PAY_LINK_ERROR,
  parseGo2PayLink,
  readyToList,
} from "@/lib/community/payment-policy";
import {
  categories,
  paymentItemSchema,
  type Category,
  type Kind,
  type PaymentItem,
  type PaymentItemLink,
} from "@/lib/community/payments";
import {
  BOARD_DATE_REACH_DAYS,
  latestStartedSpan,
  resolveSeason,
  type SeasonDates,
} from "@/lib/community/season-policy";
import { seasonSchema, type Season } from "@/lib/community/seasons";
import type { PrayerSettings } from "@/lib/community/schema";
import { dateSchema } from "@/lib/validation/date-time";
import { addDays } from "@/lib/time/days";
import { shortDateLabel } from "@/lib/time/date-label";
import { outOfDate } from "@/lib/system-text";
import {
  problemsOf,
  withProblems,
  type FieldProblems,
} from "./form-check/problems";
import { daysText, longDay, notReady } from "./payment-words";

/**
 * The typed values of the Funds, Tickets and Seasons forms as rows, and the
 * Payments filters (PR6 WP-5, WP-6, WP-7). Pure, so the server actions and
 * the tests share one reading of a form. The database stays the authority.
 */

/**
 * The Hijri year of the season occurrence an item runs for (D-14): a new
 * season tie takes the current occurrence; an item waiting for "Running
 * again" keeps its old year until the box is ticked. Typed-day seasons and
 * items without a season have none.
 */
export function seasonYearFor(input: {
  before: Pick<PaymentItem, "season_id" | "season_year"> | null;
  seasonId: string;
  rerun: boolean;
  season: SeasonDates | null;
}): number | null {
  if (!input.seasonId) return null;
  const current =
    input.season?.state === "dates" ? input.season.hijriYear : null;
  const before = input.before;
  if (!before || before.season_id !== input.seasonId) return current;
  if (before.season_year === null || current === null) return current;
  if (before.season_year === current) return current;
  return input.rerun ? current : before.season_year;
}

export type ItemForm =
  | { ok: true; row: PaymentItem; link: number | null }
  | { ok: false; fields: FieldProblems };

/** What a fund or ticket form needs to know about the saved item (null when new). */
export type ItemBefore = Pick<
  PaymentItem,
  "category" | "position" | "season_id" | "season_year"
> & { first_shown_at: string | null };

/**
 * A fund or ticket as typed: the row to save and the Go2Pay product to link
 * (null keeps the current link). A locked category is taken from the saved
 * row, never from the form. A ticket is always General with no heading and
 * no season.
 */
export function itemFromForm(input: {
  values: Record<string, string>;
  kind: Kind;
  slug: string;
  before: ItemBefore | null;
  currentLink: PaymentItemLink | null;
  season: SeasonDates | null;
}): ItemForm {
  const { values, kind, before } = input;
  // Each box keeps its first problem (review 2: shown on the box).
  const problems: FieldProblems = {};
  const problem = (box: string, message: string) => {
    problems[box] ??= message;
  };
  const locked = Boolean(before?.first_shown_at);
  const typedCategory = values.category ?? "";
  const category: Category | "" =
    kind === "priced"
      ? "general"
      : locked && before
        ? before.category
        : (categories as readonly string[]).includes(typedCategory)
          ? (typedCategory as Category)
          : "";
  if (!category) problem("category", "Category: choose one.");

  // The link: empty keeps the current one; the current one again is no change.
  const typedLink = (values.link ?? "").trim();
  let link: number | null = null;
  if (typedLink) {
    const parsed = parseGo2PayLink(typedLink);
    if (!parsed.ok) problem("link", GO2PAY_LINK_ERROR);
    else if (parsed.id !== input.currentLink?.go2pay_product_id)
      link = parsed.id;
  }
  const rerun = kind === "fund" && values.rerun === "on";
  if (rerun) {
    if (values.rerun_link !== "same" && values.rerun_link !== "new")
      problem(
        "rerun_link",
        "Running again: choose whether to keep the same Go2Pay page or paste a new one.",
      );
    else if (values.rerun_link === "new" && link === null)
      problem("link", "Go2Pay page link: paste the new page's link.");
  }

  // The order is set by dragging on the list (review fixes PR-2): a saved
  // item keeps its place; a new one takes the number the screen gave it.
  const position =
    before?.position ?? Number(values.position?.trim() || Number.NaN);
  if (!Number.isSafeInteger(position)) problem("position", outOfDate);

  const seasonId = kind === "fund" ? (values.season_id ?? "") : "";
  const parsed = paymentItemSchema.safeParse({
    id: values.id,
    slug: input.slug,
    name: values.name ?? "",
    kind,
    category: category || "general",
    about: values.about ?? "",
    heading: kind === "fund" ? (values.heading ?? "") : "",
    listed: values.listed === "on",
    position: Number.isSafeInteger(position) ? position : 0,
    season_id: seasonId,
    season_year: seasonYearFor({
      before,
      seasonId,
      rerun,
      season: input.season,
    }),
    shows_from: values.shows_from ?? "",
    shows_until: values.shows_until ?? "",
    first_shown_at: before?.first_shown_at ?? null,
    // A merch size (PR5c): sold like a ticket, under its merch item.
    merch_item_id: kind === "priced" ? (values.merch_item_id ?? "") : "",
    size_label: kind === "priced" ? (values.size_label ?? "") : "",
  });
  if (!parsed.success || Object.keys(problems).length)
    return {
      ok: false,
      fields: parsed.success
        ? problems
        : withProblems(problems, problemsOf(parsed.error)),
    };
  if (parsed.data.listed) {
    const ready = readyToList(
      parsed.data,
      link !== null
        ? {
            go2pay_product_id: link,
            payment_item_id: parsed.data.id,
            added_at: "",
          }
        : input.currentLink,
    );
    if (!ready.ok)
      return {
        ok: false,
        fields: Object.fromEntries(
          ready.missing.map((missing) => [missing, notReady[missing]]),
        ),
      };
  }
  return { ok: true, row: parsed.data, link };
}

const wholeNumber = (value: string | undefined) =>
  value?.trim() ? Number(value) : null;

/** The schedule rows as posted (JSON), or null when they cannot be read. */
function postedSchedule(text: string | undefined): unknown[] | null {
  try {
    const rows: unknown = JSON.parse(text || "[]");
    return Array.isArray(rows) ? rows : null;
  } catch {
    return null;
  }
}

/**
 * A season as typed: an Islamic month with its from and until days (until
 * empty = the end of the month) and optional confirmed days, or typed
 * calendar days; and its public page (PR5c): "Give it its own page", the
 * introduction, the schedule rows (posted as JSON), the sign-up form. The
 * photos are checked and stored on their own (`photoListForm`) and passed
 * in as `photos` once stored; the address (`slug`) is the database's.
 */
export function seasonFromForm(
  values: Record<string, string>,
  photos: Season["photos"] = [],
): { ok: true; row: Season } | { ok: false; fields: FieldProblems } {
  const islamic = values.calendar !== "typed";
  const schedule = postedSchedule(values.schedule);
  if (!schedule) return { ok: false, fields: { schedule: outOfDate } };
  const parsed = seasonSchema.safeParse({
    id: values.id,
    name: values.name ?? "",
    hijri_month: islamic ? wholeNumber(values.hijri_month) : null,
    hijri_first_day: islamic ? wholeNumber(values.hijri_first_day) : null,
    hijri_last_day: islamic ? wholeNumber(values.hijri_last_day) : null,
    board_starts_on: values.board_starts_on ?? "",
    board_ends_on: values.board_ends_on ?? "",
    has_page: values.has_page === "on",
    intro: values.intro ?? "",
    schedule,
    sign_up_form: values.sign_up_form ?? "",
    photos,
  });
  return parsed.success
    ? { ok: true, row: parsed.data }
    : { ok: false, fields: problemsOf(parsed.error) };
}

/** The Payments "Status" filter: every counted status, or one (D-64). */
export const statusFilters = [
  ["all", "Paid and refunds"],
  ["PAID", "Paid"],
  ["PARTIAL REFUND", "Partly refunded"],
  ["REFUNDED", "Refunded"],
] as const satisfies readonly (readonly [
  "all" | (typeof COUNTED_STATUSES)[number],
  string,
])[];
export type StatusFilter = (typeof statusFilters)[number][0];

/** The default date range: the last 30 days (D-39). */
export const DEFAULT_RANGE_DAYS = 30;

/** A season choice of the Payments filter: its latest started occurrence. */
export type SeasonRange = {
  id: string;
  label: string;
  first: string;
  last: string;
};

/** Each season's latest started occurrence, as a filter choice ("Ramadan 2026 (18 Feb – 19 Mar)"). */
export function seasonRanges(
  seasons: readonly Season[],
  today: string,
  adjustment: PrayerSettings["hijri_adjustment"] | null,
): SeasonRange[] {
  return seasons.flatMap((season) => {
    const span = latestStartedSpan(season, today, adjustment);
    return span
      ? [
          {
            id: season.id,
            label: `${season.name} ${span.first.slice(0, 4)} (${shortDateLabel(span.first)} – ${shortDateLabel(span.last)})`,
            ...span,
          },
        ]
      : [];
  });
}

export type MoneyFilters = {
  from: string;
  until: string;
  /** The chosen season's id, or "". */
  season: string;
  category: Category | "";
  /** A fund or ticket id, or "". */
  item: string;
  status: StatusFilter;
};

const one = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : "";
const day = (value: string) =>
  dateSchema.safeParse(value).success ? value : "";

/**
 * The Payments filters from the address (`?from=&until=&season=&category=
 * &item=&status=`), so the CSV link carries the same choice. A season
 * replaces the days; days in the wrong order are swapped; anything unknown
 * falls back to the last 30 days, every category and status.
 */
export function moneyFilters(
  query: Record<string, string | string[] | undefined>,
  today: string,
  seasons: readonly SeasonRange[],
): MoneyFilters {
  const season = seasons.find((s) => s.id === one(query.season));
  let from = season?.first ?? day(one(query.from));
  let until = season?.last ?? day(one(query.until));
  if (!from) from = addDays(today, 1 - DEFAULT_RANGE_DAYS);
  if (!until) until = today;
  if (until < from) [from, until] = [until, from];
  const category = one(query.category);
  const status = one(query.status);
  return {
    from,
    until,
    season: season?.id ?? "",
    category: (categories as readonly string[]).includes(category)
      ? (category as Category)
      : "",
    item: /^[0-9a-f-]{36}$/i.test(one(query.item)) ? one(query.item) : "",
    status: statusFilters.some(([value]) => value === status)
      ? (status as StatusFilter)
      : "all",
  };
}

/** The address of the same filters (the CSV link). */
export function moneyQuery(filters: MoneyFilters): string {
  const params = new URLSearchParams();
  if (filters.season) params.set("season", filters.season);
  else {
    params.set("from", filters.from);
    params.set("until", filters.until);
  }
  if (filters.category) params.set("category", filters.category);
  if (filters.item) params.set("item", filters.item);
  if (filters.status !== "all") params.set("status", filters.status);
  return params.toString();
}

type Adjustment = PrayerSettings["hijri_adjustment"] | null;

/** What the season's days look like for the typed values (Gregorian only, D-78). */
export type SeasonPreview = {
  /** "Mon 8 Feb – Mon 8 Mar 2027", or null when unknown. */
  expected: string | null;
  /** The expected first and last day, for the confirm boxes' hints. */
  expectedFirst: string | null;
  expectedLast: string | null;
  /** The days in force with their badges ("confirmed", "expected"), or null. */
  resolved: string | null;
  /** A confirmed day further than 5 days from the expected one is ignored as last year's. */
  ignored: boolean;
};

/** A season's page fields, which the days do not depend on. */
const noPage = {
  slug: "",
  has_page: false,
  intro: "",
  schedule: [],
  sign_up_form: "",
  photos: [],
} satisfies Partial<Season>;

/** The season the typed values describe, or null while incomplete. */
function typedSeason(values: Record<string, string>): Season | null {
  const month = Number(values.hijri_month);
  const first = Number(values.hijri_first_day);
  const last = values.hijri_last_day ? Number(values.hijri_last_day) : null;
  if (values.calendar === "typed")
    return values.board_starts_on && values.board_ends_on
      ? {
          id: values.id,
          name: values.name,
          hijri_month: null,
          hijri_first_day: null,
          hijri_last_day: null,
          board_starts_on: values.board_starts_on,
          board_ends_on: values.board_ends_on,
          ...noPage,
        }
      : null;
  if (!(month >= 1 && month <= 12 && first >= 1 && first <= 30)) return null;
  if (last !== null && last < first) return null;
  return {
    id: values.id,
    name: values.name,
    hijri_month: month,
    hijri_first_day: first,
    hijri_last_day: last,
    board_starts_on: values.board_starts_on ?? "",
    board_ends_on: values.board_ends_on ?? "",
    ...noPage,
  };
}

/** The preview for typed values; the page computes the first one on the server. */
export function seasonPreview(
  values: Record<string, string>,
  today: string,
  adjustment: Adjustment,
): SeasonPreview {
  const none = {
    expected: null,
    expectedFirst: null,
    expectedLast: null,
    resolved: null,
    ignored: false,
  };
  const season = typedSeason(values);
  if (!season) return none;
  const expected = resolveSeason(
    { ...season, board_starts_on: "", board_ends_on: "" },
    today,
    adjustment,
  );
  const actual = resolveSeason(season, today, adjustment);
  const islamic = season.hijri_month !== null;
  return {
    expected:
      islamic && expected.state === "dates"
        ? daysText(expected.first, expected.last)
        : null,
    expectedFirst:
      islamic && expected.state === "dates" ? expected.first : null,
    expectedLast: islamic && expected.state === "dates" ? expected.last : null,
    resolved:
      actual.state === "dates"
        ? `${longDay(actual.first)} (${actual.firstStatus}) – ${longDay(actual.last)} (${actual.lastStatus})`
        : null,
    ignored: actual.state === "dates" && actual.boardDayIgnored,
  };
}

/**
 * The days a confirmed day of an Islamic season can be (review fixes P4, the
 * plan's ±5 days): within `BOARD_DATE_REACH_DAYS` of the expected day, or
 * null while the expected day is not known.
 */
export function confirmedDayReach(
  expected: string | null,
): { from: string; until: string } | null {
  return expected
    ? {
        from: addDays(expected, -BOARD_DATE_REACH_DAYS),
        until: addDays(expected, BOARD_DATE_REACH_DAYS),
      }
    : null;
}

/** "Choose a day from Fri 27 Feb to Wed 11 Mar 2026." */
export const confirmedDayHint = (reach: { from: string; until: string }) =>
  `Choose a day from ${daysText(reach.from, reach.until).replace(" – ", " to ")}.`;

/** On a confirmed day typed outside its reach; the hint under the box names the days. */
export const confirmedDayOutOfReach = `Choose a day within ${BOARD_DATE_REACH_DAYS} days of the expected day.`;

/**
 * A confirmed day typed outside its reach (the date picker greys those out;
 * a day typed by keyboard is caught here, before saving), on its box. The
 * save action runs the same check.
 */
export function confirmedDayProblems(
  values: Record<string, string>,
  preview: Pick<SeasonPreview, "expectedFirst" | "expectedLast">,
): FieldProblems {
  if (values.calendar === "typed") return {};
  const problems: FieldProblems = {};
  for (const [box, expected] of [
    ["board_starts_on", preview.expectedFirst],
    ["board_ends_on", preview.expectedLast],
  ] as const) {
    const reach = confirmedDayReach(expected);
    const day = values[box];
    if (reach && day && (day < reach.from || day > reach.until))
      problems[box] = confirmedDayOutOfReach;
  }
  return problems;
}

/**
 * A stored confirmed day as the season form starts: empty when it is out of
 * reach of this occurrence's expected day (last year's, which the rules
 * ignore), so the box never starts with a day it would not accept.
 */
export function startingConfirmedDay(
  stored: string | undefined,
  expected: string | null,
): string {
  const reach = confirmedDayReach(expected);
  return stored && (!reach || (stored >= reach.from && stored <= reach.until))
    ? stored
    : "";
}
