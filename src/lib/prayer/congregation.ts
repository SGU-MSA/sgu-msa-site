import { localDate, TIMEZONE, type PrayerSettings } from "../community/schema";
import type { PrayerContent } from "../content/schemas";
import type { Starts } from "./calculate";
import {
  exceptionRows,
  iqamahModes,
  maxJumuahSessions,
  prayerIds,
  prayerLabel,
  weekday,
  type JumuahSession,
} from "./adjustments";

/** A fixed schedule applies only on Grenada dates inside its validity range. */
export function isScheduleCurrent(
  settings: Pick<PrayerSettings, "valid_from" | "valid_until">,
  today: string,
) {
  return Boolean(
    settings.valid_from &&
    settings.valid_from <= today &&
    settings.valid_until >= today,
  );
}

/** How many days before "Times end on" the dashboard starts reminding the board (PR4 D-12). */
export const scheduleEndReminderDays = 7;

/** Where "Times end on" stands for the dashboard reminder (PR4 D-12). */
export type ScheduleEndStatus =
  { state: "none" } | { state: "ending_soon" | "ended"; end: string };

/**
 * `ending_soon` when the iqamah times' last date ("Times end on") is today or
 * within the next `scheduleEndReminderDays` days; `ended` once it has passed
 * (the public iqamah times are then hidden), until a board member sets a later
 * date (D-12 amendment, 2026-10-04); `none` otherwise and when no end date is
 * set. The one owner of this rule: every reminder about the end date reuses it.
 */
