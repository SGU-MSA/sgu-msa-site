import { googleFormsOnly, isGoogleFormUrl } from "../integrations/google-forms";
import {
  dateSchema,
  namedDate,
  namedOptionalTime,
} from "../validation/date-time";
export { dateSchema, timeSchema } from "../validation/date-time";
import {
  exceptionRows,
  iqamahBothMessage,
  iqamahOffsetSchema,
  exceptionSchema,
  jumuahSessionList,
  prayerIds,
} from "../prayer/adjustments";
import { z } from "../validation/zod";
import { outOfDate } from "../system-text";
import { nearCampus, outsideCampus } from "../maps/place";

export const TIMEZONE = "America/Grenada";
export const collections = [
  "events",
  "announcements",
  "news_posts",
  "newsletters",
] as const;
export type Collection = (typeof collections)[number];
export const collectionSchema = z.enum(collections);

/**
 * The one date order of community records. Public pages list events soonest
 * first and everything else newest first; the board lists every collection
 * newest first. Database adapters pass this to `.order("date", ...)`; the
 * sandbox adapters sort with `compareByDate`, so both stay in step.
 */
export function dateAscending(
  kind: Collection,
  audience: "public" | "board",
): boolean {
  return audience === "public" && kind === "events";
}
export function compareByDate(ascending: boolean) {
  return (a: { date: string }, b: { date: string }) =>
    ascending ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
}
/**
 * The names board-facing messages give each item field ("Title: …", PR4
 * WP-3). A content form passes its own box labels instead (`contentFieldNames`,
 * Q57), so a refused save names the box the board sees ("Event name: …").
 */
export const recordFieldNames = {
  title: "Title",
  summary: "Summary",
  body: "Description",
  date: "Date",
  expires_on: "Hide after",
  start_time: "Start time",
  end_date: "End date",
  end_time: "End time",
  location: "Place",
  url: "Link",
  image_alt: "Picture description",
  file_path: "The newsletter",
  urgent_until: "Hide at",
  status: "Is it still happening?",
  status_note: "Reason",
  ticket_payment_item_id: "Ticket",
  season_id: "Season",
  category_id: "Category",
  term_id: "Term",
};
export type RecordFieldNames = typeof recordFieldNames;
/** "Field: use N characters or fewer." */
const atMost = (field: string, count: number) =>
  `${field}: use ${count.toLocaleString("en-US")} characters or fewer.`;
/** Shared by the stored-picture rule and the new-upload rule (`recordFormSchema`). */
const describePicture = (names: RecordFieldNames) =>
  `${names.image_alt}: write one sentence about the picture for people who cannot see it.`;
const httpsUrl = (field: string) => {
  const message = `${field}: use a secure web address (starting with https://).`;
  return z
    .union([
      z.literal(""),
      // zod runs the refine even after `z.url()` refused the value.
      z.url({ error: message }).refine((value) => {
        if (!URL.canParse(value)) return false;
        const url = new URL(value);
        return url.protocol === "https:" && !url.username && !url.password;
      }, message),
    ])
    .default("");
};
/** A stored file's name (`normalizeUpload` gives every upload a UUID name). */
export const storedFileName = z
  .string()
  .regex(/^[a-f0-9-]{36}\.(pdf|webp)$/, outOfDate);
/** A stored photo's name (photo library: "Choose from uploaded photos"). */
export const storedPhotoName = z
  .string()
  .regex(/^[a-f0-9-]{36}\.webp$/, outOfDate);
const asset = storedFileName.or(z.literal("")).default("");

/**
 * An event's status (PR5a D-2; review 2, 2026-10-05): Scheduled, Postponed
 * (new date not known yet) or Cancelled. A known new date is just the event's
 * date: one row, one address, one calendar UID.
 */
export const eventStatuses = ["scheduled", "cancelled", "postponed"] as const;
export type EventStatus = (typeof eventStatuses)[number];

/** An exact time with its offset ("" when empty; null in the database). */
const namedInstant = (field: string) =>
  z.iso
    .datetime({
      offset: true,
      error: `${field}: choose a valid date and time.`,
    })
    .or(z.literal(""))
    .default("");

/** The Grenada date of an instant; "" when it is not a time (zod still runs refinements then). */
const grenadaDateOf = (instant: string) =>
  Number.isNaN(Date.parse(instant)) ? "" : localDate(new Date(instant));

