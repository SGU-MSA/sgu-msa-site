import test from "node:test";
import assert from "node:assert/strict";

import { eventEntry } from "../src/lib/community/event-entry";
import { recordSchema } from "../src/lib/community/schema";
import {
  eventToIcs,
  eventsToIcs,
  feedEvents,
  type IcsCalendar,
} from "../src/lib/calendar/ics";
import { calendarFeedLinks } from "../src/lib/calendar/targets";

// The subscribable calendar feed: one builder shared with the per-event file.
const event = (values: Record<string, unknown> = {}) => {
  const { updated_at: savedAt = "2026-10-05T12:00:00Z", ...rest } = values;
  return eventEntry({
    ...recordSchema.parse({
      id: "9ccbe714-55b4-438a-af30-a1d6ad511910",
      title: "Beach clean-up",
      date: "2026-10-10",
      start_time: "08:00",
      end_time: "10:00",
      location: "Grand Anse Beach",
      body: "Bring water.",
      published: true,
      ...rest,
    }),
    updated_at: (savedAt as string | null) ?? undefined,
  });
};

/** A valid event id for the n-th test event. */
const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const calendar: IcsCalendar = {
  name: "SGU MSA",
  description: "Events, for students.",
  url: "https://msa.example/calendar.ics",
  eventUrl: (id) => `https://msa.example/calendar/${id}`,
};
const stamp = new Date("2026-10-18T10:00:00Z");

test("the feed has the calendar envelope and properties, CRLF, folded lines", () => {
  const feed = eventsToIcs([event({ body: "x".repeat(400) })], calendar, stamp);
  assert.ok(feed.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n"));
  assert.ok(feed.endsWith("END:VCALENDAR"));
  for (const line of [
    "PRODID:-//SGU MSA//Website//EN",
    "METHOD:PUBLISH",
    "NAME:SGU MSA",
    "X-WR-CALNAME:SGU MSA",
    "DESCRIPTION:Events\\, for students.",
    "X-WR-CALDESC:Events\\, for students.",
    "X-WR-TIMEZONE:America/Grenada",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    "SOURCE;VALUE=URI:https://msa.example/calendar.ics",
    "URL:https://msa.example/calendar.ics",
  ])
    assert.ok(feed.split("\r\n").includes(line), line);
  assert.ok(!feed.includes("VTIMEZONE") && !feed.includes("TZID"));
  assert.ok(!feed.includes("VALARM"));
  assert.ok(!feed.replace(/\r\n/g, "").includes("\n"));
  for (const line of feed.split("\r\n"))
    assert.ok(new TextEncoder().encode(line).length <= 75, line);
});

test("one VEVENT per event, with the per-event file's UID, SEQUENCE and times", () => {
  const first = event();
  const second = event({
    id: uuid(2),
    title: "Quran night",
    date: "2026-10-20",
    start_time: "",
    end_time: "",
  });
  const feed = eventsToIcs([first, second], calendar, stamp);
  assert.equal(feed.split("BEGIN:VEVENT").length - 1, 2);
  const single = eventToIcs(first, stamp);
  for (const line of [
    `UID:${first.id}@sgu-msa`,
    "SEQUENCE:" + /SEQUENCE:(\d+)/.exec(single)![1],
    "DTSTART:20261010T120000Z",
    "DTEND:20261010T140000Z",
    "LAST-MODIFIED:20261005T120000Z",
    `URL:https://msa.example/calendar/${first.id}`,
  ]) {
    assert.ok(feed.includes(line), line);
  }
  assert.ok(single.includes("LAST-MODIFIED:20261005T120000Z"));
  assert.ok(!single.includes("\r\nURL:"));
  // All day: exclusive end.
  assert.ok(feed.includes("DTSTART;VALUE=DATE:20261020\r\n"));
  assert.ok(feed.includes("DTEND;VALUE=DATE:20261021\r\n"));
});

test("an event without updated_at has no LAST-MODIFIED", () => {
  const feed = eventsToIcs([event({ updated_at: null })], calendar, stamp);
  assert.ok(!feed.includes("LAST-MODIFIED"));
  assert.ok(feed.includes("SEQUENCE:0"));
});

test("cancelled shows STATUS and title; postponed is tentative", () => {
  const feed = eventsToIcs(
    [
      event({ status: "cancelled", status_note: "Rain." }),
      event({ id: uuid(3), status: "postponed" }),
    ],
    calendar,
    stamp,
  );
  assert.ok(feed.includes("STATUS:CANCELLED"));
  assert.ok(feed.includes("SUMMARY:Cancelled: Beach clean-up"));
  assert.ok(feed.includes("STATUS:TENTATIVE"));
});

test("the feed carries every public event, past included, by date then time", () => {
  const events = [
    event({ id: uuid(13), date: "2026-11-01", start_time: "09:00" }),
    event({ id: uuid(11), date: "2025-01-01" }),
    event({ id: uuid(12), date: "2026-11-01", start_time: "08:00" }),
  ];
  const ids = feedEvents(events, "2026-10-18").map((entry) => entry.id);
  assert.deepEqual(ids, [uuid(11), uuid(12), uuid(13)]);
  assert.equal(events[0].id, uuid(13), "the input is not reordered");
});

test("200 events with long descriptions stay under 1 MB", () => {
  const events = Array.from({ length: 200 }, (_, index) =>
    event({ id: uuid(100 + index), body: "d".repeat(1000) }),
  );
  const feed = eventsToIcs(events, calendar, stamp);
  assert.ok(new TextEncoder().encode(feed).length < 1_000_000);
});

test("subscribe addresses: webcal, Google cid and Outlook url are encoded", () => {
  const links = calendarFeedLinks("https://msa.example", "SGU MSA & Co");
  assert.equal(links.file, "webcal://msa.example/calendar.ics");
  const google = new URL(links.google);
  assert.equal(
    google.origin + google.pathname,
    "https://calendar.google.com/calendar/render",
  );
  assert.equal(google.searchParams.get("cid"), links.file);
  const outlook = new URL(links.outlook);
  assert.equal(outlook.pathname, "/calendar/0/addfromweb");
  assert.equal(
    outlook.searchParams.get("url"),
    "https://msa.example/calendar.ics",
  );
  assert.equal(outlook.searchParams.get("name"), "SGU MSA & Co");
  assert.ok(!links.outlook.includes("& Co"));
});
