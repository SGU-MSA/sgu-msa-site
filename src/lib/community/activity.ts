import { z } from "../validation/zod";
import { isPageTextKey } from "../content/documents";
import { pageFields, pageSectionTitle } from "../content/page-fields";
import { isLayoutKey, storedSections } from "../content/page-layouts";
import { systemText } from "../system-text";
import { dateSchema, timeSchema } from "../validation/date-time";
import { formatTimeOfDay } from "../time/time-of-day";
import { CATEGORIES, productLabel } from "./payment-policy";
import type { Category } from "./payments";
import { TIMEZONE } from "./schema";

/**
 * The add-only activity log (PR3 contract, ADR 0013). Database triggers write
 * it (`supabase/migrations/202610150001_schema.sql`, the authority); the
 * app only reads it. Pure: no clock, no I/O.
 */

export const activityActions = [
  "created",
  "updated",
  "archived",
  "restored",
  "deleted",
  "access_granted",
  "access_changed",
] as const;
export type ActivityAction = (typeof activityActions)[number];

/** What the log stores instead of a personal value (D-5). */
export const privateValue = "[private]";

const snapshot = z.record(z.string(), z.unknown()).nullable();

/** One `activity_log` row. `area` is the table name; `actor` null = site owner or the database. */
export const activityEntrySchema = z.object({
  id: z.number().int(),
  occurred_at: z.string(),
  actor: z.uuid().nullable(),
  area: z.string().min(1),
  record_id: z.string(),
  action: z.enum(activityActions),
  before: snapshot,
  after: snapshot,
  highlight: z.boolean(),
});
export type ActivityRow = z.infer<typeof activityEntrySchema>;

/**
 * A log entry as read: the actor's name comes from People when read (D-5);
 * null when the actor is null (site owner) or no longer in People.
 */
export type ActivityEntry = ActivityRow & { actorName: string | null };

const areaNames: Record<string, string> = {
  events: "event",
  announcements: "announcement",
  news_posts: "news post",
  newsletters: "newsletter",
  prayer_settings: "prayer settings",
  musallah_location: "musallah location",
  people: "People entry",
  people_sections: "team group",
  admins: "dashboard access",
  handover_steps: "New board term step",
  shared_logins: "shared login",
  page_texts: "page text",
  // PR6: giving.
  payment_items: "fund or ticket",
  payment_item_links: "Go2Pay link",
  seasons: "season",
  // PR5c: merch.
  merch_collections: "merch collection",
  merch_items: "merch item",
};
const verbs: Record<ActivityAction, string> = {
  created: "Added",
  updated: "Edited",
  archived: "Archived",
  restored: "Restored",
  deleted: "Permanently deleted",
  access_granted: "Granted",
  access_changed: "Changed",
};
const fieldNames: Record<string, string> = {
  title: "Title",
  summary: "Summary",
  body: "Text",
  date: "Date",
  expires_on: "Expires on",
  start_time: "Start time",
  end_time: "End time",
  location: "Location",
  url: "Link",
  image_path: "Cover image",
  image_alt: "Image description",
  file_path: "PDF file",
  published: "Published",
  featured: "Featured",
  archived_at: "Archived",
  full_name: "Name",
  role_title: "Role",
  section_id: "Group",
  position: "Order",
  show_on_public: "Show on public page",
  photo_path: "Photo",
  name: "Name",
  can_manage_people: "Manage people",
  can_manage_money: "Manage money",
  deactivated_at: "Login turned off",
  // Retired prayer columns (ADR 0017) keep their names for older entries.
  confirmed: "Calculations confirmed",
  method: "Calculation method",
  madhab: "Asr convention",
  adjustments: "Prayer time adjustments",
  hijri_adjustment: "Hijri date adjustment",
  jumuah: "Jumu'ah",
  iqamah_offsets: "Iqamah offsets",
  exceptions: "Exceptions",
  valid_from: "Valid from",
  valid_until: "Valid until",
  fajr: "Fajr",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
  khutbah: "Khutbah",
  jummah_iqamah: "Jumu'ah iqamah",
  // Review fixes P2: the weekly Jumu'ah prayers.
  jumuah_sessions: "Jumu'ah prayers",
  jummah_location: "Jumu'ah location",
  notice: "Notice",
  latitude: "Latitude",
  longitude: "Longitude",
  // PR5a: urgent notices, event status, New board term.
  urgent_until: "Hide at",
  status: "Is it still happening?",
  status_note: "Reason",
  // Review 2: an event's last day.
  end_date: "End date",
  // PR6: an event's ticket.
  ticket_payment_item_id: "Ticket",
  details: "Details",
  link: "Dashboard page",
  done_on: "Done on",
  service: "Account",
  holder_person_id: "Holder",
  second_factor_person_id: "2-step phone",
  last_changed_on: "Last changed",
  note: "Note",
  // PR6: funds, tickets, their Go2Pay links and seasons.
  slug: "Give link",
  kind: "Kind",
  category: "Category",
  about: "About",
  heading: "Heading",
  listed: "Shown",
  season_id: "Season",
  season_year: "Season year",
  shows_from: "Show from",
  shows_until: "Show until",
  first_shown_at: "Category locked",
  go2pay_product_id: "Go2Pay page",
  payment_item_id: "Fund or ticket",
  hijri_month: "Islamic month",
  hijri_first_day: "From day",
  hijri_last_day: "Until day",
  board_starts_on: "First day",
  board_ends_on: "Last day",
  // Review fixes PR-2: a group's start answer for new people.
  shown_by_default: "New people start shown",
  // PR5c: season pages, an event's season, merch.
  has_page: "Own page",
  intro: "Introduction",
  schedule: "Schedule",
  sign_up_form: "Sign-up form",
  photos: "Photos",
  era: "On sale now",
  arabic: "Arabic name",
  quote: "Quote",
  year: "Year",
  description: "Description",
  garment: "Garment",
  colorway: "Colour",
  collection_id: "Collection",
  merch_item_id: "Merch item",
  size_label: "Size",
};
// Keys and bookkeeping columns, never shown as a change. A restore's
// `restored_from` is told by its own line instead (review 3 D).
const unshown = new Set([
  "id",
  "created_at",
  "updated_at",
  "user_id",
  "person_id",
  "added_at",
  "restored_from",
]);

