import test from "node:test";
import assert from "node:assert/strict";

import {
  anyDate,
  anyTime,
  boxesOf,
  clockParts,
  clockValue,
  dayLimits,
  dayRange,
  disabledClockParts,
  laterThan,
  timeFloor,
  todayOrLater,
} from "../src/lib/time/field-rules";
import { appearsOn, appearsOnPages } from "../src/features/admin/appears-on";
import { pageFields } from "../src/lib/content/page-fields";
import {
  savedNoteText,
  savedNotes,
} from "../src/features/admin/save-state/saved-note";
import { prayerSavedPath } from "../src/features/admin/jumuah-notices";

const none = () => "";

test("a date box's rule gives its min and max (review fixes P1)", () => {
  assert.deepEqual(dayLimits(anyDate, none), {});
  assert.deepEqual(dayLimits(todayOrLater("2026-10-07"), none), {
    min: "2026-10-07",
  });
  // Another box's day: the later of the two limits counts.
  const after = todayOrLater("2026-10-07", { box: "date" });
  assert.deepEqual(boxesOf(after), ["date"]);
  assert.deepEqual(
    dayLimits(after, () => "2026-11-01"),
    { min: "2026-11-01" },
  );
  assert.deepEqual(
    dayLimits(after, () => "2026-01-01"),
    { min: "2026-10-07" },
  );
  // An empty or unfinished box adds no limit.
  assert.deepEqual(
    dayLimits(after, () => "2026-1"),
    { min: "2026-10-07" },
  );
  assert.deepEqual(
    dayLimits(
      dayRange({ from: "2026-03-01", until: ["2026-03-20", "2026-03-11"] }),
      none,
    ),
    { min: "2026-03-01", max: "2026-03-11" },
  );
  assert.deepEqual(dayLimits(dayRange({ from: { box: "from" } }), none), {});
});

test("the time box reads 12-hour and posts 24-hour HH:MM", () => {
  assert.deepEqual(clockParts("00:05"), {
    hour: "12",
    minute: "05",
    period: "AM",
  });
  assert.deepEqual(clockParts("12:00"), {
    hour: "12",
    minute: "00",
    period: "PM",
  });
  assert.deepEqual(clockParts("13:30"), {
    hour: "1",
    minute: "30",
    period: "PM",
  });
  assert.deepEqual(clockParts("not a time"), {
    hour: "",
    minute: "",
    period: "",
  });
  for (const value of [
    "00:00",
    "00:59",
    "09:05",
    "11:59",
    "12:00",
    "12:30",
    "13:07",
    "23:59",
  ])
    assert.equal(clockValue(clockParts(value)), value);
  assert.equal(clockValue({ hour: "", minute: "", period: "" }), "");
  // Some parts only: refused by every time rule, never saved as a guess.
  assert.equal(
    clockValue({ hour: "7", minute: "00", period: "" }),
    "incomplete",
  );
});

test("times at or before a later-than limit are greyed out", () => {
  assert.equal(timeFloor(anyTime, none), null);
  assert.equal(
    timeFloor(laterThan({ box: "start_time" }), () => "13:30"),
    "13:30",
  );
  assert.equal(
    timeFloor(laterThan({ box: "start_time" }), () => ""),
    null,
  );
  const empty = { hour: "", minute: "", period: "" } as const;
  assert.equal(disabledClockParts(null, empty).hours.size, 0);
  // After 1:30 PM: AM is out; with PM chosen, 12 and 1 o'clock lose most minutes.
  const afterHalfOne = disabledClockParts("13:30", { ...empty, period: "PM" });
  assert.deepEqual([...afterHalfOne.periods], ["AM"]);
  assert.deepEqual([...afterHalfOne.hours], ["12"]);
  const atOne = disabledClockParts("13:30", {
    hour: "1",
    minute: "",
    period: "PM",
  });
  assert.ok(atOne.minutes.has("30"));
  assert.ok(!atOne.minutes.has("31"));
  // Nothing chosen yet: an hour is out only when it is out in both halves
  // (12 AM and 12 PM both come before 1:30 PM).
  assert.deepEqual([...disabledClockParts("13:30", empty).hours], ["12"]);
  assert.equal(disabledClockParts("09:00", empty).hours.size, 0);
});

test("each editor says where it appears, from the one page list", () => {
  assert.deepEqual(appearsOn("events"), [
    { label: "Events page", href: "/calendar" },
    { label: "Home", href: "/" },
  ]);
  assert.deepEqual(appearsOn("funds"), [{ label: "Donate", href: "/donate" }]);
  assert.deepEqual(appearsOn("people"), [{ label: "About", href: "/about" }]);
  assert.deepEqual(
    appearsOn("prayer").map((link) => link.href),
    ["/prayer", "/"],
  );
  assert.deepEqual(appearsOn("page:about"), [
    { label: "About", href: "/about" },
  ]);
  // A page with no public address of its own says where its words show
  // (review follow-ups, 2026-10-07); every such page has a line.
  assert.deepEqual(appearsOn("page:site"), [{ label: "every page" }]);
  assert.deepEqual(appearsOn("page:reminder-places"), [
    { label: "every page" },
  ]);
  assert.deepEqual(appearsOn("page:integrations"), [
    { label: "Go2Pay receipts" },
  ]);
  assert.deepEqual(
    appearsOn("seasons", [{ label: "Ramadan", href: "/ramadan" }]),
    [{ label: "Ramadan", href: "/ramadan" }],
  );
  // Every Pages entry says where it shows, except Sign-up forms, which say
  // it beside each form.
  for (const [key, page] of Object.entries(pageFields))
    if (key !== "forms")
      assert.ok(
        appearsOn(`page:${key as keyof typeof pageFields}`).length,
        `${page.title} has an Appears on line`,
      );
  for (const area of Object.keys(
    appearsOnPages,
  ) as (keyof typeof appearsOnPages)[])
    for (const link of appearsOn(area))
      assert.match(link.href ?? "", /^\/[a-z-]*$/);
});

test("a save opens a clean address; the toast reads the save's mark", () => {
  assert.equal(prayerSavedPath(true), "/admin/prayer-times");
  assert.equal(prayerSavedPath(false), "/admin/prayer-times?notice=failed");
  assert.equal(savedNoteText("saved"), savedNotes.saved);
  assert.equal(savedNoteText("moved"), savedNotes.moved);
  assert.equal(savedNoteText("<script>"), null);
  assert.equal(savedNoteText(undefined), null);
});
