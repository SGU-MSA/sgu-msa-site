import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { load } from "js-yaml";

import { remindersSchema, dhikrSlots } from "../src/lib/content/schemas";
import { contentDirectory } from "../src/lib/content/providers/yaml";
import {
  AFTER_PRAYER_MINUTES,
  dhikrSlot,
  isFridayInGrenada,
} from "../src/lib/prayer/dhikr";
import {
  gregorianSpanLabel,
  hijriDate,
  ramadanSpan,
} from "../src/lib/time/hijri";
import {
  ARABIC_FIT_SLACK,
  MARGIN_NOTE,
  arabicEmEstimate,
  fitsOneLine,
} from "../src/shared/ui/arabicFit";

/* ---------------------------------------------------------------- dhikrSlot */

// Saturday 3 October 2026 in Grenada (UTC−4), illustrative starts.
const starts = [
  { id: "fajr", day: 0, iso: "2026-10-03T08:46:00.000Z" }, // 4:46 AM
  { id: "sunrise", day: 0, iso: "2026-10-03T09:56:00.000Z" },
  { id: "dhuhr", day: 0, iso: "2026-10-03T15:57:00.000Z" }, // 11:57 AM
  { id: "asr", day: 0, iso: "2026-10-03T19:15:00.000Z" }, // 3:15 PM
  { id: "maghrib", day: 0, iso: "2026-10-03T21:56:00.000Z" }, // 5:56 PM
  { id: "isha", day: 0, iso: "2026-10-03T23:02:00.000Z" }, // 7:02 PM
  // Tomorrow's rows (calculatePrayers returns two days) are ignored.
  { id: "fajr", day: 1, iso: "2026-10-04T08:46:00.000Z" },
];
const at = (iso: string) => new Date(iso);
const plusMinutes = (iso: string, minutes: number) =>
  new Date(Date.parse(iso) + minutes * 60_000);
const start = (id: string) => starts.find((row) => row.id === id)!.iso;

test("dhikrSlot: after-prayer for the 40 minutes after each prayer starts", () => {
  for (const id of ["fajr", "dhuhr", "asr", "maghrib", "isha"]) {
    assert.equal(dhikrSlot(starts, at(start(id)), false), "after-prayer", id);
    assert.equal(
      dhikrSlot(
        starts,
        plusMinutes(start(id), AFTER_PRAYER_MINUTES - 1),
        false,
      ),
      "after-prayer",
      `${id} + 39 min`,
    );
  }
});

test("dhikrSlot: morning, evening and night windows with exact boundaries", () => {
  const afterFajr = plusMinutes(start("fajr"), AFTER_PRAYER_MINUTES);
  assert.equal(dhikrSlot(starts, afterFajr, false), "morning");
  assert.equal(
    dhikrSlot(starts, plusMinutes(start("dhuhr"), -1), false),
    "morning",
  );
  // Dhuhr–Asr after the 40 minutes stays the after-prayer tasbih.
  assert.equal(
    dhikrSlot(starts, plusMinutes(start("dhuhr"), AFTER_PRAYER_MINUTES), false),
    "after-prayer",
  );
  assert.equal(
    dhikrSlot(starts, plusMinutes(start("asr"), AFTER_PRAYER_MINUTES), false),
    "evening",
  );
  assert.equal(
    dhikrSlot(starts, plusMinutes(start("isha"), -1), false),
    "evening",
  );
  assert.equal(
    dhikrSlot(
      starts,
      plusMinutes(start("maghrib"), AFTER_PRAYER_MINUTES),
      false,
    ),
    "evening",
  );
  assert.equal(
    dhikrSlot(starts, plusMinutes(start("isha"), AFTER_PRAYER_MINUTES), false),
    "night",
  );
  assert.equal(
    dhikrSlot(starts, plusMinutes(start("fajr"), -1), false),
    "night",
  );
  assert.equal(dhikrSlot(starts, at("2026-10-03T04:00:00Z"), false), "night");
});