/**
 * Typed text. Browsers send a textarea's line breaks as `\r\n`; they become
 * `\n`, so saving unchanged multi-line text changes nothing and logs no
 * change (D-28; the prayer Schedule notice too, D-30).
 */
const text = () =>
  z
    .string()
    .overwrite((value) => value.replace(/\r\n?/g, "\n"))
    .trim();

/** An item's fields and rules, its messages naming each field by `names`. */
const recordObject = (names: RecordFieldNames) =>
  z
    .object({
      id: z.uuid(),
      // Board-facing messages name the field (PR4 WP-3, D-7).
      title: text()
        .min(1, `${names.title}: fill in this box.`)
        .max(160, atMost(names.title, 160)),
      summary: text().max(500, atMost(names.summary, 500)).default(""),
      body: text().max(20000, atMost(names.body, 20000)).default(""),
      date: namedDate(names.date),
      expires_on: namedDate(names.expires_on).or(z.literal("")).default(""),
      // No start time: all day (review 2, 2026-10-05).
      start_time: namedOptionalTime(names.start_time),
      // Events only (E-4): the last day, "" for the start date.
      end_date: namedDate(names.end_date).or(z.literal("")).default(""),
      end_time: namedOptionalTime(names.end_time),
      location: text().max(250, atMost(names.location, 250)).default(""),
      url: httpsUrl(names.url),
      image_path: asset,
      image_alt: text().max(250, atMost(names.image_alt, 250)).default(""),
      file_path: asset,
      published: z.boolean().default(false),
      featured: z.boolean().default(false),
      // Announcements only (E-4): urgent until this exact time (D-1, D-17).
      urgent_until: namedInstant(names.urgent_until),
      // Events only (E-4): the event's status (D-2, D-20).
      status: z
        .enum(eventStatuses, {
          error: `${names.status}: choose Scheduled, Postponed or Cancelled.`,
        })
        .default("scheduled"),
      status_note: text().max(250, atMost(names.status_note, 250)).default(""),
      // Events only (PR6 WP-9): the ticket sold for it, a priced item; one event per ticket.
      ticket_payment_item_id: z
        .uuid(
          `${names.ticket_payment_item_id}: choose one of the tickets listed.`,
        )
        .or(z.literal(""))
        .default(""),
      // Events only (PR5c): the season whose page lists it.
      season_id: z
        .uuid(`${names.season_id}: choose one of the seasons listed.`)
        .or(z.literal(""))
        .default(""),
      // Events only (review fixes P3): a category and a term from the Lists.
      category_id: z
        .uuid(`${names.category_id}: choose one from the list.`)
        .or(z.literal(""))
        .default(""),
      term_id: z
        .uuid(`${names.term_id}: choose one from the list.`)
        .or(z.literal(""))
        .default(""),
    })
    .superRefine((value, ctx) => {
      const problem = (field: string, message: string) =>
        ctx.addIssue({ code: "custom", message, path: [field] });
      if (value.expires_on && value.expires_on < value.date)
        problem(
          "expires_on",
          `${names.expires_on}: choose the item's date or a later one.`,
        );
      // Every kind (the database's checks, joined): the end comes after the
      // start (review 2, 2026-10-05). An end date is the start date or later;
      // an end time needs a start time and, on the start date, is later.
      if (value.end_date && value.end_date < value.date)
        problem(
          "end_date",
          `${names.end_date}: choose the start date or a later one.`,
        );
      if (value.end_time && !value.start_time)
        problem("end_time", `${names.end_time}: add a start time first.`);
      else if (
        value.end_time &&
        (value.end_date || value.date) === value.date &&
        value.end_time <= value.start_time
      )
        problem(
          "end_time",
          `${names.end_time}: choose a time after the start time.`,
        );
      // Mirror of `announcement_urgent_alone` (D-1): urgent is never also
      // featured, has no date-only end, and ends on or after its own date.
      if (value.urgent_until) {
        if (value.featured)
          problem(
            "urgent_until",
            `${names.urgent_until}: an urgent notice is not also featured.`,
          );
        if (value.expires_on)
          problem(
            "expires_on",
            `${names.expires_on}: leave empty for an urgent notice; it ends at ${names.urgent_until}.`,
          );
        const ends = grenadaDateOf(value.urgent_until);
        if (ends && ends < value.date)
          problem(
            "urgent_until",
            `${names.urgent_until}: choose a time on or after the item's date.`,
          );
      }
      // Mirror of `event_cancel_reason` (D-20).
      if (value.status === "cancelled" && !value.status_note)
        problem(
          "status_note",
          `${names.status_note}: fill in this box for a cancelled event.`,
        );
      if (value.image_path && !value.image_alt)
        ctx.addIssue({
          code: "custom",
          message: describePicture(names),
          path: ["image_alt"],
        });
    });

