import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eventToIcs } from "../src/lib/calendar/ics";
import { createSampleContentEditor } from "../src/lib/backend/providers/sample";
import { createSampleActivityLog } from "../src/lib/backend/providers/sample-people";
import { eventEntry } from "../src/lib/community/event-entry";
import { createMockContentProvider } from "../src/lib/community/providers/mock";
import {
  announcementPriority,
  currentUrgentNotices,
  startFrom,
  eventStatusLine,
  isUpcoming,
  isVisible,
  JUMUAH_NOTICE_MINUTES_AFTER,
  localDate,
  recordFormSchema,
  recordFieldNames,
  recordFromRow,
  recordSchema,
  recordToRow,
  URGENT_BAND_MAX_CHARS,
  type Collection,
  type CommunityRecord,
} from "../src/lib/community/schema";
import { demoRecords } from "../src/lib/demo/fixtures";

// PR5a WP2 (docs/contracts/pr5a-notices-events-continuity.md): urgent notices,
// event status, events over two days (review 2) and calendar files.

const notice = (values: Partial<CommunityRecord> = {}) =>
  recordSchema.parse({
    id: randomUUID(),
    title: "Musallah closed until 3:00 PM",
    date: "2026-10-10",
    published: true,
    ...values,
  });
const event = notice;
const refusals = (
  kind: Collection,
  values: Record<string, unknown>,
  now?: Date,
) => {
  const parsed = recordFormSchema(
    kind,
    { image: false, file: false },
    recordFieldNames,
    now,
  ).safeParse({
    id: randomUUID(),
    title: "Item",
    date: "2026-10-10",
    // A newsletter needs its PDF or link; an event's link is a Google Form (PR5b D-25).
    url: kind === "events" ? "" : "https://example.com/letter.pdf",
    ...values,
  });
  return parsed.success
    ? []
    : parsed.error.issues.map((issue) => issue.message);
};

test("priority is derived from featured and the urgent end, never stored (D-1)", () => {
  assert.equal(announcementPriority(notice()), "normal");
  assert.equal(announcementPriority(notice({ featured: true })), "featured");
  assert.equal(
    announcementPriority(notice({ urgent_until: "2026-10-10T19:00:00Z" })),
    "urgent",
  );
  assert.equal(URGENT_BAND_MAX_CHARS, 80);
  assert.equal(JUMUAH_NOTICE_MINUTES_AFTER, 30);
});

test("an urgent notice hides at its exact end minute in Grenada time (D-17)", () => {
  const urgent = notice({ urgent_until: "2026-10-10T15:00:00-04:00" });
  const at = (wall: string) => new Date(`2026-10-10T${wall}-04:00`);
  assert.equal(isVisible(urgent, "announcements", at("14:59:59")), true);
  assert.equal(isVisible(urgent, "announcements", at("15:00:00")), false);
  // Only announcements have an urgent end (E-4).
  assert.equal(isVisible(urgent, "news_posts", at("15:00:00")), true);
});

test("current urgent notices: newest first, then latest saved, then id, so equal ones keep one order (D-30)", () => {
  const now = new Date("2026-10-10T12:00:00-04:00");
  const ends = "2026-10-12T12:00:00-04:00";
  const make = (id: string, date: string, updated_at?: string) => ({
    ...notice({ id, date, urgent_until: ends }),
    ...(updated_at ? { updated_at } : {}),
  });
  const a = make("00000000-0000-4000-8000-00000000000a", "2026-10-09");
  const b = make(
    "00000000-0000-4000-8000-00000000000b",
    "2026-10-10",
    "2026-10-10T10:00:00Z",
  );
  const c = make(
    "00000000-0000-4000-8000-00000000000c",
    "2026-10-10",
    "2026-10-10T11:00:00Z",
  );
  const d = make("00000000-0000-4000-8000-00000000000d", "2026-10-10");
  const e = make("00000000-0000-4000-8000-00000000000e", "2026-10-10");
  const hidden = [
    notice({ urgent_until: "2026-10-10T15:59:00Z" }), // ended at 11:59 Grenada
    notice({ urgent_until: ends, published: false }),
    { ...notice({ urgent_until: ends }), archived_at: "2026-10-09T00:00:00Z" },
    notice({ date: "2026-10-11", urgent_until: ends }), // shows from tomorrow
    notice(),
    notice({ featured: true }),
  ];
  const order = (records: CommunityRecord[]) =>
    currentUrgentNotices(records, now).map((record) => record.id);
  const expected = [c.id, b.id, d.id, e.id, a.id];
  assert.deepEqual(order([a, b, c, d, e, ...hidden]), expected);
  assert.deepEqual(order([...hidden, e, d, c, b, a].reverse()), expected);
});

