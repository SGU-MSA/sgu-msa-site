import test from "node:test";
import assert from "node:assert/strict";

import { eventEntry } from "../src/lib/community/event-entry";
import { recordSchema } from "../src/lib/community/schema";
import { calendarTimes, eventToIcs } from "../src/lib/calendar/ics";
import { calendarLinks, calendarTarget } from "../src/lib/calendar/targets";
import {
  cancelLeaveAfterSave,
  dirtyForms,
  guardForm,
  leaveAfterSave,
  takeLeaveAfterSave,
} from "../src/features/admin/form-check/unsaved";

// Review 2 (2026-10-05): "Add to Calendar" by device, from one reading of the event.
const event = (values: Record<string, unknown> = {}) =>
  eventEntry(
    recordSchema.parse({
      id: "9ccbe714-55b4-438a-af30-a1d6ad511910",
      title: "Beach clean-up",
      date: "2026-10-10",
      start_time: "08:00",
      end_time: "10:00",
      location: "Grand Anse Beach",
      body: "Bring water.",
      published: true,
      ...values,
    }),
  );

test("the device decides: Apple opens the file, Android Google Calendar, other computers a menu", () => {
  const agents = {
    iPhone:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
    // iPadOS reports itself as a Mac.
    iPad: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15",
    android:
      "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36",
    windows:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36",
    linux:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36",
  };
  assert.equal(calendarTarget(agents.iPhone), "file");
  assert.equal(calendarTarget(agents.iPad), "file");
  assert.equal(calendarTarget(agents.android), "google");
  assert.equal(calendarTarget(agents.windows), "menu");
  assert.equal(calendarTarget(agents.linux), "menu");
});

test("Google, Outlook and the file say the same times and words", () => {
  const timed = calendarLinks(event());
  assert.equal(
    timed.file,
    "/calendar/9ccbe714-55b4-438a-af30-a1d6ad511910/ics",
  );
  const google = new URL(timed.google);
  assert.equal(google.hostname, "calendar.google.com");
  assert.equal(google.searchParams.get("text"), "Beach clean-up");
  // 8:00 to 10:00 Grenada time (UTC−04:00).
  assert.equal(
    google.searchParams.get("dates"),
    "20261010T120000Z/20261010T140000Z",
  );
  assert.equal(google.searchParams.get("location"), "Grand Anse Beach");
  assert.equal(google.searchParams.get("details"), "Bring water.");
  const outlook = new URL(timed.outlook);
  assert.equal(outlook.hostname, "outlook.live.com");
  assert.equal(outlook.searchParams.get("subject"), "Beach clean-up");
  assert.equal(outlook.searchParams.get("startdt"), "2026-10-10T12:00:00Z");
  assert.equal(outlook.searchParams.get("enddt"), "2026-10-10T14:00:00Z");
  assert.equal(outlook.searchParams.get("allday"), "false");
  const ics = eventToIcs(event(), new Date("2026-10-05T12:00:00Z"));
  assert.match(ics, /^DTSTART:20261010T120000Z$/m);
  assert.match(ics, /^DTEND:20261010T140000Z$/m);

  // All day over three days: the end is the day after the last day.
  const allDay = event({
    start_time: "",
    end_time: "",
    end_date: "2026-10-12",
  });
  assert.deepEqual(calendarTimes(allDay), {
    allDay: true,
    first: "2026-10-10",
    afterLast: "2026-10-13",
  });
  const allDayLinks = calendarLinks(allDay);
  assert.equal(
    new URL(allDayLinks.google).searchParams.get("dates"),
    "20261010/20261013",
  );
  const allDayOutlook = new URL(allDayLinks.outlook).searchParams;
  assert.deepEqual(
    [
      allDayOutlook.get("startdt"),
      allDayOutlook.get("enddt"),
      allDayOutlook.get("allday"),
    ],
    ["2026-10-10", "2026-10-13", "true"],
  );

  // A cancelled event says so everywhere.
  const cancelled = calendarLinks(
    event({ status: "cancelled", status_note: "Storm" }),
  );
  assert.equal(
    new URL(cancelled.google).searchParams.get("text"),
    "Cancelled: Beach clean-up",
  );
});

test("unsaved changes: only changed forms count; a save from the dialog goes on once", () => {
  let changed = false;
  const stop = guardForm({ dirty: () => changed, save: () => true });
  assert.equal(dirtyForms().length, 0);
  changed = true;
  assert.equal(dirtyForms().length, 1);
  stop();
  assert.equal(dirtyForms().length, 0);

  leaveAfterSave("/admin/people");
  assert.equal(takeLeaveAfterSave(), "/admin/people");
  assert.equal(takeLeaveAfterSave(), null);
  leaveAfterSave("/admin/people");
  cancelLeaveAfterSave();
  assert.equal(takeLeaveAfterSave(), null);
});