export function scheduleEndStatus(
  settings: Pick<PrayerSettings, "valid_until">,
  today: string,
): ScheduleEndStatus {
  const end = settings.valid_until;
  if (!end) return { state: "none" };
  const days =
    (Date.parse(`${end}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) /
    86_400_000;
  if (days < 0) return { state: "ended", end };
  return days <= scheduleEndReminderDays
    ? { state: "ending_soon", end }
    : { state: "none" };
}

const grenadaClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** A calculated start instant as a Grenada clock (`HH:MM`), as the iqamah boxes hold one. */
export function clockOf(iso: string) {
  return grenadaClock.format(new Date(iso));
}

/**
 * The iqamah `minutes` after a calculated adhan (`iso`), as a Grenada clock
 * (`HH:MM`). One rule for visitors (`congregationTimes`) and for the
 * dashboard's preview as the board types (review fixes P2).
 */
export function iqamahAfterAdhan(iso: string, minutes: number) {
  return clockOf(new Date(Date.parse(iso) + minutes * 60000).toISOString());
}

/**
 * What one prayer's iqamah on a Grenada date depends on: the fixed clock
 * ("" when none), the minutes after the adhan (null when none), the dates
 * the times apply, and that date's one-date clock ("" when none).
 */
export type IqamahRule = Pick<PrayerSettings, "valid_from" | "valid_until"> & {
  fixed: string;
  minutes: number | null;
  changed: string;
};

/**
 * One prayer's iqamah on `today` (`HH:MM`, or "" when none shows).
 * Precedence: one-date clock > minutes after the adhan > current fixed
 * clock. A fixed clock needs both dates around today; minutes need only the
 * dates that are set, and today's calculated adhan (`adhan`, ISO). The one
 * owner of this rule: visitors (`congregationTimes`) and the dashboard's
 * preview as the board types (review fixes P2) both use it.
 */
export function iqamahOn(
  rule: IqamahRule,
  adhan: string | undefined,
  today: string,
) {
  if (rule.changed) return rule.changed;
  if (rule.minutes !== null) {
    const current =
      (!rule.valid_from || rule.valid_from <= today) &&
      (!rule.valid_until || rule.valid_until >= today);
    return current && adhan ? iqamahAfterAdhan(adhan, rule.minutes) : "";
  }
  return isScheduleCurrent(rule, today) ? rule.fixed : "";
}

/**
 * `starts` are today's calculated starts (`calculatePrayers`), computed once
 * per request by the caller; without them "after adhan" iqamah hides.
 */
export function congregationTimes(
  settings: PrayerSettings,
  starts: Starts,
  now: Date,
) {
  const today = localDate(now);
  const exception = settings.exceptions.find((row) => row.date === today);
  return prayerIds.flatMap((id) => {
    const time = iqamahOn(
      {
        valid_from: settings.valid_from,
        valid_until: settings.valid_until,
        fixed: settings[id],
        minutes: settings.iqamah_offsets[id],
        changed: exception?.iqamah[id] ?? "",
      },
      starts.find((row) => row.id === id && row.day === 0)?.iso,
      today,
    );
    return time ? [{ id, label: prayerLabel(id), time }] : [];
  });
}

/** One Jumu'ah prayer: its khutbah and iqamah times (the musallah is one room). */
export type JumuahGathering = JumuahSession;
/** The Jumu'ah visitors see for the coming Friday (`date`, a Grenada date). */
export type JumuahState =
  | { state: "regular"; date: string; gatherings: JumuahGathering[] }
  | {
      state: "changed";
      date: string;
      /** That Friday's own prayers, in order. */
      gatherings: JumuahGathering[];
      reason: string;
      /** The weekly prayers while the schedule is current, else none. */
      usual: JumuahGathering[];
    }
  | { state: "cancelled"; date: string; reason: string }
  | { state: "none"; date: string };

/** What pages show about a one-Friday change, beside the gatherings list. */
export type JumuahChangeNote =
  | Omit<Extract<JumuahState, { state: "changed" }>, "gatherings">
  | Extract<JumuahState, { state: "cancelled" }>;

/** The Grenada date of the coming Friday: today on a Friday, else the next one. */
export function comingFriday(today: string) {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + ((5 - weekday(today) + 7) % 7));
  return date.toISOString().slice(0, 10);
}

/**
 * Which Jumu'ah applies this week. A one-Friday change (cancelled, or that
 * Friday's own prayers) shows from the Saturday before until that Friday
 * ends; otherwise the weekly prayers while the schedule is current.
 */
export function jumuahFor(settings: PrayerSettings, now: Date): JumuahState {
  const today = localDate(now);
  const date = comingFriday(today);
  const usual = isScheduleCurrent(settings, today)
    ? settings.jumuah_sessions
    : [];
  const exception = settings.exceptions.find((row) => row.date === date);
  const change = exception?.jumuah;
  if (exception && change?.change === "cancelled")
    return { state: "cancelled", date, reason: exception.reason };
  if (exception && change?.change === "changed")
    return {
      state: "changed",
      date,
      gatherings: change.sessions,
      reason: exception.reason,
      usual,
    };
  return usual.length
    ? { state: "regular", date, gatherings: usual }
    : { state: "none", date };
}

/** The coming Friday's gatherings and change note, as visitors see them (PR4 D-5, D-13). */
export function jumuahDisplay(week: JumuahState): {
  gatherings: (JumuahGathering & { id: string })[];
  change: JumuahChangeNote | null;
} {
  const listed = (gatherings: readonly JumuahGathering[]) =>
    gatherings.map((gathering, index) => ({
      id: `prayer-${index + 1}`,
      ...gathering,
    }));
  if (week.state === "regular")
    return { gatherings: listed(week.gatherings), change: null };
  if (week.state === "changed") {
    const { gatherings, ...change } = week;
    return { gatherings: listed(gatherings), change };
  }
  return { gatherings: [], change: week.state === "cancelled" ? week : null };
}

/**
 * "Changed today: <reason>. " when today's one-date change sets an iqamah
 * time (shown to visitors, PR4 D-5); the reason of a Friday's Jumu'ah change
 * shows on the Jumu'ah card instead.
 */
export function changedTodayNote(settings: PrayerSettings, today: string) {
  const exception = settings.exceptions.find((row) => row.date === today);
  if (!exception || !Object.values(exception.iqamah).some(Boolean)) return "";
  return `Changed today: ${exception.reason.replace(/[.!?]$/, "")}. `;
}

/** What the line under the iqamah times depends on, besides its words. */
export type ScheduleNoticeState = {
  /** The board's settings could not be read. */
  unavailable: boolean;
  /** `changedTodayNote`: "Changed today: <reason>. " or "". */
  changedToday: string;
  /** The board's own notice on Prayer & iqamah ("" when none). */
  boardNotice: string;
  /** Whether any iqamah time shows today. */
  hasTimes: boolean;
};

/**
 * The line under the iqamah times (PR5b): the schedule lines are page text
 * (Pages → Prayer & Musallah); the board's own notice on Prayer & iqamah
 * comes first. Pure: the public page and the Pages preview share it.
 */
export function scheduleNotice(
  lines: Pick<
    PrayerContent,
    "schedule_note" | "no_schedule_note" | "unavailable_note"
  >,
  state: ScheduleNoticeState,
): string {
  if (state.unavailable) return lines.unavailable_note;
  return (
    state.changedToday +
    (state.boardNotice ||
      (state.hasTimes ? lines.schedule_note : lines.no_schedule_note))
  );
}

/** The switch's values, plus "both" for a prayer stored with both and not yet picked. */
const iqamahFormModes: readonly string[] = [
  ...iqamahModes.map(([mode]) => mode),
  "both",
];
/**
 * The Prayer & iqamah form's field names (PR4 WP-4), one place for both
 * directions: `prayerFormText` fills the form from stored settings and
 * `prayerFormValues` reads a posted form back into settings for
 * `prayerSaveSchema`. Each prayer has a switch `mode_<prayer>`: "fixed"
 * posts the clock in `<prayer>`, "after" the minutes in `offset_<prayer>`
 * (PR4 D-2), and "both" (a hidden value until the board picks one) posts
 * both. The weekly Jumu'ah prayers are `jumuah_<n>_khutbah` and
 * `jumuah_<n>_iqamah` by their place, n from 0 (review fixes P2). One-date
 * changes are `exception_<n>_…` rows, n from 0; a changed Friday's prayers
 * are `exception_<n>_jumuah_<m>_khutbah` and `…_iqamah`.
 */
export const jumuahSessionBox = (prefix: string, index: number, part: string) =>
  `${prefix}_${index}_${part}`;
/** The weekly Jumu'ah prayers' prefix in the form. */
export const weeklyJumuahPrefix = "jumuah";
/** A one-date change's Jumu'ah choice (`row`, n from 0) and, with `name`, its boxes. */
export const jumuahField = (row: number, name: string) =>
  `exception_${row}_jumuah${name ? `_${name}` : ""}`;

/** A list of Jumu'ah prayers as the form's text under `prefix`. */
function sessionsText(
  values: Record<string, string>,
  prefix: string,
  sessions: readonly JumuahSession[],
) {
  sessions.forEach((session, index) => {
    values[jumuahSessionBox(prefix, index, "khutbah")] = session.khutbah;
    values[jumuahSessionBox(prefix, index, "iqamah")] = session.iqamah;
  });
}

/** Stored settings as the form's text, the way the form posts them. */
export function prayerFormText(settings: PrayerSettings) {
  const values: Record<string, string> = {
    valid_from: settings.valid_from,
    valid_until: settings.valid_until,
    notice: settings.notice,
  };
  sessionsText(values, weeklyJumuahPrefix, settings.jumuah_sessions);
  for (const id of prayerIds) {
    const offset = settings.iqamah_offsets[id];
    // A prayer stored with both (before PR4) shows both and its error until
    // the board picks one (D-14 amendment, 2026-10-05).
    values[`mode_${id}`] =
      offset === null ? "fixed" : settings[id] ? "both" : "after";
    values[id] = settings[id];
    values[`offset_${id}`] = offset === null ? "" : String(offset);
  }
  settings.exceptions.forEach((row, i) => {
    values[`exception_${i}_date`] = row.date;
    values[`exception_${i}_reason`] = row.reason;
    for (const id of prayerIds) values[`exception_${i}_${id}`] = row.iqamah[id];
    values[jumuahField(i, "")] = row.jumuah.change;
    if (row.jumuah.change === "changed")
      sessionsText(values, jumuahField(i, ""), row.jumuah.sessions);
  });
  return values;
}

/**
 * The Jumu'ah prayers posted under `prefix`, in order: a prayer counts when
 * its boxes are on the page (an empty one is refused by name, not dropped).
 */
export function postedSessions(
  text: (name: string) => string,
  has: (name: string) => boolean,
  prefix: string,
): JumuahSession[] {
  const sessions: JumuahSession[] = [];
  for (let index = 0; index < maxJumuahSessions + 1; index++) {
    const khutbah = jumuahSessionBox(prefix, index, "khutbah");
    const iqamah = jumuahSessionBox(prefix, index, "iqamah");
    if (!has(khutbah) && !has(iqamah)) break;
    sessions.push({ khutbah: text(khutbah), iqamah: text(iqamah) });
  }
  return sessions;
}

/**
 * A posted Prayer & iqamah form as settings for `prayerSaveSchema`; null
 * when the form is an out-of-date page: no iqamah switch (loaded before PR4
 * WP-4), or the single Jumu'ah boxes of before several prayers (review
 * fixes P2), which would otherwise empty the weekly Jumu'ah. Empty boxes
 * stay empty: the schema refuses what is required (no defaults). The Hijri
 * date stays as calculated (0; review fixes P2).
 */
export function prayerFormValues(form: FormData) {
  const text = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value : "";
  };
  const has = (name: string) => form.has(name);
  const mode = (id: (typeof prayerIds)[number]) => text(`mode_${id}`);
  if (prayerIds.some((id) => !iqamahFormModes.includes(mode(id)))) return null;
  if (has("khutbah") || has("jummah_iqamah")) return null;
  // "both" (a prayer stored with both, not yet picked) posts both boxes, so
  // `prayerSaveSchema` refuses it by name (D-14 amendment, 2026-10-05).
  const clocks = Object.fromEntries(
    prayerIds.map((id) => [id, mode(id) === "after" ? "" : text(id)]),
  ) as Record<(typeof prayerIds)[number], string>;
  const iqamah_offsets = Object.fromEntries(
    prayerIds.map((id) => [
      id,
      mode(id) !== "fixed" && text(`offset_${id}`)
        ? Number(text(`offset_${id}`))
        : null,
    ]),
  );
  // A card counts when anything in it is filled, so an incomplete one is
  // refused by name instead of being dropped silently.
  const exceptions = Array.from({ length: exceptionRows }, (_, i) => {
    const field = (name: string) => text(`exception_${i}_${name}`);
    // The Jumu'ah choices are shown only for a Friday; not shown means no change.
    const change = text(jumuahField(i, "")) || "none";
    return {
      date: field("date"),
      reason: field("reason"),
      iqamah: Object.fromEntries(prayerIds.map((id) => [id, field(id)])),
      jumuah:
        change === "changed"
          ? {
              change,
              sessions: postedSessions(text, has, jumuahField(i, "")),
            }
          : { change },
    };
  }).filter(
    (row) => row.date || row.reason || prayerIds.some((id) => row.iqamah[id]),
  );
  return {
    ...clocks,
    valid_from: text("valid_from"),
    valid_until: text("valid_until"),
    jumuah_sessions: postedSessions(text, has, weeklyJumuahPrefix),
    notice: text("notice"),
    iqamah_offsets,
    exceptions,
    hijri_adjustment: 0,
  };
}