export const recordSchema = recordObject(recordFieldNames);
export type CommunityRecord = z.infer<typeof recordSchema> & {
  updated_at?: string;
  /** Set while the item is archived (ADR 0013): hidden publicly, read-only on the board. */
  archived_at?: string | null;
};

/**
 * A board save of one item (PR4 WP-3): the record rules plus the rules of
 * its kind and of the files chosen in the form, so a refused save lists
 * every problem at once (`issuesOf`).
 */
export function recordFormSchema(
  kind: Collection,
  chosen: { image: boolean; file: boolean },
  /** The kind's box labels (`contentFieldNames`), so messages name what the board sees. */
  names: RecordFieldNames,
  /**
   * The server clock (`clock().now()`): when given, an urgent notice must end
   * later than now (PR5a D-1). Left out, that one rule is not checked.
   */
  now?: Date,
) {
  return recordObject(names).superRefine((value, ctx) => {
    const problem = (field: keyof CommunityRecord, message: string) =>
      ctx.addIssue({ code: "custom", message, path: [field] });
    if (kind === "announcements" && value.urgent_until) {
      if (value.title.length > URGENT_BAND_MAX_CHARS)
        problem(
          "title",
          `${names.title}: urgent notices fit ${URGENT_BAND_MAX_CHARS} characters; put the rest in the details.`,
        );
      // An end that is not a time already has its own refusal (`namedInstant`).
      const ends = Date.parse(value.urgent_until);
      if (now && !Number.isNaN(ends) && ends <= now.getTime())
        problem(
          "urgent_until",
          `${names.urgent_until}: choose a time later than now.`,
        );
    }
    // An event's link is its "Sign up →" button: Google Forms only (PR5b
    // D-25); newsletters and posts keep any secure link. A link that is not
    // secure already has its own refusal.
    if (
      kind === "events" &&
      value.url.startsWith("https://") &&
      !isGoogleFormUrl(value.url)
    )
      problem("url", googleFormsOnly(names.url));
    // An event with no start time is all day (review 2, 2026-10-05).
    if (kind === "events" && value.published && !value.location)
      problem(
        "location",
        `${names.location}: add where it happens, or save as a draft.`,
      );
    if (
      kind === "newsletters" &&
      !value.file_path &&
      !value.url &&
      !chosen.file
    )
      problem(
        "file_path",
        `${names.file_path}: choose a PDF or an image, or add a link.`,
      );
    if (chosen.image && !value.image_alt)
      problem("image_alt", describePicture(names));
  });
}

/** Columns only one collection has (E-4); the other collections have no such column. */
const ownColumns: Partial<Record<keyof CommunityRecord, Collection>> = {
  urgent_until: "announcements",
  status: "events",
  status_note: "events",
  end_date: "events",
  ticket_payment_item_id: "events",
  season_id: "events",
  category_id: "events",
  term_id: "events",
};
/** Columns that are "" in a record and null in the database. */
const nullWhenEmpty = new Set<string>([
  "expires_on",
  "urgent_until",
  "end_date",
  "ticket_payment_item_id",
  "season_id",
  "category_id",
  "term_id",
]);

/**
 * The one parse of a database row: a null `expires_on` means "never
 * expires", a null `urgent_until` "not urgent", a null `end_date` "ends on
 * its start date"; a collection without a column gets its default. `updated_at` is
 * kept for the urgent order and calendar files.
 */
export function recordFromRow(row: Record<string, unknown>): CommunityRecord {
  const values: Record<string, unknown> = { ...row };
  for (const column of nullWhenEmpty) values[column] = row[column] ?? "";
  const record: CommunityRecord = recordSchema.parse(values);
  return row.updated_at
    ? { ...record, updated_at: String(row.updated_at) }
    : record;
}

/**
 * A record as the database row of `kind` stores it (E-4): only that
 * collection's columns, empty dates and times as null.
 */