const sentence = (key: string) =>
  fieldNames[key] ??
  key.charAt(0).toUpperCase() + key.slice(1).replaceAll("_", " ");

/** A stored value as plain text, never raw JSON. "" for empty. */
function format(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  // A stored 24-hour time reads on the 12-hour clock, as everywhere else.
  if (typeof value === "string" && timeSchema.safeParse(value).success)
    return formatTimeOfDay(value);
  if (Array.isArray(value)) return value.map(format).join("; ");
  if (typeof value === "object")
    return Object.entries(value)
      .map(([key, item]) => `${sentence(key)}: ${format(item)}`)
      .join(", ");
  return String(value);
}

export type ChangedField = {
  name: string;
  /** Plain text; null when the side does not exist (created/deleted) or is hidden. */
  before: string | null;
  after: string | null;
  /** A personal value the log does not keep (D-4, D-5): show "changed" only. */
  hidden: boolean;
};

/**
 * Display names for ids an entry only refers to: People entries (for People
 * and access entries, whose own name the log does not keep, D-5) and team
 * groups (for a person's group). Looked up in People when read.
 */
export type ActivityNames = ReadonlyMap<string, string>;

/** A group id that is not in `names`: deleted, or names could not be loaded. */
export const unknownSection = "(unknown group)";

// Timestamps that mean "yes, since then" (archived, login turned off).
const stamps = new Set(["archived_at", "deactivated_at", "first_shown_at"]);
// Ids of rows that have a name (a fund's season, a link's fund): the name when read.
const namedColumns = new Set([
  "season_id",
  "payment_item_id",
  "collection_id",
  "merch_item_id",
]);
/** A fund's or ticket's kind as the board reads it (PR6). */
const kindNames: Record<string, string> = {
  fund: "Fund",
  priced: "Ticket or merch",
};
// Exact times shown in Grenada time.
const instants = new Set(["urgent_until"]);
// People named by id (a shared login's holders): their People name when read.
const personColumns = new Set(["holder_person_id", "second_factor_person_id"]);