test("the database's urgent and status rules are mirrored on every parse (D-1, D-20)", () => {
  const issues = (values: Partial<CommunityRecord>) => {
    const parsed = recordSchema.safeParse({
      id: randomUUID(),
      title: "Item",
      date: "2026-10-10",
      ...values,
    });
    return parsed.success
      ? []
      : parsed.error.issues.map((issue) => issue.message);
  };
  const urgent = { urgent_until: "2026-10-10T20:00:00Z" };
  assert.deepEqual(issues(urgent), []);
  assert.deepEqual(issues({ ...urgent, featured: true }), [
    "Hide at: an urgent notice is not also featured.",
  ]);
  assert.deepEqual(issues({ ...urgent, expires_on: "2026-10-12" }), [
    "Hide after: leave empty for an urgent notice; it ends at Hide at.",
  ]);
  // 9 Oct, 11 PM in Grenada is before the notice's date; midnight is not.
  assert.deepEqual(issues({ urgent_until: "2026-10-10T03:00:00Z" }), [
    "Hide at: choose a time on or after the item's date.",
  ]);
  assert.deepEqual(issues({ urgent_until: "2026-10-10T04:00:00Z" }), []);
  assert.deepEqual(issues({ urgent_until: "10 Oct, 3 PM" }), [
    "Hide at: choose a valid date and time.",
  ]);
  assert.deepEqual(issues({ status: "cancelled" }), [
    "Reason: fill in this box for a cancelled event.",
  ]);
  assert.deepEqual(issues({ status: "cancelled", status_note: "   " }), [
    "Reason: fill in this box for a cancelled event.",
  ]);
  assert.deepEqual(issues({ status: "cancelled", status_note: "Rain" }), []);
  assert.deepEqual(issues({ status: "postponed" }), []);
  assert.deepEqual(issues({ status_note: "x".repeat(251) }), [
    "Reason: use 250 characters or fewer.",
  ]);
  assert.equal(issues({ status: "moved" as never }).length, 1);
});

test("a board save: urgent title at most 80 characters and ending later than now; the end after the start (D-16, review 2)", () => {
  const now = new Date("2026-10-10T12:00:00-04:00");
  const urgent = { urgent_until: "2026-10-10T18:00:00-04:00" };
  assert.deepEqual(refusals("announcements", urgent, now), []);
  assert.deepEqual(
    refusals("announcements", { ...urgent, title: "x".repeat(81) }, now),
    ["Title: urgent notices fit 80 characters; put the rest in the details."],
  );
  assert.deepEqual(
    refusals("announcements", { title: "x".repeat(81) }, now),
    [],
    "only urgent titles are short",
  );
  assert.deepEqual(
    refusals(
      "announcements",
      { urgent_until: "2026-10-10T12:00:00-04:00" },
      now,
    ),
    ["Hide at: choose a time later than now."],
  );
  assert.deepEqual(
    refusals("announcements", { urgent_until: "2026-10-10T12:00:00-04:00" }),
    [],
    "without a clock the end is not compared with now",
  );

  // An end time earlier than the start is the next day only with an end date.
  const overnight = { start_time: "22:00", end_time: "03:00" };
  for (const kind of ["events", "announcements", "news_posts"] as const)
    assert.deepEqual(refusals(kind, overnight), [
      "End time: choose a time after the start time.",
    ]);
  assert.deepEqual(
    refusals("events", { ...overnight, end_date: "2026-10-11" }),
    [],
  );
  for (const kind of ["events", "news_posts"] as const)
    assert.deepEqual(
      refusals(kind, { start_time: "22:00", end_time: "22:00" }),
      ["End time: choose a time after the start time."],
    );
  for (const kind of ["events", "announcements"] as const)
    assert.deepEqual(refusals(kind, { start_time: "", end_time: "03:00" }), [
      "End time: add a start time first.",
    ]);
});

test("the event status line (D-20)", () => {
  assert.equal(eventStatusLine(event()), null);
  assert.equal(
    eventStatusLine(event({ status: "cancelled", status_note: "Rain" })),
    "Cancelled: Rain",
  );
  assert.equal(
    eventStatusLine(event({ status: "postponed" })),
    "Postponed: new date to be announced",
  );
  // A calendar entry (SiteEvent) without a status is scheduled.
  assert.equal(eventStatusLine({}), null);
});