export function recordToRow(
  kind: Collection,
  record: CommunityRecord,
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const column of recordSchema.keyof().options) {
    const owner = ownColumns[column];
    if (owner && owner !== kind) continue;
    row[column] = nullWhenEmpty.has(column)
      ? record[column] || null
      : record[column];
  }
  return row;
}

/**
 * Collections whose items can start a new one ("Create from this event",
 * review fixes P3; was "Duplicate", PR3 WP-F).
 */
export const duplicableCollections = [
  "events",
  "announcements",
] as const satisfies readonly Collection[];
export type DuplicableCollection = (typeof duplicableCollections)[number];

/**
 * "Create from this event" (review fixes P3; the approved plan: "Duplicate"
 * becomes "Create from this event", with the date cleared): a new item's form,
 * not saved yet, with the saved item's words, place, times, picture,
 * category and term. The dates are cleared for the board to choose; it is
 * an unpublished draft, not featured, not urgent, scheduled, and sells no
 * ticket (one event per ticket, PR6 WP-9). Not parsed: an empty date is the
 * box the board fills in.
 */
export function startFrom(
  record: CommunityRecord,
  id: string,
): CommunityRecord {
  return {
    ...record,
    id,
    date: "",
    end_date: "",
    expires_on: "",
    published: false,
    featured: false,
    urgent_until: "",
    status: "scheduled",
    status_note: "",
    ticket_payment_item_id: "",
    updated_at: undefined,
    archived_at: null,
  };
}

/**
 * Prayer & iqamah box labels that refusals name: one source for the form
 * (`PrayerEditor`), its messages (Q57) and History's preview of a version
 * (`PrayerVersion`).
 */
export const prayerBoxNames = {
  khutbah: "Jumu’ah khutbah",
  jummah_iqamah: "Jumu’ah iqamah",
  valid_from: "Times start on",
  valid_until: "Times end on",
  exceptions: "Changes for one date",
  hijri_adjustment: "Hijri date",
  notice: "Note for visitors",
} as const;

/**
 * The weekly Jumu'ah stored before several prayers (review fixes P2): one
 * `khutbah` and `jummah_iqamah`, now retired columns. An older History
 * version still holds them; it is read as a list of one.
 */
function legacyJumuah(value: unknown) {
  if (!value || typeof value !== "object" || "jumuah_sessions" in value)
    return value;
  const { khutbah, jummah_iqamah } = value as Record<string, unknown>;
  return {
    ...value,
    jumuah_sessions:
      khutbah && jummah_iqamah ? [{ khutbah, iqamah: jummah_iqamah }] : [],
  };
}

/**
 * The board's prayer settings (the `prayer_settings` row). The calculation
 * method and Asr school are fixed in code (`prayerCalculation`, ADR 0017):
 * the retired `confirmed`, `method`, `madhab` and `adjustments` columns, and
 * `latitude`/`longitude` (the pin is `musallahPinSchema` since PR7), stay in
 * the database until PR7 WP-6 but are dropped here on read and never written.
 * The weekly Jumu'ah is the ordered list `jumuah_sessions` (review fixes P2);
 * the retired `khutbah` and `jummah_iqamah` are read only from an older
 * version (`legacyJumuah`). Read with `prayerSettingsSchema`, saved with `prayerSaveSchema` (PR4 D-14).
 * Reading keeps a prayer saved before PR4 with both a fixed iqamah time and
 * minutes after the start as stored (D-14 amendment, 2026-10-05): the public
 * prayer block still works (`congregationTimes`: the minutes win, as visitors
 * always saw) and the dashboard shows both boxes with that row's error until
 * the board picks one.
 */
