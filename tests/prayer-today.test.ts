import test from "node:test";
import assert from "node:assert/strict";

import {
  nextPrayer,
  startsMissingNote,
  todayLabel,
  todayRows,
} from "../src/features/prayer/today";

// Saturday 3 October 2026 in Grenada (UTC−4), illustrative starts for two days.
const ids = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"] as const;
const hours = ["08:46", "09:56", "15:57", "19:15", "21:56", "23:02"];
const starts = [0, 1].flatMap((day) =>
  ids.map((id, index) => ({
    id,
    day,
    label: id[0].toUpperCase() + id.slice(1),
    iso: `2026-10-0${3 + day}T${hours[index]}:00.000Z`,
  })),
);
const iqamah = [
  { id: "fajr", label: "Fajr", time: "05:30" },
  { id: "dhuhr", label: "Dhuhr", time: "12:30" },
];

test("today's rows carry all six starts and the iqamah exactly as saved", () => {
  const rows = todayRows(starts, iqamah);
  assert.deepEqual(
    rows.map((row) => row.id),
    [...ids],
  );
  assert.equal(rows[0].iqamah, "05:30");
  assert.equal(rows[1].iqamah, null);
  assert.equal(rows[2].begins?.iso, "2026-10-03T15:57:00.000Z");
});

test("without calculated starts the published iqamah times still show", () => {
  const rows = todayRows([], iqamah);
  assert.deepEqual(
    rows.map((row) => [row.id, row.begins, row.iqamah]),
    [
      ["fajr", null, "05:30"],
      ["dhuhr", null, "12:30"],
    ],
  );
  assert.deepEqual(todayRows([], []), []);
});

test("the next prayer skips Sunrise and rolls to tomorrow's Fajr after Isha", () => {
  assert.equal(
    nextPrayer(starts, new Date("2026-10-03T09:00:00Z"))?.id,
    "dhuhr",
  );
  const late = nextPrayer(starts, new Date("2026-10-03T23:30:00Z"));
  assert.deepEqual([late?.id, late?.day], ["fajr", 1]);
  assert.equal(nextPrayer([], new Date()), null);
});

test("today's label is the Grenada date", () => {
  // 02:00 UTC on 4 October is still 3 October in Grenada.
  assert.equal(
    todayLabel(new Date("2026-10-04T02:00:00Z")),
    "Saturday, October 3",
  );
});

test("when the musallah pin cannot be read, starts say they are temporarily unavailable (PR7 D-10)", () => {
  assert.equal(
    startsMissingNote(true),
    "Prayer start times are temporarily unavailable.",
  );
  assert.equal(
    startsMissingNote(false),
    "Prayer start times will appear once the Musallah location is set.",
  );
});