test("events over two days stay upcoming until their end the next morning (review 2)", () => {
  const night = {
    date: "2026-10-10",
    start_time: "22:00",
    end_date: "2026-10-11",
    end_time: "03:00",
  };
  const at = (iso: string) => new Date(`${iso}-04:00`);
  assert.equal(isUpcoming(night, at("2026-10-10T23:30:00")), true);
  assert.equal(isUpcoming(night, at("2026-10-11T02:00:00")), true);
  assert.equal(isUpcoming(night, at("2026-10-11T03:00:00")), false);
  const evening = {
    date: "2026-10-10",
    start_time: "22:00",
    end_time: "23:00",
  };
  assert.equal(isUpcoming(evening, at("2026-10-10T23:30:00")), false);
  // All day over three days: until the end of the last day.
  const week = { date: "2026-10-10", end_date: "2026-10-12" };
  assert.equal(isUpcoming(week, at("2026-10-12T23:00:00")), true);
  assert.equal(isUpcoming(week, at("2026-10-13T00:00:00")), false);
});

test("calendar files: one UID, a status for each state, a growing SEQUENCE, an end on a later day (D-20, E-8, review 2)", () => {
  const base = event({
    id: "9ccbe714-55b4-438a-af30-a1d6ad511910",
    title: "Beach clean-up",
    start_time: "08:00",
    end_time: "10:00",
  });
  const ics = (values: Partial<CommunityRecord>, updated_at?: string) =>
    eventToIcs(
      eventEntry({ ...base, ...values, ...(updated_at ? { updated_at } : {}) }),
      new Date("2026-10-05T12:00:00Z"),
    );
  const scheduled = ics({}, "2026-01-01T00:00:10Z");
  assert.match(
    scheduled,
    /^UID:9ccbe714-55b4-438a-af30-a1d6ad511910@sgu-msa$/m,
  );
  assert.match(scheduled, /^STATUS:CONFIRMED$/m);
  assert.match(scheduled, /^SEQUENCE:10$/m);
  assert.match(scheduled, /^SUMMARY:Beach clean-up$/m);

  const cancelled = ics(
    { status: "cancelled", status_note: "Storm" },
    "2026-10-05T12:00:00.123456+00:00",
  );
  assert.match(cancelled, /^STATUS:CANCELLED$/m);
  assert.match(cancelled, /^SUMMARY:Cancelled: Beach clean-up$/m);
  assert.match(
    cancelled,
    /^UID:9ccbe714-55b4-438a-af30-a1d6ad511910@sgu-msa$/m,
  );
  const sequence = (text: string) => Number(/^SEQUENCE:(\d+)$/m.exec(text)![1]);
  assert.ok(sequence(cancelled) > sequence(scheduled));
  assert.ok(sequence(cancelled) < 2 ** 31, "fits the ICS integer");

  assert.match(ics({ status: "postponed" }), /^STATUS:TENTATIVE$/m);
  // No version, or a sandbox version (not a time): 0.
  assert.match(ics({}), /^SEQUENCE:0$/m);
  assert.match(ics({}, randomUUID()), /^SEQUENCE:0$/m);

  const night = ics({
    date: "2026-10-10",
    start_time: "22:00",
    end_date: "2026-10-11",
    end_time: "03:00",
  });
  assert.match(night, /^DTSTART:20261011T020000Z$/m);
  assert.match(night, /^DTEND:20261011T070000Z$/m);
  // All day: the day after the last day ends it (exclusive).
  const allDay = ics({
    date: "2026-10-10",
    start_time: "",
    end_date: "2026-10-12",
    end_time: "",
  });
  assert.match(allDay, /^DTSTART;VALUE=DATE:20261010$/m);
  assert.match(allDay, /^DTEND;VALUE=DATE:20261013$/m);
});

test("eventEntry: one view of an event for the public pages and the preview", () => {
  const record = {
    ...event({
      title: "Welcome dinner",
      body: "",
      summary: "Food and friends",
      status: "postponed",
      status_note: "Exams week",
      end_date: "2026-10-11",
      url: "https://forms.gle/example",
    }),
    updated_at: "2026-10-05T12:00:00Z",
  };
  const entry = eventEntry(record);
  assert.equal(entry.description, "Food and friends");
  assert.equal(entry.registration_url, "https://forms.gle/example");
  assert.equal(entry.verification_status, "verified");
  assert.deepEqual(
    [entry.status, entry.status_note, entry.end_date, entry.updated_at],
    ["postponed", "Exams week", "2026-10-11", "2026-10-05T12:00:00Z"],
  );
  assert.equal(eventEntry(event()).end_date, null);
});