export const prayerSettingsSchema = z
  .preprocess(
    legacyJumuah,
    z.object({
      id: z.literal(1),
      iqamah_offsets: iqamahOffsetSchema.default(() =>
        iqamahOffsetSchema.parse({}),
      ),
      exceptions: z
        .array(exceptionSchema)
        .max(exceptionRows)
        .default([])
        .refine(
          (rows) => new Set(rows.map((row) => row.date)).size === rows.length,
          `${prayerBoxNames.exceptions}: use each date only once.`,
        ),
      // Required, no default: the board's -1 / 0 / +1 day on the calculated
      // Hijri date. Prayer & iqamah no longer offers it (review fixes P2): a
      // save writes 0, as calculated.
      hijri_adjustment: z.union([z.literal(-1), z.literal(0), z.literal(1)], {
        error: `${prayerBoxNames.hijri_adjustment}: choose one day earlier, as calculated, or one day later.`,
      }),
      valid_from: dateSchema.or(z.literal("")),
      valid_until: dateSchema.or(z.literal("")),
      fajr: namedOptionalTime("Fajr iqamah"),
      dhuhr: namedOptionalTime("Dhuhr iqamah"),
      asr: namedOptionalTime("Asr iqamah"),
      maghrib: namedOptionalTime("Maghrib iqamah"),
      isha: namedOptionalTime("Isha iqamah"),
      // The weekly Jumu'ah prayers, in the order visitors see them (review fixes P2).
      jumuah_sessions: jumuahSessionList({
        khutbah: prayerBoxNames.khutbah,
        iqamah: prayerBoxNames.jummah_iqamah,
      }).default([]),
      notice: text().max(1000, atMost(prayerBoxNames.notice, 1000)),
    }),
  )
  .superRefine((value, ctx) => {
    if (
      ([value.fajr, value.dhuhr, value.asr, value.maghrib, value.isha].some(
        Boolean,
      ) ||
        value.jumuah_sessions.length > 0) &&
      (!value.valid_from ||
        !value.valid_until ||
        value.valid_until < value.valid_from)
    )
      ctx.addIssue({
        code: "custom",
        message: `${prayerBoxNames.valid_from} and ${prayerBoxNames.valid_until}: fixed times need both dates, and the end cannot be before the start.`,
        path: ["valid_until"],
      });
  });

/**
 * What a board save may write (PR4 D-14): a prayer has a fixed iqamah time or
 * minutes after the start, never both. Enforced only when saving.
 */
export const prayerSaveSchema = prayerSettingsSchema.superRefine(
  (value, ctx) => {
    for (const id of prayerIds)
      if (value[id] && value.iqamah_offsets[id] !== null)
        ctx.addIssue({
          code: "custom",
          message: iqamahBothMessage(id),
          path: [id],
        });
  },
);
export type PrayerSettings = z.infer<typeof prayerSettingsSchema>;
export const emptyPrayer: PrayerSettings = {
  id: 1,
  iqamah_offsets: iqamahOffsetSchema.parse({}),
  exceptions: [],
  hijri_adjustment: 0,
  valid_from: "",
  valid_until: "",
  fajr: "",
  dhuhr: "",
  asr: "",
  maghrib: "",
  isha: "",
  jumuah_sessions: [],
  notice: "",
};

/**
 * An earlier version from the prayer History, checked like any save. The
 * Hijri date stays as calculated (review fixes P2: Prayer & iqamah no longer
 * sets it); retired fields and start corrections (ADR 0017) are dropped, a
 * single weekly Jumu'ah is read as a list of one, and a version with both a
 * fixed time and minutes after the start for one prayer is refused, naming
 * that prayer (D-14 amendment, 2026-10-05).
 */
export function restoredPrayerSettings(before: Record<string, unknown>) {
  return prayerSaveSchema.safeParse({ ...before, hijri_adjustment: 0 });
}

/** The refusal when a post carries no pin: only a forged or broken page (D-5, drag only). */
const noPin = "Musallah location: drag the dot to set the pin.";

/** A pin coordinate whose refusal names it (the drag writes it; there is no box). */
const coordinate = (field: string, limit: number) => {
  const message = `${field}: enter a number from -${limit} to ${limit}.`;
  return z
    .number({ error: (issue) => (issue.input == null ? noPin : message) })
    .min(-limit, message)
    .max(limit, message);
};

/**
 * The one musallah pin (PR7, the `musallah_location` row): the only source
 * for the map, the directions and the prayer start times. Refused further
 * than about 1.5 km from the SGU campus (review fixes P4; inside Grenada,
 * D-9), as the database's checks do. Unknown keys (`updated_at`)
 * are dropped on read.
 */
export const musallahPinSchema = z
  .object({
    id: z.literal(1),
    latitude: coordinate("Latitude", 90),
    longitude: coordinate("Longitude", 180),
  })
  .refine(nearCampus, {
    message: outsideCampus,
    path: ["latitude"],
    // Only for two valid numbers: a broken post hears one refusal.
    when: (payload) => payload.issues.length === 0,
  });
export type MusallahPin = z.infer<typeof musallahPinSchema>;