const changesOnlyAreas = new Set(["people", "admins"]);

/** The item an entry is about, as text: a content title or section name, else its current People name. */
function subjectOf(entry: ActivityRow, names: ActivityNames): string | null {
  if (changesOnlyAreas.has(entry.area))
    return names.get(entry.record_id) ?? null;
  // A page text is named by its page (PR5b).
  if (entry.area === "page_texts")
    return isPageTextKey(entry.record_id)
      ? pageFields[entry.record_id].title
      : entry.record_id;
  const row = entry.after ?? entry.before ?? {};
  const own = row.title ?? row.name ?? row.service;
  if (typeof own === "string" && own !== "") return own;
  // A Go2Pay link row has no name of its own: its fund's or ticket's (PR6).
  const item = row.payment_item_id;
  return typeof item === "string" ? (names.get(item) ?? null) : null;
}

/** A stored time the log can show, or null (missing, or not a time). */
const loggedTime = (value: unknown) =>
  typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;

/**
 * The version a History restore put back (review 3 D): the time of that
 * version when the entry is a restore, else null. A restore is a save that
 * sets `restored_from`; every other save clears it. Restoring the same
 * version twice in a row keeps `restored_from` but is still a new save (a
 * new `updated_at`).
 */
export function restoredVersion(entry: ActivityRow): string | null {
  if (entry.action !== "updated") return null;
  const to = loggedTime(entry.after?.restored_from);
  const saved =
    to !== entry.before?.restored_from ||
    entry.after?.updated_at !== entry.before?.updated_at;
  return to && saved ? to : null;
}

/**
 * A readable summary of one entry: a label ("Edited event"), the item it is
 * about (null when unknown, for example a permanently deleted person), the
 * fields that changed with before → after, and for a History restore the
 * time of the version it put back (`restoredFrom`). Personal values are
 * hidden (D-4, D-5).
 */
export function describeChange(
  entry: ActivityRow,
  names: ActivityNames,
): {
  label: string;
  subject: string | null;
  fields: ChangedField[];
  restoredFrom: string | null;
} {
  const restoredFrom = restoredVersion(entry);
  const verb = verbs[restoredFrom ? "restored" : entry.action];
  const label = `${verb} ${areaNames[entry.area] ?? sentence(entry.area).toLowerCase()}`;
  // A page text lists the sections of its document that changed (PR5b).
  const inner = (row: Record<string, unknown> | null) =>
    entry.area === "page_texts" &&
    row?.document &&
    typeof row.document === "object"
      ? (row.document as Record<string, unknown>)
      : row;
  const before = inner(entry.before) ?? {};
  const after = inner(entry.after) ?? {};
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])]
    // A group's permanence (review 2) is set up once and never changes.
    .filter((key) => !unshown.has(key))
    .filter((key) => !(entry.area === "people_sections" && key === "kind"));
  // A group id reads as the group's name, never as the raw id; a stamp as
  // Grenada time or "No".
  const text = (key: string, value: unknown) => {
    // A page's sections (review 3 B): their names in order, hidden ones marked.
    if (
      entry.area === "page_texts" &&
      key === "sections" &&
      isLayoutKey(entry.record_id)
    ) {
      const page = entry.record_id;
      return storedSections({ sections: value })
        .map(({ id, shown }) =>
          shown
            ? pageSectionTitle(page, id)
            : `${pageSectionTitle(page, id)} (${systemText.pageSections.hidden.toLowerCase()})`,
        )
        .join(", ");
    }
    if (key === "section_id" && typeof value === "string" && value !== "")
      return names.get(value) ?? unknownSection;
    if (personColumns.has(key) && typeof value === "string" && value !== "")
      return names.get(value) ?? formerMember;
    if (namedColumns.has(key) && typeof value === "string" && value !== "")
      return names.get(value) ?? "(archived or unknown)";
    if (key === "category" && typeof value === "string" && value in CATEGORIES)
      return CATEGORIES[value as Category].tag;
    if (key === "kind" && typeof value === "string")
      return kindNames[value] ?? value;
    if (
      key === "go2pay_product_id" &&
      (typeof value === "number" || typeof value === "string") &&
      Number.isSafeInteger(Number(value)) &&
      value !== ""
    )
      return productLabel(Number(value));
    if (key === "slug" && typeof value === "string" && value !== "")
      return `/donate/${value}/give`;
    if (instants.has(key) && typeof value === "string" && value !== "")
      return Number.isNaN(Date.parse(value)) ? value : activityTime(value);
    if (stamps.has(key))
      return typeof value !== "string" || value === ""
        ? "No"
        : Number.isNaN(Date.parse(value))
          ? value
          : activityTime(value);
    return format(value);
  };
  const fields: ChangedField[] = [];
  for (const key of keys) {
    const was = before[key];
    const now = after[key];
    const hidden = was === privateValue || now === privateValue;
    // Hidden values always differ: the log keeps only that they changed.
    if (
      entry.before &&
      entry.after &&
      !hidden &&
      JSON.stringify(was) === JSON.stringify(now)
    )
      continue;
    // A created or deleted row lists only the fields that had a value.
    if (!entry.before || !entry.after) {
      const value = entry.before ? was : now;
      if (value === null || value === "" || value === false) continue;
    }
    fields.push({
      name: sentence(key),
      before: hidden || !entry.before ? null : text(key, was),
      after: hidden || !entry.after ? null : text(key, now),
      hidden,
    });
  }
  return { label, subject: subjectOf(entry, names), fields, restoredFrom };
}