test("dhikrSlot: Friday between Fajr and Maghrib, after-prayer still first", () => {
  const morning = plusMinutes(start("fajr"), AFTER_PRAYER_MINUTES);
  assert.equal(dhikrSlot(starts, morning, true), "friday");
  assert.equal(
    dhikrSlot(starts, plusMinutes(start("asr"), AFTER_PRAYER_MINUTES), true),
    "friday",
  );
  assert.equal(
    dhikrSlot(starts, plusMinutes(start("maghrib"), -1), true),
    "friday",
  );
  assert.equal(dhikrSlot(starts, at(start("dhuhr")), true), "after-prayer");
  assert.equal(
    dhikrSlot(
      starts,
      plusMinutes(start("maghrib"), AFTER_PRAYER_MINUTES),
      true,
    ),
    "evening",
  );
  assert.equal(
    dhikrSlot(starts, plusMinutes(start("fajr"), -1), true),
    "night",
  );
});

test("dhikrSlot: no slot when today's prayer starts are unavailable", () => {
  assert.equal(dhikrSlot([], at(start("dhuhr")), false), null);
  assert.equal(
    dhikrSlot(
      starts.filter((row) => row.id !== "isha"),
      at(start("dhuhr")),
      false,
    ),
    null,
  );
});

test("isFridayInGrenada uses the Grenada calendar day", () => {
  // Friday 2 October 2026 at 11 PM in Grenada is already Saturday in UTC.
  assert.equal(isFridayInGrenada(at("2026-10-03T03:00:00Z")), true);
  assert.equal(isFridayInGrenada(at("2026-10-03T05:00:00Z")), false);
});

/* ---------------------------------------------------------------- hijriDate */

test("hijriDate: English first, Arabic beneath, following the normal day (D-11)", () => {
  // Saturday 3 October 2026 in Grenada (UTC-4), before and after Maghrib (21:56 UTC).
  const expected = {
    english: "22 Rabiʻ II 1448 AH",
    arabic: "٢٢ ربيع الآخر ١٤٤٨ هـ",
    day: 22,
  };
  assert.deepEqual(hijriDate(at("2026-10-03T14:00:00Z"), 0), expected);
  assert.deepEqual(hijriDate(at("2026-10-03T23:30:00Z"), 0), expected);
  // It changes at midnight in Grenada (04:00 UTC), with the normal date.
  assert.equal(hijriDate(at("2026-10-04T03:59:00Z"), 0).day, 22);
  assert.equal(hijriDate(at("2026-10-04T04:01:00Z"), 0).day, 23);
});

test("ramadanSpan: Ramadan 1448 on Umm al-Qura, with the board's adjustment", () => {
  assert.deepEqual(ramadanSpan(1448, 0), {
    first: "2027-02-08",
    last: "2027-03-08",
  });
  // +1 shows the Hijri date a day ahead, so the month begins a day earlier.
  assert.deepEqual(ramadanSpan(1448, 1), {
    first: "2027-02-07",
    last: "2027-03-07",
  });
  assert.deepEqual(ramadanSpan(1448, -1), {
    first: "2027-02-09",
    last: "2027-03-09",
  });
  assert.deepEqual(ramadanSpan(1447, 0), {
    first: "2026-02-18",
    last: "2026-03-19",
  });
});

test("gregorianSpanLabel: months, one month, and across a new year", () => {
  assert.equal(
    gregorianSpanLabel({ first: "2027-02-08", last: "2027-03-08" }),
    "Feb–Mar 2027",
  );
  assert.equal(
    gregorianSpanLabel({ first: "2030-03-01", last: "2030-03-30" }),
    "Mar 2030",
  );
  assert.equal(
    gregorianSpanLabel({ first: "2030-12-15", last: "2031-01-13" }),
    "Dec 2030 – Jan 2031",
  );
});

/* --------------------------------------------------------- reminders schema */

const file = () =>
  load(
    fs.readFileSync(path.join(contentDirectory, "reminders.yaml"), "utf8"),
  ) as Record<string, unknown>;

