import test from "node:test";
import assert from "node:assert/strict";
import { hijriSpan, hijriYearOf, ramadanSpan } from "../src/lib/time/hijri";
import { addDays, daysBetween } from "../src/lib/time/days";

// PR6 WP-4: seasons resolve through `hijriSpan`, the generalized `ramadanSpan`
// (one calendar module, one adjustment).

test("hijriSpan: Ramadan is ramadanSpan, for every adjustment", () => {
  for (const year of [1447, 1448, 1449])
    for (const adjustment of [-1, 0, 1] as const)
      assert.deepEqual(
        hijriSpan(year, 9, 1, null, adjustment),
        ramadanSpan(year, adjustment),
      );
});

test("hijriSpan: one-day and part-month seasons, across the year end", () => {
  // Eid al-Fitr 1448 is the day after Ramadan's last day (8 March 2027).
  assert.deepEqual(hijriSpan(1448, 10, 1, 1, 0), {
    first: "2027-03-09",
    last: "2027-03-09",
  });
  assert.deepEqual(hijriSpan(1448, 12, 10, 10, 0), {
    first: "2027-05-16",
    last: "2027-05-16",
  });
  // The first ten days of Dhul Hijjah and the days of tashriq.
  assert.deepEqual(hijriSpan(1448, 12, 10, 13, 0), {
    first: "2027-05-16",
    last: "2027-05-19",
  });
  // Dhul Hijjah ends the day before 1 Muharram of the next year.
  const dhulHijjah = hijriSpan(1448, 12, 1, null, 0)!;
  assert.equal(addDays(dhulHijjah.last, 1), hijriSpan(1449, 1, 1, 1, 0)!.first);
  // +1 shows the Hijri date a day ahead, so the season begins a day earlier.
  assert.deepEqual(hijriSpan(1448, 10, 1, 1, 1), {
    first: "2027-03-08",
    last: "2027-03-08",
  });
});

test("hijriSpan: day 30 of a 29-day month is its last day (D-15)", () => {
  // Ramadan 1448 has 29 days; Ramadan 1447 had 30.
  assert.deepEqual(hijriSpan(1448, 9, 30, 30, 0), {
    first: "2027-03-08",
    last: "2027-03-08",
  });
  assert.deepEqual(hijriSpan(1447, 9, 30, 30, 0), {
    first: "2026-03-19",
    last: "2026-03-19",
  });
});

test("hijriYearOf and whole-day arithmetic", () => {
  assert.equal(hijriYearOf("2026-10-05"), 1448);
  assert.equal(hijriYearOf("2026-06-15"), 1447);
  assert.equal(hijriYearOf("2026-06-16"), 1448);
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2027-03-01", -1), "2027-02-28");
  assert.equal(daysBetween("2026-10-05", "2026-10-08"), 3);
  assert.equal(daysBetween("2026-10-08", "2026-10-05"), -3);
  // No time zone or daylight saving shift (Grenada keeps one offset; UTC noon anyway).
  assert.equal(daysBetween("2026-03-07", "2026-03-09"), 2);
});
