import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { formatTimeOfDay, timeOfDay } from "../src/lib/time/time-of-day";
import { TimeOfDay } from "../src/shared/ui/TimeOfDay";

// ICU versions differ in the space before AM/PM (U+202F or a plain space).
const plain = (value: string | Date) =>
  formatTimeOfDay(value).replace(/\s/g, " ");

test("stored 24-hour times read on a 12-hour clock (D-8)", () => {
  assert.equal(plain("00:00"), "12:00 AM");
  assert.equal(plain("12:00"), "12:00 PM");
  assert.equal(plain("13:30"), "1:30 PM");
  assert.equal(plain("09:05"), "9:05 AM");
  assert.equal(plain("23:59"), "11:59 PM");
  assert.equal(plain(" 05:12 "), "5:12 AM");
  assert.deepEqual(timeOfDay("13:30").dateTime, "13:30");
});

test("instants read in Grenada time, whatever the server's zone", () => {
  // 21:56 UTC is 5:56 PM in Grenada (UTC−04:00); 03:30 UTC is still the evening before.
  const maghrib = new Date("2026-10-03T21:56:00Z");
  assert.equal(plain(maghrib), "5:56 PM");
  assert.equal(plain(new Date("2026-10-04T03:30:00Z")), "11:30 PM");
  assert.equal(timeOfDay(maghrib).dateTime, "2026-10-03T21:56:00.000Z");
  assert.deepEqual(timeOfDay(new Date("not a date")), {
    label: "",
    dateTime: null,
  });
});

test("text that is not a stored time passes through, trimmed", () => {
  for (const [value, expected] of [
    ["6:40 PM", "6:40 PM"],
    ["  After Isha ", "After Isha"],
    ["", ""],
    ["24:00", "24:00"],
    ["25:10", "25:10"],
    ["9:05", "9:05"],
    ["12:60", "12:60"],
  ]) {
    assert.deepEqual(timeOfDay(value), { label: expected, dateTime: null });
  }
});

test("<TimeOfDay> wraps stored times in <time> and leaves other text plain", () => {
  const html = (value: string | Date, className?: string) =>
    renderToStaticMarkup(
      createElement(TimeOfDay, { value, className }),
    ).replace(/\s/g, " ");
  assert.equal(
    html("13:30", "t"),
    '<time class="t" dateTime="13:30">1:30 PM</time>',
  );
  assert.equal(
    html(new Date("2026-10-03T21:56:00Z")),
    '<time dateTime="2026-10-03T21:56:00.000Z">5:56 PM</time>',
  );
  assert.equal(html("After Isha"), "<span>After Isha</span>");
  assert.equal(html(""), "");
});