export function localDate(now: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** This year in Grenada (the footer's copyright line). */
export function localYear(now: Date) {
  return Number(localDate(now).slice(0, 4));
}

/**
 * Whether visitors see a record now: the declared mirror of the database's
 * `community_item_visible()` (the authority, D-24). Events show before their date.
 */
export function isVisible(
  record: CommunityRecord,
  kind: Collection,
  now: Date,
) {
  const today = localDate(now);
  return (
    !record.archived_at &&
    record.published &&
    (kind === "events" || record.date <= today) &&
    (!record.expires_on || record.expires_on >= today) &&
    // An urgent notice hides at its own exact end (the announcements read policy).
    (kind !== "announcements" ||
      !record.urgent_until ||
      new Date(record.urgent_until).getTime() > now.getTime())
  );
}

/** Announcement priority (D-1), derived from `featured` and `urgent_until`; never stored. */
export type AnnouncementPriority = "normal" | "featured" | "urgent";
export function announcementPriority(
  record: Pick<CommunityRecord, "featured" | "urgent_until">,
): AnnouncementPriority {
  if (record.urgent_until) return "urgent";
  return record.featured ? "featured" : "normal";
}

/** The urgent band keeps one height: an urgent title fits this many characters (D-16). */
export const URGENT_BAND_MAX_CHARS = 80;

/** A version's time for ordering; a sandbox version (not a time) sorts as oldest. */
const versionTime = (record: CommunityRecord) => {
  const time = Date.parse(record.updated_at ?? "");
  return Number.isNaN(time) ? -Infinity : time;
};

/**
 * The urgent notices visitors see now, in band order (D-30): newest date
 * first, then the latest saved, then by id so equal ones keep one order.
 */
export function currentUrgentNotices(
  records: readonly CommunityRecord[],
  now: Date,
): CommunityRecord[] {
  return records
    .filter(
      (record) =>
        record.urgent_until && isVisible(record, "announcements", now),
    )
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        versionTime(b) - versionTime(a) ||
        a.id.localeCompare(b.id),
    );
}

/** The automatic Jumu'ah notice's "Hide at" prefill: this long after that Friday's iqamah (D-19). */
export const JUMUAH_NOTICE_MINUTES_AFTER = 30;

/** Each event status by name: the event form's choices and the event page's Status. */
export const eventStatusNames = {
  scheduled: "Scheduled",
  postponed: "Postponed",
  cancelled: "Cancelled",
} as const satisfies Record<EventStatus, string>;

/**
 * The line an event shows under its title (D-20; review 2, 2026-10-05): null
 * while scheduled, "Cancelled: (reason)", or "Postponed: new date to be
 * announced". A known new date is simply the event's date.
 */
export function eventStatusLine(event: {
  status?: EventStatus | null;
  status_note?: string | null;
}): string | null {
  if (event.status === "cancelled")
    return event.status_note
      ? `${eventStatusNames.cancelled}: ${event.status_note}`
      : eventStatusNames.cancelled;
  return event.status === "postponed"
    ? `${eventStatusNames.postponed}: new date to be announced`
    : null;
}

/**
 * An event's status as its page's facts name it (dashboard polish,
 * 2026-10-06): its status line, or "Scheduled".
 */
export const eventStatusName = (event: Parameters<typeof eventStatusLine>[0]) =>
  eventStatusLine(event) ?? eventStatusNames.scheduled;

/** An event's days and times (review 2, 2026-10-05), as stored. */
export type EventTimes = {
  date: string;
  start_time?: string | null;
  end_date?: string | null;
  end_time?: string | null;
};

/**
 * When an event or item ends, as an instant: its end date (or start date) at
 * its end time; a later end date without a time ends at the end of that
 * day; otherwise its start time, or the end of the day for an all-day item.
 */
function endsAt(record: EventTimes) {
  // Grenada is UTC−04:00 year-round. Named timezone is used for display/date boundaries.
  const day = record.end_date || record.date;
  const end =
    record.end_time ||
    (record.end_date && record.end_date !== record.date
      ? ""
      : record.start_time) ||
    "23:59";
  return new Date(`${day}T${end}:00-04:00`);
}

export function isUpcoming(
  record: EventTimes,
  // Server callers pass `clock().now()`; the client calendar filter passes the
  // visitor's browser clock explicitly. Required so no caller silently picks a clock.
  now: Date,
) {
  return endsAt(record).getTime() > now.getTime();
}