/** Long texts (a full description) are cut short in the list; the item itself has the rest. */
export const shownLength = 200;

/** A value as the list shows it: cut after `shownLength` characters, "(empty)" for nothing. */
export function shownText(value: string): string {
  if (value === "") return "(empty)";
  return value.length > shownLength
    ? `${value.slice(0, shownLength).trimEnd()}…`
    : value;
}

// The page collapses spaces and line breaks, as HTML does.
const collapsed = (value: string) => value.replace(/\s+/g, " ").trim();

/**
 * Why an edited value would look the same before and after in the list, or
 * null when the difference shows: "spacing" when only spaces or line breaks
 * differ (for example Windows line breaks from the form), "beyond" when the
 * difference is past the cut.
 */
export function hiddenDifference(
  before: string,
  after: string,
): "spacing" | "beyond" | null {
  if (collapsed(before) === collapsed(after)) return "spacing";
  return collapsed(shownText(before)) === collapsed(shownText(after))
    ? "beyond"
    : null;
}

/** Someone whose People entry is gone (D-5). */
export const formerMember = "Former member";

/**
 * Who made a change, as the board reads it: the People name of the account,
 * "Site owner" when there was no account (the SQL editor or the database
 * itself), "Former member" when the account's People entry is gone (D-5).
 */
export function actorLabel(entry: ActivityEntry): string {
  if (entry.actor === null) return "Site owner";
  return entry.actorName ?? formerMember;
}

const whenFormat = new Intl.DateTimeFormat("en", {
  timeZone: TIMEZONE,
  dateStyle: "medium",
  timeStyle: "short",
});

/** When a change happened, in Grenada time ("Oct 3, 2026, 2:15 PM"). */
export const activityTime = (occurredAt: string) =>
  whenFormat.format(new Date(occurredAt));

/**
 * One version a per-item History can put back (review 3 D): the version
 * before change `entryId`, when that version was saved (`savedAt`), and how
 * many changes a restore replaces: that change and every newer one.
 */
export type HistoryVersion = {
  entryId: number;
  savedAt: string;
  replaces: number;
};

/**
 * When the version before `entry` was saved: the time of the change before
 * it (`previous`, the same item's next older entry), or for the item's
 * first change the starting row's own `updated_at`. Null when the entry
 * keeps no earlier version.
 */
export function versionBefore(
  entry: ActivityRow,
  previous: ActivityRow | null,
): { snapshot: Record<string, unknown>; savedAt: string } | null {
  if (!entry.before) return null;
  const savedAt = previous
    ? previous.occurred_at
    : loggedTime(entry.before.updated_at);
  return savedAt ? { snapshot: entry.before, savedAt } : null;
}

