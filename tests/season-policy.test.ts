import test from "node:test";
import assert from "node:assert/strict";
import {
  BOARD_DATE_REACH_DAYS,
  resolveAnchorDay,
  resolveSeason,
  seasonContext,
} from "../src/lib/community/season-policy";
import {
  seasonFromRow,
  seasonSchema,
  type Season,
} from "../src/lib/community/seasons";

// PR6 WP-4: when each season falls (D-12, D-13, D-15, D-22, D-24; ADR 0021).

const season = (fields: Partial<Season>): Season =>
  seasonSchema.parse({
    id: "00000000-0000-4000-8000-0000000005a1",
    name: "Ramadan",
    hijri_month: 9,
    hijri_first_day: 1,
    hijri_last_day: null,
    ...fields,
  });
const ramadan = season({});
const eid = season({
  id: "00000000-0000-4000-8000-0000000005a2",
  name: "Eid al-Fitr",
  hijri_month: 10,
  hijri_first_day: 1,
  hijri_last_day: 1,
});

test("an Islamic season shows its current or next occurrence, expected from hijri.ts", () => {
  const expected = {
    state: "dates",
    first: "2027-02-08",
    last: "2027-03-08",
    firstStatus: "expected",
    lastStatus: "expected",
    hijriYear: 1448,
    boardDayIgnored: false,
  };
  assert.deepEqual(resolveSeason(ramadan, "2026-10-05", 0), expected);
  assert.deepEqual(resolveSeason(ramadan, "2027-03-08", 0), expected);
  // The day after, the next Ramadan.
  const next = resolveSeason(ramadan, "2027-03-09", 0);
  assert.equal(next.state === "dates" && next.hijriYear, 1449);
  // The adjustment moves it (+1: a day earlier).
  const earlier = resolveSeason(ramadan, "2026-10-05", 1);
  assert.equal(earlier.state === "dates" && earlier.first, "2027-02-07");
  // Eid al-Fitr resolves alone, and is still today on its own day.
  assert.deepEqual(resolveSeason(eid, "2027-03-09", 0), {
    ...expected,
    first: "2027-03-09",
    last: "2027-03-09",
  });
});

test("confirmed days apply within reach; the last day moves with a confirmed first day", () => {
  const confirmedStart = resolveSeason(
    season({ board_starts_on: "2027-02-09" }),
    "2026-10-05",
    0,
  );
  assert.deepEqual(confirmedStart, {
    state: "dates",
    first: "2027-02-09",
    last: "2027-03-09",
    firstStatus: "confirmed",
    lastStatus: "expected",
    hijriYear: 1448,
    boardDayIgnored: false,
  });
  const both = resolveSeason(
    season({ board_starts_on: "2027-02-09", board_ends_on: "2027-03-10" }),
    "2027-03-10",
    0,
  );
  assert.equal(both.state === "dates" && both.lastStatus, "confirmed");
  assert.equal(both.state === "dates" && both.last, "2027-03-10");
  // A one-day season confirmed a day later moves as a whole.
  const lateEid = resolveSeason(
    { ...eid, board_starts_on: "2027-03-10" },
    "2027-03-01",
    0,
  );
  assert.equal(lateEid.state === "dates" && lateEid.last, "2027-03-10");
});

test("a confirmed day out of reach is last year's: ignored and flagged", () => {
  assert.equal(BOARD_DATE_REACH_DAYS, 5);
  // Last year's confirmed first day of Ramadan 1447.
  const stale = resolveSeason(
    season({ board_starts_on: "2026-02-19" }),
    "2026-10-05",
    0,
  );
  assert.equal(stale.state === "dates" && stale.first, "2027-02-08");
  assert.equal(stale.state === "dates" && stale.firstStatus, "expected");
  assert.equal(stale.state === "dates" && stale.boardDayIgnored, true);
  // Six days off: out of reach.
  const far = resolveSeason(
    season({ board_starts_on: "2027-02-14" }),
    "2026-10-05",
    0,
  );
  assert.equal(far.state === "dates" && far.boardDayIgnored, true);
});

test("typed seasons have their days, then nothing after their last day", () => {
  const week = season({
    name: "Islamic Awareness Week",
    hijri_month: null,
    hijri_first_day: null,
    board_starts_on: "2026-11-02",
    board_ends_on: "2026-11-06",
  });
  assert.deepEqual(resolveSeason(week, "2026-10-05", null), {
    state: "dates",
    first: "2026-11-02",
    last: "2026-11-06",
    firstStatus: "typed",
    lastStatus: "typed",
    hijriYear: null,
    boardDayIgnored: false,
  });
  assert.deepEqual(resolveSeason(week, "2026-11-07", 0), { state: "over" });
});

test("no adjustment (prayer settings unreadable) means dates unavailable, never a silent 0", () => {
  assert.deepEqual(resolveSeason(ramadan, "2026-10-05", null), {
    state: "unavailable",
  });
  const context = seasonContext([ramadan, eid], "2026-10-05", null);
  assert.deepEqual(
    [...context.values()],
    [{ state: "unavailable" }, { state: "unavailable" }],
  );
});

test("resolveAnchorDay: the season with that anchor counts its confirmed day; else the expected day", () => {
  const shawwal = { hijriMonth: 10, hijriDay: 1 };
  assert.equal(resolveAnchorDay(shawwal, [], "2026-10-05", 0), "2027-03-09");
  assert.equal(
    resolveAnchorDay(
      shawwal,
      [{ ...eid, board_starts_on: "2027-03-10" }],
      "2026-10-05",
      0,
    ),
    "2027-03-10",
  );
  // On Eid itself it is today; the day after, next year's.
  assert.equal(resolveAnchorDay(shawwal, [eid], "2027-03-09", 0), "2027-03-09");
  assert.equal(
    resolveAnchorDay(shawwal, [eid], "2027-03-10", 0)! > "2028-01-01",
    true,
  );
  assert.equal(resolveAnchorDay(shawwal, [eid], "2026-10-05", null), null);
});

test("season rows: null days read as empty; the checks mirror the database", () => {
  const row = seasonFromRow({
    id: ramadan.id,
    name: "Ramadan",
    hijri_month: 9,
    hijri_first_day: 1,
    hijri_last_day: null,
    board_starts_on: null,
    board_ends_on: null,
    archived_at: null,
  });
  assert.equal(row.board_starts_on, "");
  for (const bad of [
    { hijri_first_day: null },
    { hijri_last_day: 0 },
    { hijri_first_day: 10, hijri_last_day: 9 },
    { hijri_month: null, hijri_first_day: null },
    { board_starts_on: "2027-02-10", board_ends_on: "2027-02-09" },
  ])
    assert.equal(
      seasonSchema.safeParse({ ...ramadan, ...bad }).success,
      false,
      JSON.stringify(bad),
    );
});