test("content/reminders.yaml is valid and has one dhikr per slot", () => {
  const reminders = remindersSchema.parse(file());
  assert.deepEqual(
    reminders.dhikr.map((row) => row.slot).sort(),
    [...dhikrSlots].sort(),
  );
  assert.equal(reminders.tasbih?.phrases.length, 3);
});

test("the reminders schema rejects missing fields", () => {
  const valid = file();
  const dhikr = valid.dhikr as Record<string, unknown>[];
  for (const field of [
    "id",
    "slot",
    "arabic",
    "meaning",
    "reference",
    "source",
  ]) {
    const broken = dhikr.map((row, index) => {
      if (index) return row;
      const copy = { ...row };
      delete copy[field];
      return copy;
    });
    assert.equal(
      remindersSchema.safeParse({ ...valid, dhikr: broken }).success,
      false,
      `dhikr without ${field}`,
    );
  }
  // Empty text, a missing slot, a missing tasbih and a short tasbih all fail.
  assert.equal(
    remindersSchema.safeParse({
      ...valid,
      dhikr: [{ ...dhikr[0], meaning: " " }, ...dhikr.slice(1)],
    }).success,
    false,
  );
  assert.equal(
    remindersSchema.safeParse({ ...valid, dhikr: dhikr.slice(1) }).success,
    false,
  );
  const { tasbih, ...withoutTasbih } = valid;
  assert.equal(remindersSchema.safeParse(withoutTasbih).success, false);
  const short = tasbih as { phrases: string[] };
  assert.equal(
    remindersSchema.safeParse({
      ...valid,
      tasbih: { ...short, phrases: short.phrases.slice(0, 2) },
    }).success,
    false,
  );
});

/* ------------------------------------------------------- one-line Arabic */

test("one-line Arabic: the estimate counts letters only and errs on the wide side", () => {
  // Harakat do not count towards the width.
  assert.equal(
    arabicEmEstimate("رَبِّ زِدْنِى عِلْمًۭا"),
    arabicEmEstimate("رب زدنى علما"),
  );
  // Measured in Amiri Quran (2026-10-05): "وَقُل رَّبِّ زِدْنِى عِلْمًۭا" is 6.22em,
  // "لَن تَنَالُوا۟ ٱلْبِرَّ حَتَّىٰ تُنفِقُوا۟ مِمَّا تُحِبُّونَ" 10.66em.
  assert.ok(arabicEmEstimate("وَقُل رَّبِّ زِدْنِى عِلْمًۭا") >= 6.22);
  assert.ok(
    arabicEmEstimate(
      "لَن تَنَالُوا۟ ٱلْبِرَّ حَتَّىٰ تُنفِقُوا۟ مِمَّا تُحِبُّونَ",
    ) >= 10.66,
  );
  // The verse library's rule (Review 3 E): at most 29 letters, spaces and signs.
  assert.equal(fitsOneLine(arabicEmEstimate("ب".repeat(29))), true);
  assert.equal(fitsOneLine(arabicEmEstimate("ب".repeat(30))), false);
});

test("one-line Arabic: the stylesheet and arabicFit.ts use the same numbers", () => {
  const css = fs.readFileSync(
    path.join(process.cwd(), "src/shared/ui/reminders.module.css"),
    "utf8",
  );
  assert.match(css, new RegExp(`\\* ${ARABIC_FIT_SLACK}\\)`));
  const margin = /:where\(\.marginArabic\) \{([^}]*)\}/.exec(css)![1];
  assert.match(margin, new RegExp(`--arabic-min: ${MARGIN_NOTE.minRem}rem;`));
  assert.match(
    margin,
    new RegExp(`--arabic-reserve: ${MARGIN_NOTE.reserveRem}rem;`),
  );
  assert.match(css, new RegExp(`min\\(${MARGIN_NOTE.widthRem}rem,`));
  // No caller reserves height for lines the text does not use.
  assert.doesNotMatch(css, /data-fit|nowrap;\s*\}\s*:where\(\.arabic/);
});