/**
 * A History list: one item's entries read newest first with one more than
 * `length` asked for. The extra entry is not listed; it only dates the
 * version before the oldest listed change (none: that change was the
 * item's first).
 */
export function historyList<T extends ActivityRow>(
  entries: readonly T[],
  length: number,
): { shown: T[]; versions: (HistoryVersion | null)[] } {
  const shown = entries.slice(0, length);
  const versions = shown.map((entry, index) => {
    const version = versionBefore(entry, entries[index + 1] ?? null);
    return version
      ? { entryId: entry.id, savedAt: version.savedAt, replaces: index + 1 }
      : null;
  });
  return { shown, versions };
}

/** How long the dashboard points at a prayer change (PR3 contract, WP-E). */
export const prayerNoticeDays = 7;

/**
 * The newest prayer settings entry from the last `prayerNoticeDays` days
 * before `now`, or null. Entries are newest first. (Urgent notices are
 * highlighted too since PR5a, so the area is checked.)
 */
export function recentPrayerChange<T extends ActivityRow>(
  entries: readonly T[],
  now: Date,
): T | null {
  const since = now.getTime() - prayerNoticeDays * 24 * 60 * 60 * 1000;
  return (
    entries.find(
      (entry) =>
        entry.area === "prayer_settings" &&
        entry.highlight &&
        new Date(entry.occurred_at).getTime() >= since,
    ) ?? null
  );
}

/**
 * The "What" filter of Recent changes (D-10): each kind and the tables
 * (`area`) it covers. Later features add their own groups.
 */
export const activityKinds = {
  // The musallah pin is moved on the Prayer & iqamah screen (PR7 D-4).
  prayer: {
    label: "Prayer & iqamah",
    areas: ["prayer_settings", "musallah_location"],
  },
  events: { label: "Events", areas: ["events"] },
  announcements: { label: "Announcements", areas: ["announcements"] },
  news: { label: "News", areas: ["news_posts"] },
  newsletters: { label: "Newsletters", areas: ["newsletters"] },
  people: {
    label: "People and logins",
    areas: ["people", "people_sections", "admins"],
  },
  handover: {
    label: "New board term",
    areas: ["handover_steps", "shared_logins"],
  },
  pages: { label: "Pages", areas: ["page_texts"] },
  giving: {
    label: "Funds, tickets and seasons",
    areas: ["payment_items", "payment_item_links", "seasons"],
  },
  merch: {
    label: "Merch",
    areas: ["merch_collections", "merch_items"],
  },
} as const satisfies Readonly<
  Record<string, { label: string; areas: readonly string[] }>
>;
export type ActivityKind = keyof typeof activityKinds;

/** "owner": entries with no account (the site owner or the database itself). */
export const ownerActor = "owner";

/**
 * A page request for the log: `before` is an entry id (older entries only).
 * Filters (D-10): `actors` (account ids, and "owner"; empty matches nothing),
 * `areas` (tables, from `activityKinds`), and `from` / `to` (Grenada days,
 * both included).
 */
export const activityQuerySchema = z.object({
  before: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(50),
  area: z.string().min(1).optional(),
  recordId: z.string().min(1).optional(),
  actors: z.array(z.union([z.uuid(), z.literal(ownerActor)])).optional(),
  areas: z.array(z.string().min(1)).min(1).optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
});
export type ActivityQuery = z.infer<typeof activityQuerySchema>;

/** The start of a Grenada day (UTC−04:00 year-round), as an instant. */
const dayStart = (day: string) => new Date(`${day}T00:00:00-04:00`);

/**
 * The instants a `from` / `to` filter covers: from the start of the `from`
 * day (included) to the start of the day after `to` (excluded).
 */
export function activityDayBounds(query: Pick<ActivityQuery, "from" | "to">): {
  since?: string;
  until?: string;
} {
  const until = query.to ? dayStart(query.to) : null;
  until?.setUTCDate(until.getUTCDate() + 1);
  return {
    ...(query.from ? { since: dayStart(query.from).toISOString() } : {}),
    ...(until ? { until: until.toISOString() } : {}),
  };
}

