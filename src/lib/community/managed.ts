import {
  changedTodayNote,
  congregationTimes,
  isScheduleCurrent,
  jumuahDisplay,
  jumuahFor,
  scheduleNotice,
  type ScheduleNoticeState,
} from "@/lib/prayer/congregation";
import "server-only";
import { calculatePrayers } from "@/lib/prayer/calculate";
import { musallahPin } from "@/lib/maps";
import { requestNow } from "@/lib/runtime/public-cache";
import {
  getEvents,
  getJumuah,
  getNewsletters,
  getPrayer,
  type SiteEvent,
} from "@/lib/content";
import { eventEntry, newsletterIssue } from "./event-entry";
import { getLists, getPrayerSettings, getRecords } from "./queries";
import { currentUrgentNotices, localDate } from "./schema";

/**
 * The public events with their category and term names (review fixes P3),
 * the Lists for the filters, and today in Grenada on the server clock (the
 * calendar rings today).
 */
export async function managedEvents() {
  const [result, { lists }, now] = await Promise.all([
    getRecords("events"),
    getLists(),
    requestNow(),
  ]);
  const events: SiteEvent[] = result.records.map((record) =>
    eventEntry(record, lists),
  );
  return {
    ...(await getEvents()),
    events,
    lists,
    today: localDate(now),
    unavailable: result.unavailable,
  };
}

/**
 * The urgent band's notices (PR5a D-16, D-30): current now on the server
 * clock, newest first, each with its announcement page.
 */
export async function managedUrgentNotices() {
  const { records } = await getRecords("announcements");
  return currentUrgentNotices(records, await requestNow()).map((notice) => ({
    id: notice.id,
    title: notice.title,
    href: `/community/announcements/${notice.id}`,
  }));
}

/**
 * Today's and tomorrow's prayer starts at the musallah pin (PR7), on the
 * server clock: the one place pages and the dashboard get calculated starts.
 * `startsUnavailable`: the pin could not be read, so starts are hidden.
 */
export async function pinStarts(now: Date) {
  const { place, unavailable } = await musallahPin();
  return {
    starts: calculatePrayers(place, now),
    startsUnavailable: unavailable,
  };
}

/**
 * The prayer block for public pages: the board's settings, and the starts
 * calculated once at the musallah pin (`pinStarts`). Pages use `starts` and
 * never calculate themselves; without starts, "after adhan" iqamah hides.
 */
export async function managedPrayer() {
  const now = await requestNow();
  const [{ settings, unavailable, provenance }, { starts, startsUnavailable }] =
    await Promise.all([getPrayerSettings(), pinStarts(now)]);
  const today = localDate(now);
  const current = isScheduleCurrent(settings, today);
  const times = congregationTimes(settings, starts, now);
  const [prayer, jumuah] = await Promise.all([getPrayer(), getJumuah()]);
  const schedule: ScheduleNoticeState = {
    unavailable,
    changedToday: changedTodayNote(settings, today),
    boardNotice: settings.notice || "",
    hasTimes: times.length > 0,
  };
  return {
    settings,
    unavailable,
    provenance,
    starts,
    startsUnavailable,
    /** What the schedule line depends on, for the Pages preview (PR5b WP4). */
    schedule,
    prayer: {
      ...prayer,
      times,
      last_updated_label: current
        ? `Valid ${settings.valid_from} through ${settings.valid_until} · Grenada time`
        : null,
      notice: scheduleNotice(prayer, schedule),
    },
    jumuah: { ...jumuah, ...jumuahDisplay(jumuahFor(settings, now)) },
  };
}

export async function managedNewsletters() {
  const { records, unavailable } = await getRecords("newsletters");
  return {
    ...(await getNewsletters()),
    unavailable,
    // Only issues with something to open: a file or a link (the rule
    // resources follow), so no back issue is listed without a button.
    issues: records.map(newsletterIssue).filter((issue) => issue.file_url),
  };
}
