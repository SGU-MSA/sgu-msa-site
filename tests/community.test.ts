import test from "node:test";
import assert from "node:assert/strict";
import {
  collections,
  emptyPrayer,
  isUpcoming,
  isVisible,
  localDate,
  prayerSaveSchema,
  prayerSettingsSchema,
  recordSchema,
  restoredPrayerSettings,
} from "../src/lib/community/schema";
import { CalculationMethod, Coordinates, Madhab, PrayerTimes } from "adhan";
import {
  calculatePrayers,
  prayerCalculation,
} from "../src/lib/prayer/calculate";
import {
  changedTodayNote,
  congregationTimes,
  iqamahOn,
  isScheduleCurrent,
  jumuahDisplay,
  jumuahFor,
  scheduleEndStatus,
} from "../src/lib/prayer/congregation";
import { hijriDate } from "../src/lib/time/hijri";
import { eventToIcs } from "../src/lib/calendar/ics";
import { createMockContentProvider } from "../src/lib/community/providers/mock";
import { fixedClock } from "../src/lib/runtime/clock";

const row = recordSchema.parse({
  id: "9ccbe714-55b4-438a-af30-a1d6ad511910",
  title: "Community gathering",
  date: "2026-09-09",
  published: true,
});
test("Grenada date boundary differs from UTC", () => {
  assert.equal(localDate(new Date("2026-09-10T02:00:00Z")), "2026-09-09");
});
test("drafts, future news, and expired notices stay private", () => {
  const now = new Date("2026-09-09T16:00:00Z");
  assert.equal(isVisible({ ...row, published: false }, "events", now), false);
  assert.equal(
    isVisible({ ...row, date: "2026-09-10" }, "news_posts", now),
    false,
  );
  assert.equal(
    isVisible(
      { ...row, date: "2026-09-08", expires_on: "2026-09-08" },
      "announcements",
      now,
    ),
    false,
  );
  assert.equal(
    isVisible({ ...row, expires_on: "2026-09-09" }, "announcements", now),
    true,
  );
});
test("finished events do not reappear as upcoming", () => {
  assert.equal(
    isUpcoming(
      { date: "2026-09-09", start_time: "12:00", end_time: "13:00" },
      new Date("2026-09-09T17:00:00Z"),
    ),
    false,
  );
  assert.equal(
    isUpcoming(
      { date: "2026-09-09", start_time: "12:00", end_time: "13:00" },
      new Date("2026-09-09T16:30:00Z"),
    ),
    true,
  );
});
test("dates, links, time ranges, and image descriptions are validated", () => {
  for (const change of [
    { date: "2026-02-30" },
    { url: "javascript:alert(1)" },
    { start_time: "24:00" },
    { end_time: "13:00" },
    { start_time: "14:00", end_time: "14:00" },
    { image_path: "9ccbe714-55b4-438a-af30-a1d6ad511910.webp" },
  ])
    assert.equal(recordSchema.safeParse({ ...row, ...change }).success, false);
});
test("no prayer starts without the musallah pin", () => {
  const now = new Date("2026-09-09T16:00:00Z");
  assert.deepEqual(calculatePrayers(null, now), []);
  assert.equal(
    prayerSettingsSchema.safeParse({ ...emptyPrayer, fajr: "05:30" }).success,
    false,
  );
});
test("prayer starts always use Muslim World League with Standard Asr (ADR 0017)", () => {
  // Saturday 3 October 2026 for 12.05, −61.75 (sample coordinates).
  const now = new Date("2026-10-03T16:00:00Z");
  const place = { latitude: 12.05, longitude: -61.75 };
  const today = calculatePrayers(place, now).filter((row) => !row.day);
  assert.deepEqual(
    today.map((row) => [row.id, row.iso.slice(11, 16)]),
    [
      ["fajr", "08:46"],
      ["sunrise", "09:56"],
      ["dhuhr", "15:57"],
      ["asr", "19:15"],
      ["maghrib", "21:56"],
      ["isha", "23:02"],
    ],
  );
  // The same as Fajr 18°, Isha 17° and the Shafi'i Asr shadow, built by hand.
  const params = CalculationMethod.Other();
  params.fajrAngle = 18;
  params.ishaAngle = 17;
  params.madhab = Madhab.Shafi;
  const expected = new PrayerTimes(
    new Coordinates(12.05, -61.75),
    new Date(2026, 9, 3),
    params,
  );
  for (const id of ["fajr", "asr", "isha"] as const)
    assert.equal(
      today.find((row) => row.id === id)?.iso,
      expected[id].toISOString(),
      id,
    );
  assert.equal(prayerCalculation.label, "Muslim World League · Standard Asr");
});
test("retired calculation fields and start corrections are ignored", () => {
  const now = new Date("2026-10-03T16:00:00Z");
  const place = { latitude: 12.05, longitude: -61.75 };
  const stored = prayerSettingsSchema.parse({
    ...emptyPrayer,
    ...place,
    confirmed: false,
    method: "Egyptian",
    madhab: "Hanafi",
    adjustments: {
      fajr: 10,
      sunrise: 0,
      dhuhr: 5,
      asr: 0,
      maghrib: 3,
      isha: 0,
    },
    exceptions: [
      {
        date: "2026-10-03",
        reason: "Old shape",
        adjustments: {
          fajr: 7,
          sunrise: 0,
          dhuhr: 0,
          asr: 0,
          maghrib: 0,
          isha: 0,
        },
        iqamah: {},
      },
    ],
  });
  // Coordinates on the prayer row are retired too: the pin is its own row (PR7).
  for (const key of [
    "confirmed",
    "method",
    "madhab",
    "adjustments",
    "latitude",
    "longitude",
  ])
    assert.equal(key in stored, false, key);
  assert.equal("adjustments" in stored.exceptions[0], false);
  assert.deepEqual(stored.exceptions[0].jumuah, { change: "none" });
  assert.equal(calculatePrayers(place, now).length, 12);
});
test("the Hijri adjustment is required and only -1, 0 or +1", () => {
  const missing: Record<string, unknown> = { ...emptyPrayer };
  delete missing.hijri_adjustment;
  assert.equal(prayerSettingsSchema.safeParse(missing).success, false);
  for (const value of [-1, 0, 1])
    assert.equal(
      prayerSettingsSchema.safeParse({
        ...emptyPrayer,
        hijri_adjustment: value,
      }).success,
      true,
    );
  for (const value of [2, -2, "1", null])
    assert.equal(
      prayerSettingsSchema.safeParse({
        ...emptyPrayer,
        hijri_adjustment: value,
      }).success,
      false,
    );
});
test("a save refuses a prayer with both a fixed iqamah time and minutes after the adhan (D-14)", () => {
  const dated = {
    ...emptyPrayer,
    valid_from: "2026-10-01",
    valid_until: "2026-10-31",
  };
  const both = prayerSaveSchema.safeParse({
    ...dated,
    fajr: "05:30",
    iqamah_offsets: { ...emptyPrayer.iqamah_offsets, fajr: 20 },
  });
  assert.equal(both.success, false);
  assert.match(
    both.error!.issues[0].message,
    /^Fajr iqamah: pick Fixed time or After adhan, not both\.$/,
  );
  assert.equal(
    prayerSaveSchema.safeParse({
      ...dated,
      fajr: "05:30",
      iqamah_offsets: { ...emptyPrayer.iqamah_offsets, maghrib: 5 },
    }).success,
    true,
  );
});
test("a stored prayer with both is read as stored; visitors see the minutes; a restore refuses it (D-14 amendment)", () => {
  const now = new Date("2026-10-08T12:00:00-04:00");
  const starts = calculatePrayers({ latitude: 12.05, longitude: -61.75 }, now);
  const stored = {
    ...emptyPrayer,
    valid_from: "2026-10-01",
    valid_until: "2026-10-31",
    fajr: "05:30",
    dhuhr: "12:30",
    iqamah_offsets: { ...emptyPrayer.iqamah_offsets, fajr: 20 },
  };
  const read = prayerSettingsSchema.parse(stored);
  assert.equal(read.fajr, "05:30");
  assert.equal(read.iqamah_offsets.fajr, 20);
  // The public Fajr iqamah is the minutes after the start, as before PR4.
  const fajr = congregationTimes(read, starts, now).find(
    (row) => row.id === "fajr",
  );
  const minutesOnly = congregationTimes(
    { ...read, fajr: "" },
    starts,
    now,
  ).find((row) => row.id === "fajr");
  assert.ok(fajr);
  assert.deepEqual(fajr, minutesOnly);
  // Saving it unchanged, or restoring an old History version like it, is refused by name.
  const message = "Fajr iqamah: pick Fixed time or After adhan, not both.";
  assert.deepEqual(
    prayerSaveSchema.safeParse(read).error?.issues.map((i) => i.message),
    [message],
  );
  const restored = restoredPrayerSettings(stored);
  assert.equal(restored.success, false);
  assert.equal(restored.error!.issues[0].message, message);
});
test("a Jumu'ah change needs a Friday and, when changed, that Friday's prayers (no room)", () => {
  const exception = (date: string, jumuah: unknown) =>
    prayerSettingsSchema.safeParse({
      ...emptyPrayer,
      exceptions: [{ date, reason: "Exams", iqamah: {}, jumuah }],
    });
  // Friday 9 and Thursday 8 October 2026.
  assert.equal(exception("2026-10-09", { change: "cancelled" }).success, true);
  assert.equal(exception("2026-10-08", { change: "cancelled" }).success, false);
  assert.equal(exception("2026-10-08", { change: "none" }).success, true);
  const moved = { khutbah: "13:15", iqamah: "13:30" };
  const second = { khutbah: "14:15", iqamah: "14:30" };
  const changed = { change: "changed", sessions: [moved, second] };
  assert.equal(exception("2026-10-09", changed).success, true);
  // A change saved with one khutbah and iqamah (before several prayers, and
  // with a room before the musallah became one room) reads as a list of one.
  const old = exception("2026-10-09", {
    change: "changed",
    ...moved,
    location: "Hall 1",
  });
  assert.equal(old.success, true);
  assert.deepEqual(old.data!.exceptions[0].jumuah, {
    change: "changed",
    sessions: [moved],
  });
  for (const missing of ["khutbah", "iqamah"] as const)
    assert.equal(
      exception("2026-10-09", {
        change: "changed",
        sessions: [{ ...moved, [missing]: "" }],
      }).success,
      false,
      missing,
    );
  // At least one prayer, at most four, each iqamah after its khutbah.
  const refusal = (jumuah: unknown) =>
    exception("2026-10-09", jumuah).error?.issues.map((issue) => issue.message);
  assert.deepEqual(refusal({ change: "changed", sessions: [] }), [
    "Changed Jumu’ah: keep at least one prayer, or choose No Jumu’ah this week.",
  ]);
  assert.equal(
    exception("2026-10-09", {
      change: "changed",
      sessions: [moved, second, moved, second, moved],
    }).success,
    false,
  );
  assert.deepEqual(
    refusal({
      change: "changed",
      sessions: [moved, { khutbah: "14:15", iqamah: "14:15" }],
    }),
    [
      "Changed Jumu’ah iqamah (second prayer): choose a time after the khutbah.",
    ],
  );
  assert.equal(exception("2026-10-09", { change: "moved" }).success, false);
});
test("the weekly Jumu'ah is an ordered list of prayers; an older single one reads as a list of one (review fixes P2)", () => {
  const dated = {
    ...emptyPrayer,
    valid_from: "2026-10-01",
    valid_until: "2026-10-31",
  };
  const first = { khutbah: "12:45", iqamah: "13:00" };
  const second = { khutbah: "13:45", iqamah: "14:00" };
  assert.deepEqual(
    prayerSettingsSchema.parse({ ...dated, jumuah_sessions: [second, first] })
      .jumuah_sessions,
    [second, first],
    "kept in the board's order",
  );
  const { jumuah_sessions: _unused, ...legacy } = dated;
  void _unused;
  const old = prayerSettingsSchema.parse({
    ...legacy,
    khutbah: "12:45",
    jummah_iqamah: "13:00",
  });
  assert.deepEqual(old.jumuah_sessions, [first]);
  assert.equal("khutbah" in old, false);
  assert.deepEqual(
    prayerSettingsSchema.parse({ ...legacy, khutbah: "", jummah_iqamah: "" })
      .jumuah_sessions,
    [],
  );
  // Prayers need the schedule's dates, like the fixed iqamah times.
  assert.equal(
    prayerSettingsSchema.safeParse({ ...emptyPrayer, jumuah_sessions: [first] })
      .success,
    false,
  );
  const refused = prayerSettingsSchema.safeParse({
    ...dated,
    jumuah_sessions: [first, { khutbah: "13:45", iqamah: "" }],
  });
  assert.deepEqual(
    refused.error?.issues.map((issue) => [issue.path, issue.message]),
    [
      [
        ["jumuah_sessions", 1, "iqamah"],
        "Jumu’ah iqamah (second prayer): choose a valid time.",
      ],
    ],
  );
  assert.equal(
    prayerSettingsSchema.safeParse({
      ...dated,
      jumuah_sessions: [first, second, first, second, first],
    }).success,
    false,
  );
});
test("jumuahFor: the weekly Jumu'ah prayers, or this Friday's change from the Saturday before", () => {
  const usual = [
    { khutbah: "12:45", iqamah: "13:00" },
    { khutbah: "13:45", iqamah: "14:00" },
  ];
  const weekly = {
    ...emptyPrayer,
    valid_from: "2026-09-01",
    valid_until: "2026-12-31",
    jumuah_sessions: usual,
  };
  // Grenada noon on Saturday 3, Thursday 8, Friday 9 and Saturday 10 October 2026.
  const day = (date: string) => new Date(`${date}T12:00:00-04:00`);
  assert.deepEqual(jumuahFor(weekly, day("2026-10-08")), {
    state: "regular",
    date: "2026-10-09",
    gatherings: usual,
  });
  const cancelled = prayerSettingsSchema.parse({
    ...weekly,
    exceptions: [
      {
        date: "2026-10-09",
        reason: "Mid-term break",
        iqamah: {},
        jumuah: { change: "cancelled" },
      },
    ],
  });
  for (const date of ["2026-10-03", "2026-10-08", "2026-10-09"])
    assert.deepEqual(jumuahFor(cancelled, day(date)), {
      state: "cancelled",
      date: "2026-10-09",
      reason: "Mid-term break",
    });
  // Friday 9 October 11:30 PM Grenada time is still that Friday.
  assert.equal(
    jumuahFor(cancelled, new Date("2026-10-10T03:30:00Z")).state,
    "cancelled",
  );
  // The Saturday after, the next Friday is regular again.
  assert.deepEqual(jumuahFor(cancelled, day("2026-10-10")), {
    state: "regular",
    date: "2026-10-16",
    gatherings: usual,
  });
  // The Friday before (2 October) is not affected.
  assert.equal(jumuahFor(cancelled, day("2026-10-02")).state, "regular");
  // The second prayer moved and the first cancelled on that Friday only.
  const changed = prayerSettingsSchema.parse({
    ...weekly,
    exceptions: [
      {
        date: "2026-10-09",
        reason: "Exams",
        iqamah: {},
        jumuah: {
          change: "changed",
          sessions: [{ khutbah: "14:15", iqamah: "14:30" }],
        },
      },
    ],
  });
  assert.deepEqual(jumuahFor(changed, day("2026-10-08")), {
    state: "changed",
    date: "2026-10-09",
    gatherings: [{ khutbah: "14:15", iqamah: "14:30" }],
    reason: "Exams",
    usual,
  });
  // Without a current schedule: a change still shows; otherwise nothing.
  const expired = { ...changed, valid_until: "2026-10-01" };
  const shown = jumuahFor(expired, day("2026-10-08"));
  assert.equal(shown.state, "changed");
  assert.deepEqual(shown.state === "changed" && shown.usual, []);
  assert.deepEqual(
    jumuahFor({ ...weekly, valid_until: "2026-10-01" }, day("2026-10-08")),
    {
      state: "none",
      date: "2026-10-09",
    },
  );
});
test("jumuahDisplay and changedTodayNote: what visitors see for a change", () => {
  const first = { khutbah: "12:45", iqamah: "13:00" };
  const second = { khutbah: "13:45", iqamah: "14:00" };
  const moved = { khutbah: "13:15", iqamah: "13:30" };
  assert.deepEqual(
    jumuahDisplay({
      state: "regular",
      date: "2026-10-09",
      gatherings: [first, second],
    }),
    {
      gatherings: [
        { id: "prayer-1", ...first },
        { id: "prayer-2", ...second },
      ],
      change: null,
    },
  );
  // A changed Friday lists that Friday's prayers; the note keeps the reason and usual times.
  assert.deepEqual(
    jumuahDisplay({
      state: "changed",
      date: "2026-10-09",
      gatherings: [moved],
      reason: "Exams",
      usual: [first, second],
    }),
    {
      gatherings: [{ id: "prayer-1", ...moved }],
      change: {
        state: "changed",
        date: "2026-10-09",
        reason: "Exams",
        usual: [first, second],
      },
    },
  );
  assert.deepEqual(
    jumuahDisplay({
      state: "cancelled",
      date: "2026-10-09",
      reason: "Mid-term break",
    }),
    {
      gatherings: [],
      change: {
        state: "cancelled",
        date: "2026-10-09",
        reason: "Mid-term break",
      },
    },
  );
  assert.deepEqual(jumuahDisplay({ state: "none", date: "2026-10-09" }), {
    gatherings: [],
    change: null,
  });

  const settings = prayerSettingsSchema.parse({
    ...emptyPrayer,
    exceptions: [
      {
        date: "2026-10-07",
        reason: "Guest speaker.",
        iqamah: { isha: "20:30" },
      },
      {
        date: "2026-10-09",
        reason: "Exams",
        iqamah: {},
        jumuah: { change: "cancelled" },
      },
    ],
  });
  assert.equal(
    changedTodayNote(settings, "2026-10-07"),
    "Changed today: Guest speaker. ",
  );
  // A Friday change with no iqamah time shows on the Jumu'ah card only.
  assert.equal(changedTodayNote(settings, "2026-10-09"), "");
  assert.equal(changedTodayNote(settings, "2026-10-08"), "");
});
test("hijriDate: the board's -1 / 0 / +1 day applies all day", () => {
  // Saturday 3 October 2026 is 22 Rabiʻ II 1448, morning and evening alike.
  const days = (now: Date) =>
    ([-1, 0, 1] as const).map((step) => hijriDate(now, step).day);
  assert.deepEqual(days(new Date("2026-10-03T14:00:00Z")), [21, 22, 23]);
  assert.deepEqual(days(new Date("2026-10-03T23:30:00Z")), [21, 22, 23]);
  assert.equal(
    hijriDate(new Date("2026-10-03T14:00:00Z"), -1).english,
    "21 Rabiʻ II 1448 AH",
  );
});
test("restoring a version saved before PR4: the Hijri date as calculated, one weekly Jumu'ah prayer", () => {
  // An activity log `before` from the old screen: retired fields, no Hijri adjustment.
  const before = {
    id: 1,
    confirmed: true,
    latitude: 12.05,
    longitude: -61.75,
    method: "MuslimWorldLeague",
    madhab: "Shafi",
    adjustments: { fajr: 2, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
    iqamah_offsets: {
      fajr: null,
      dhuhr: null,
      asr: null,
      maghrib: null,
      isha: null,
    },
    exceptions: [
      {
        date: "2026-10-09",
        reason: "Old",
        adjustments: {
          fajr: 0,
          sunrise: 0,
          dhuhr: 3,
          asr: 0,
          maghrib: 0,
          isha: 0,
        },
        iqamah: { fajr: "", dhuhr: "13:30", asr: "", maghrib: "", isha: "" },
      },
    ],
    valid_from: "2026-09-01",
    valid_until: "2026-12-31",
    fajr: "05:30",
    dhuhr: "",
    asr: "",
    maghrib: "",
    isha: "",
    khutbah: "12:45",
    jummah_iqamah: "13:00",
    jummah_location: "Charter Hall",
    notice: "",
    updated_at: "2026-10-01T00:00:00Z",
  };
  const restored = restoredPrayerSettings(before);
  assert.equal(restored.success, true);
  // The Hijri date stays as calculated (review fixes P2).
  assert.equal(restored.data!.hijri_adjustment, 0);
  // The single weekly Jumu'ah of an older version is a list of one.
  assert.deepEqual(restored.data!.jumuah_sessions, [
    { khutbah: "12:45", iqamah: "13:00" },
  ]);
  assert.equal("adjustments" in restored.data!, false);
  assert.equal("method" in restored.data!, false);
  // A pre-PR7 version's coordinates are never written back (the pin is its own row).
  assert.equal("latitude" in restored.data!, false);
  assert.equal("longitude" in restored.data!, false);
  assert.deepEqual(restored.data!.exceptions[0].jumuah, { change: "none" });
  // A version with another Hijri day is restored as calculated too.
  assert.equal(
    restoredPrayerSettings({ ...before, hijri_adjustment: -1 }).data!
      .hijri_adjustment,
    0,
  );
});
test("calculated prayers are chronological absolute instants across midnight", () => {
  // Synthetic test coordinates, not the approved Musallah location.
  const times = calculatePrayers(
    { latitude: 12, longitude: -61 },
    new Date("2026-09-10T02:00:00Z"),
  );
  assert.equal(times.length, 12);
  assert.equal(times[0].iso.slice(0, 10), "2026-09-09");
  assert.ok(
    times.every((time, index) => !index || time.iso > times[index - 1].iso),
  );
});
test("ICS exports UTC campus times and folds UTF-8 safely", () => {
  const ics = eventToIcs({
    id: row.id,
    title: "لقاء ".repeat(50),
    date: "2026-09-09",
    start_time: "12:00",
    end_time: "13:00",
    category: "msa",
    organization: "MSA",
    visibility: "public",
    featured: false,
    verification_status: "verified",
  });
  assert.match(ics, /DTSTART:20260909T160000Z/);
  assert.match(ics, /DTEND:20260909T170000Z/);
  for (const line of ics.split("\r\n"))
    assert.ok(Buffer.byteLength(line) <= 75);
});
test("a fixed schedule is current only from its first through its last date", () => {
  const range = { valid_from: "2026-09-10", valid_until: "2026-09-12" };
  assert.equal(isScheduleCurrent(range, "2026-09-09"), false);
  assert.equal(isScheduleCurrent(range, "2026-09-10"), true);
  assert.equal(isScheduleCurrent(range, "2026-09-12"), true);
  assert.equal(isScheduleCurrent(range, "2026-09-13"), false);
  assert.equal(
    isScheduleCurrent({ valid_from: "", valid_until: "" }, "2026-09-10"),
    false,
  );
});
test("the dashboard reminds the board from 7 days before the iqamah times end, and after they ended (D-12)", () => {
  const ends = { valid_until: "2026-12-15" };
  const soon = { state: "ending_soon", end: "2026-12-15" };
  // Before the reminder window.
  assert.deepEqual(scheduleEndStatus(ends, "2026-12-07"), { state: "none" });
  // From 7 days before through the end date itself.
  assert.deepEqual(scheduleEndStatus(ends, "2026-12-08"), soon);
  assert.deepEqual(scheduleEndStatus(ends, "2026-12-15"), soon);
  // After the end date the reminder stays, as "ended", until someone updates
  // the times (D-12 amendment, 2026-10-04).
  const ended = { state: "ended", end: "2026-12-15" };
  assert.deepEqual(scheduleEndStatus(ends, "2026-12-16"), ended);
  assert.deepEqual(scheduleEndStatus(ends, "2027-03-01"), ended);
  // Across a month and a year end.
  assert.deepEqual(
    scheduleEndStatus({ valid_until: "2027-01-03" }, "2026-12-28"),
    { state: "ending_soon", end: "2027-01-03" },
  );
  // No end date: nothing to remind about.
  assert.deepEqual(scheduleEndStatus({ valid_until: "" }, "2026-12-15"), {
    state: "none",
  });
});
test("sample data stays visible across Grenada midnight on the seed clock", async () => {
  // 23:59 and 00:01 Grenada time (UTC−04:00) on either side of 10 September.
  for (const seed of ["2026-09-10T03:59:00Z", "2026-09-10T04:01:00Z"]) {
    const clock = fixedClock(new Date(seed));
    const provider = createMockContentProvider(clock.now());
    for (const kind of collections) {
      const { records } = await provider.getRecords(kind);
      assert.ok(records.length);
      assert.ok(
        records.every((row) => isVisible(row, kind, clock.now())),
        `${kind} at ${seed}`,
      );
    }
    const { settings } = await provider.getPrayerSettings();
    assert.equal(isScheduleCurrent(settings, localDate(clock.now())), true);
    assert.ok(congregationTimes(settings, [], clock.now()).length);
  }
  // The wall clock would have dropped the sample schedule one minute later.
  const lateNight = new Date("2026-09-10T03:59:00Z");
  const { settings } =
    await createMockContentProvider(lateNight).getPrayerSettings();
  assert.equal(
    isScheduleCurrent(settings, localDate(new Date("2026-09-10T04:00:00Z"))),
    false,
  );
});

test("iqamahOn: the one rule the public times and the dashboard preview share", () => {
  const today = "2026-10-07";
  // 08:46 UTC is 4:46 AM in Grenada.
  const adhan = "2026-10-07T08:46:00.000Z";
  const rule = {
    valid_from: "2026-10-01",
    valid_until: "2026-12-31",
    fixed: "05:30",
    minutes: null,
    changed: "",
  };
  assert.equal(iqamahOn(rule, adhan, today), "05:30");
  // Times that start later give no iqamah today, fixed or after the adhan.
  const later = { ...rule, valid_from: "2026-10-20" };
  assert.equal(iqamahOn(later, adhan, today), "");
  assert.equal(iqamahOn({ ...later, minutes: 20 }, adhan, today), "");
  // Minutes win over a fixed time, and need only the dates that are set.
  assert.equal(iqamahOn({ ...rule, minutes: 20 }, adhan, today), "05:06");
  assert.equal(
    iqamahOn(
      { ...rule, fixed: "", minutes: 20, valid_from: "", valid_until: "" },
      adhan,
      today,
    ),
    "05:06",
  );
  assert.equal(iqamahOn({ ...rule, minutes: 20 }, undefined, today), "");
  // A fixed time needs both dates.
  assert.equal(iqamahOn({ ...rule, valid_until: "" }, adhan, today), "");
  // Today's one-date change wins over everything, even outside the dates.
  assert.equal(iqamahOn({ ...later, changed: "05:45" }, adhan, today), "05:45");
});