test("each collection stores only its own columns; empty dates and times are null (E-4)", () => {
  const record = notice({
    urgent_until: "2026-10-10T20:00:00Z",
    status: "cancelled",
    status_note: "Rain",
    end_date: "",
  });
  const announcement = recordToRow("announcements", record);
  assert.equal(announcement.urgent_until, "2026-10-10T20:00:00Z");
  assert.ok(!("status" in announcement) && !("end_date" in announcement));
  assert.equal(announcement.expires_on, null);
  const events = recordToRow("events", record);
  assert.ok(!("urgent_until" in events));
  assert.deepEqual(
    [events.status, events.status_note, events.end_date],
    ["cancelled", "Rain", null],
  );
  for (const kind of ["news_posts", "newsletters"] as const) {
    const row = recordToRow(kind, record);
    assert.ok(!("urgent_until" in row) && !("status" in row));
  }

  // Reading: nulls are "", a table without a column gets the default, the version is kept.
  const read = recordFromRow({
    ...recordToRow("announcements", notice()),
    updated_at: "2026-10-05T12:00:00Z",
  });
  assert.deepEqual(
    [read.urgent_until, read.status, read.end_date, read.updated_at],
    ["", "scheduled", "", "2026-10-05T12:00:00Z"],
  );
});

test("a new item from another is not urgent, scheduled, with no date (review fixes P3)", () => {
  const copy = startFrom(
    event({
      status: "postponed",
      status_note: "Exams",
      urgent_until: "2026-10-10T20:00:00Z",
    }),
    randomUUID(),
  );
  assert.deepEqual(
    [copy.urgent_until, copy.status, copy.status_note, copy.date],
    ["", "scheduled", "", ""],
  );
});

test("sandbox: saves keep only the collection's own fields, as the database does (E-4)", async () => {
  const seed = new Date("2032-03-01T12:00:00Z");
  const editor = createSampleContentEditor(seed);
  const row = event({
    date: localDate(seed),
    urgent_until: "2032-03-01T20:00:00Z",
    status: "cancelled",
    status_note: "Rain",
  });
  assert.deepEqual(await editor.saveRecord("events", row, null), { ok: true });
  const saved = (await editor.readRecord("events", row.id)).record!;
  assert.deepEqual(
    [saved.urgent_until, saved.status, saved.status_note],
    ["", "cancelled", "Rain"],
  );
  const other = notice({
    urgent_until: "2032-03-01T20:00:00Z",
    status: "postponed",
  });
  await editor.saveRecord("announcements", other, null);
  const stored = (await editor.readRecord("announcements", other.id)).record!;
  assert.deepEqual(
    [stored.urgent_until, stored.status],
    ["2032-03-01T20:00:00Z", "scheduled"],
  );
});

test("sandbox samples: two urgent notices, one ending later today; cancelled, postponed, overnight and all-day events", async () => {
  const seed = new Date("2032-04-01T09:00:00-04:00");
  const announcements = demoRecords("announcements", seed);
  const urgent = currentUrgentNotices(announcements, seed);
  assert.equal(urgent.length, 2);
  assert.ok(
    urgent.some(
      (record) => localDate(new Date(record.urgent_until)) === localDate(seed),
    ),
  );
  for (const record of urgent)
    assert.ok(record.title.length <= URGENT_BAND_MAX_CHARS);
  const events = demoRecords("events", seed);
  assert.deepEqual(
    events.map((record) => eventStatusLine(record)).filter(Boolean),
    [
      "Cancelled: Tropical storm warning, campus closed.",
      "Postponed: new date to be announced",
    ],
  );
  assert.ok(
    events.some(
      (record) =>
        record.end_date > record.date && record.end_time < record.start_time,
    ),
  );
  assert.ok(
    events.some(
      (record) => !record.start_time && record.end_date > record.date,
    ),
  );
  // Public sandbox reads return them; the band is fed by `currentUrgentNotices`.
  const { records } =
    await createMockContentProvider(seed).getRecords("announcements");
  assert.equal(currentUrgentNotices(records, seed).length, 2);
});

test("sandbox Recent changes highlights urgent notices, as the database does (D-17)", async () => {
  const seed = new Date("2032-05-01T12:00:00Z");
  const editor = createSampleContentEditor(seed);
  const log = createSampleActivityLog(seed);
  const plain = notice({ date: localDate(seed) });
  await editor.saveRecord("announcements", plain, null);
  const urgent = { ...plain, urgent_until: "2032-05-01T20:00:00Z" };
  const saved = (await editor.readRecord("announcements", plain.id)).record!;
  await editor.saveRecord("announcements", urgent, saved.updated_at);
  const { entries } = await log.list({ limit: 2, recordId: plain.id });
  assert.deepEqual(
    entries.map((entry) => entry.highlight),
    [true, false],
  );
});