/** Whether a log entry passes a query's filters (the sandbox log; the database filters in SQL). */
export function matchesActivityQuery(
  entry: ActivityRow,
  query: ActivityQuery,
): boolean {
  const { since, until } = activityDayBounds(query);
  const at = new Date(entry.occurred_at).getTime();
  return (
    (query.before === undefined || entry.id < query.before) &&
    (query.area === undefined || entry.area === query.area) &&
    (query.areas === undefined || query.areas.includes(entry.area)) &&
    (query.recordId === undefined || entry.record_id === query.recordId) &&
    (query.actors === undefined ||
      query.actors.includes(entry.actor ?? ownerActor)) &&
    (since === undefined || at >= Date.parse(since)) &&
    (until === undefined || at < Date.parse(until))
  );
}

/** A login account and the People entry it belongs (or belonged) to. */
export type LoginOwner = { userId: string; personId: string };

const removedAccessRow = z.object({
  record_id: z.uuid(),
  before: z.object({ user_id: z.uuid() }),
});

/**
 * Logins that no longer exist ("Remove login", or a person deleted for good),
 * read from the log itself: deleting an access row logs its `user_id` under
 * the person's id. So a removed login's past changes keep their People name
 * and the person stays in "Who" (contract: "the person and their history
 * stay"; E-25 "has or had a login").
 */
export function removedLoginsIn(rows: readonly ActivityRow[]): LoginOwner[] {
  return rows.flatMap((row) => {
    if (row.area !== "admins" || row.action !== "deleted") return [];
    const parsed = removedAccessRow.safeParse(row);
    return parsed.success
      ? [
          {
            userId: parsed.data.before.user_id,
            personId: parsed.data.record_id,
          },
        ]
      : [];
  });
}

/** Account id → People id, for every login that has or had access (a current link wins). */
export function loginOwnerMap(
  current: readonly LoginOwner[],
  removed: readonly LoginOwner[],
): Map<string, string> {
  return new Map(
    [...removed, ...current].map((login) => [login.userId, login.personId]),
  );
}

/**
 * The Recent changes filters as the page address carries them (E-9): `who`
 * (a People id or "owner"), `what` (an `activityKinds` key), `from` and
 * `to` (Grenada days). A value that is not one of these is left out.
 */
export type ActivityFilters = {
  who?: string;
  what?: ActivityKind;
  from?: string;
  to?: string;
};

const filterSchemas = {
  who: z.union([z.uuid(), z.literal(ownerActor)]),
  what: z.enum(Object.keys(activityKinds) as [ActivityKind, ...ActivityKind[]]),
  from: dateSchema,
  to: dateSchema,
};

/** The filters in a Recent changes address (`?who=&what=&from=&to=`). */
export function activityFiltersFrom(
  params: Readonly<Record<string, string | string[] | undefined>>,
): ActivityFilters {
  const filters: ActivityFilters = {};
  for (const key of ["who", "what", "from", "to"] as const) {
    const parsed = filterSchemas[key].safeParse(params[key]);
    if (parsed.success) Object.assign(filters, { [key]: parsed.data });
  }
  return filters;
}

/**
 * The log query fields of the filters (`ActivityLog.list`). `loginsOf` gives
 * every account a person has or had, so "Who" covers all of their changes.
 */
export function activityFilterQuery(
  filters: ActivityFilters,
  loginsOf: (personId: string) => readonly string[],
): Pick<ActivityQuery, "actors" | "areas" | "from" | "to"> {
  const { who } = filters;
  return {
    ...(who
      ? { actors: who === ownerActor ? [ownerActor] : [...loginsOf(who)] }
      : {}),
    ...(filters.what ? { areas: [...activityKinds[filters.what].areas] } : {}),
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
  };
}

/** A Recent changes address that keeps the filters ("Older changes" adds `before`). */
export function activityHref(filters: ActivityFilters, before?: number) {
  const params = new URLSearchParams();
  for (const key of ["who", "what", "from", "to"] as const)
    if (filters[key]) params.set(key, filters[key]);
  if (before !== undefined) params.set("before", String(before));
  const search = params.toString();
  return search ? `/admin/activity?${search}` : "/admin/activity";
}
