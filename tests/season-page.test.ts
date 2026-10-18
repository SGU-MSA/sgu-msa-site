import test from "node:test";
import assert from "node:assert/strict";

import {
  nextLine,
  seasonPageState,
  tonightState,
} from "../src/lib/community/season-page";
import { seasonSchema } from "../src/lib/community/seasons";
import { tonightRows } from "../src/features/season/tonight";

// PR5c: a season's page over the year (Q-10a/b, D-26, D-31).
const ramadan = seasonSchema.parse({
  id: "00000000-0000-4000-8000-0000000005a1",
  name: "Ramadan",
  slug: "ramadan",
  hijri_month: 9,
  hijri_first_day: 1,
  hijri_last_day: null,
});
const week = seasonSchema.parse({
  id: "00000000-0000-4000-8000-0000000005a4",
  name: "Islamic Awareness Week",
  hijri_month: null,
  hijri_first_day: null,
  hijri_last_day: null,
  board_starts_on: "2026-10-19",
  board_ends_on: "2026-10-21",
});

test("outside Ramadan: the expected start, and the content labelled with last year (Gregorian only)", () => {
  const state = seasonPageState(ramadan, "2026-10-06", 0);
  assert.equal(state.during, false);
  assert.equal(state.label, "Ramadan 2026");
  assert.match(
    state.next ?? "",
    /^Ramadan 2027 is expected to start around \d{1,2} Feb\.$/,
  );
  // No Hijri year anywhere (D-31).
  assert.doesNotMatch(`${state.label} ${state.next}`, /\b1[345]\d\d\b|\bAH\b/);
});

test("in Ramadan: this year's label, no next line", () => {
  const before = seasonPageState(ramadan, "2026-10-06", 0);
  const first = before.dates!.first;
  const state = seasonPageState(ramadan, first, 0);
  assert.equal(state.during, true);
  assert.equal(state.label, `Ramadan ${first.slice(0, 4)}`);
  assert.equal(state.next, null);
});

test("a confirmed first day is said as a date, not 'around'", () => {
  const expected = seasonPageState(ramadan, "2026-10-06", 0).dates!;
  const confirmed = seasonPageState(
    { ...ramadan, board_starts_on: expected.first },
    "2026-10-06",
    0,
  );
  assert.equal(confirmed.dates?.firstStatus, "confirmed");
  assert.match(
    confirmed.next ?? "",
    /^Ramadan 2027 starts on \w{3} \d{1,2} Feb\.$/,
  );
  assert.equal(
    nextLine("Ramadan", { ...expected, firstStatus: "expected" }),
    `Ramadan ${expected.first.slice(0, 4)} is expected to start around ${Number(expected.first.slice(8))} Feb.`,
  );
});

test("typed days: upcoming says when it starts; after it ends the label keeps its year", () => {
  const upcoming = seasonPageState(week, "2026-10-06", 0);
  assert.equal(upcoming.during, false);
  assert.equal(
    upcoming.next,
    "Islamic Awareness Week 2026 starts on Mon 19 Oct.",
  );
  assert.equal(seasonPageState(week, "2026-10-20", 0).during, true);
  const over = seasonPageState(week, "2026-11-01", 0);
  assert.deepEqual(
    { during: over.during, label: over.label, next: over.next },
    { during: false, label: "Islamic Awareness Week 2026", next: null },
  );
});

test("dates unavailable (no prayer settings): the name alone, no next line", () => {
  const state = seasonPageState(ramadan, "2026-10-06", null);
  assert.deepEqual(
    { during: state.during, label: state.label, next: state.next },
    { during: false, label: "Ramadan", next: null },
  );
});

test("tonight: night 1 is the evening before the first fast; Eid eve has no night (edge C10)", () => {
  const dates = {
    state: "dates" as const,
    first: "2027-02-08",
    last: "2027-03-09",
    firstStatus: "confirmed" as const,
    lastStatus: "expected" as const,
    hijriYear: 1448,
    boardDayIgnored: false,
  };
  assert.equal(tonightState(ramadan, dates, "2027-02-06"), null);
  assert.deepEqual(tonightState(ramadan, dates, "2027-02-07"), {
    night: "Night 1",
    iftar: false,
    tarawih: true,
  });
  assert.deepEqual(tonightState(ramadan, dates, "2027-02-08"), {
    night: "Night 2",
    iftar: true,
    tarawih: true,
  });
  // The night before the expected last day is still "expected".
  assert.equal(
    tonightState(ramadan, dates, "2027-03-08")?.night,
    "Night 30 (expected)",
  );
  assert.deepEqual(tonightState(ramadan, dates, "2027-03-09"), {
    night: null,
    iftar: true,
    tarawih: false,
  });
  assert.equal(tonightState(ramadan, dates, "2027-03-10"), null);
  // Only seasons in the Ramadan month get the panel.
  assert.equal(tonightState(week, dates, "2027-02-08"), null);
});

test("tonight's rows: Iftar is Maghrib's start, Tarawih is Isha's iqamah; unknown times are left out", () => {
  const times = { maghribStart: "18:22", ishaIqamah: "19:45" };
  assert.deepEqual(
    tonightRows({ night: "Night 2", iftar: true, tarawih: true }, times),
    [
      { label: "Iftar", value: "18:22" },
      { label: "Tarawih", value: "19:45" },
    ],
  );
  assert.deepEqual(
    tonightRows({ night: "Night 1", iftar: false, tarawih: true }, times),
    [{ label: "Tarawih", value: "19:45" }],
  );
  assert.deepEqual(
    tonightRows(
      { night: "Night 2", iftar: true, tarawih: true },
      { maghribStart: null, ishaIqamah: "19:45" },
    ),
    [{ label: "Tarawih", value: "19:45" }],
  );
});
