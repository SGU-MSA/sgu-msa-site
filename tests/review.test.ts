import test from "node:test";
import assert from "node:assert/strict";
import {
  demoAdmin,
  demoMusallahPin,
  demoOrders,
  demoMerch,
  demoPaymentItems,
  demoSeasons,
  demoPeople,
  demoRecords,
  demoPrayer,
  demoSharedLogins,
} from "../src/lib/demo/fixtures";
import { calculatePrayers } from "../src/lib/prayer/calculate";
import {
  congregationTimes,
  prayerFormText,
  prayerFormValues,
} from "../src/lib/prayer/congregation";
import {
  prayerSaveSchema,
  type PrayerSettings,
} from "../src/lib/community/schema";
import { prayerForm } from "../src/features/admin/prayer-form";

/** A refused prayer form's problems, each on its own box (review 2). */
const problems = (form: FormData) => {
  const parsed = prayerForm(form);
  return !parsed.ok && "fields" in parsed ? parsed.fields : {};
};
const now = new Date("2026-09-11T12:00:00-04:00");

// The demo switch and its production guard are tested in tests/runtime.test.ts.
test("sandbox fixtures read like the live site: no sample labels (review fixes PR-1)", () => {
  assert.equal(demoRecords("events", now).length, 9);
  const shown = JSON.stringify([
    ...(["events", "announcements", "news_posts", "newsletters"] as const).map(
      (kind) => demoRecords(kind, now),
    ),
    demoPrayer(now).notice,
    demoAdmin.email,
    demoPeople(),
    demoSharedLogins(now),
    demoPaymentItems(now).map(({ item }) => item),
    demoOrders(now),
    // PR5c: season pages and merch.
    demoSeasons(now),
    demoMerch(),
  ]);
  assert.doesNotMatch(
    shown,
    /\b(demo|sample|example|placeholder|not approved|illustrative)/i,
  );
  // Sample orders look like live ones: no "Test" badge.
  assert.ok(demoOrders(now).every((order) => !order.test_mode));
});
/** The Prayer & iqamah form as posted for `settings` (PR4 WP-4). */
function formOf(settings: PrayerSettings) {
  const form = new FormData();
  for (const [name, value] of Object.entries(prayerFormText(settings)))
    form.set(name, value);
  return form;
}
/** A posted form read back and checked like a save. */
function saved(form: FormData) {
  return prayerSaveSchema.safeParse({ ...prayerFormValues(form), id: 1 });
}
test("the prayer form shows the stored settings and saves them back unchanged", () => {
  const stored = prayerSaveSchema.parse({
    ...demoPrayer(now),
    fajr: "",
    iqamah_offsets: { ...demoPrayer(now).iqamah_offsets, fajr: 20 },
    hijri_adjustment: -1,
    exceptions: [
      {
        date: "2026-09-11",
        reason: "Exams",
        iqamah: { dhuhr: "13:00" },
        jumuah: {
          change: "changed",
          sessions: [
            { khutbah: "13:15", iqamah: "13:30" },
            { khutbah: "14:15", iqamah: "14:30" },
          ],
        },
      },
      {
        date: "2026-09-18",
        reason: "Break",
        iqamah: {},
        jumuah: { change: "cancelled" },
      },
    ],
  });
  const text = prayerFormText(stored);
  assert.equal(text.mode_fajr, "after");
  assert.equal(text.offset_fajr, "20");
  assert.equal(text.mode_dhuhr, "fixed");
  assert.equal(text.exception_0_jumuah, "changed");
  assert.equal(text.exception_0_jumuah_1_khutbah, "14:15");
  // The weekly prayers by place (review fixes P2).
  assert.equal(text.jumuah_0_khutbah, "12:45");
  assert.equal(text.jumuah_1_iqamah, "14:00");
  assert.deepEqual(saved(formOf(stored)).data, {
    ...stored,
    hijri_adjustment: 0,
  });
});
test("the weekly Jumu'ah prayers are read in the posted order; an old single-Jumu'ah page is out of date (review fixes P2)", () => {
  const form = formOf(demoPrayer(now));
  // Dragged: the second prayer first.
  form.set("jumuah_0_khutbah", "13:45");
  form.set("jumuah_0_iqamah", "14:00");
  form.set("jumuah_1_khutbah", "12:45");
  form.set("jumuah_1_iqamah", "13:00");
  form.set("jumuah_2_khutbah", "15:00");
  form.set("jumuah_2_iqamah", "15:15");
  assert.deepEqual(saved(form).data!.jumuah_sessions, [
    { khutbah: "13:45", iqamah: "14:00" },
    { khutbah: "12:45", iqamah: "13:00" },
    { khutbah: "15:00", iqamah: "15:15" },
  ]);
  // All removed: no weekly Jumu'ah.
  const none = formOf({ ...demoPrayer(now), jumuah_sessions: [] });
  assert.deepEqual(saved(none).data!.jumuah_sessions, []);
  // An added prayer left empty is refused by its boxes, not dropped.
  form.set("jumuah_3_khutbah", "");
  form.set("jumuah_3_iqamah", "");
  assert.deepEqual(problems(form), {
    jumuah_3_khutbah: "Jumu’ah khutbah (fourth prayer): choose a valid time.",
    jumuah_3_iqamah: "Jumu’ah iqamah (fourth prayer): choose a valid time.",
  });
  // An iqamah before its khutbah is refused on the iqamah box.
  form.set("jumuah_3_khutbah", "16:00");
  form.set("jumuah_3_iqamah", "15:30");
  assert.deepEqual(problems(form), {
    jumuah_3_iqamah:
      "Jumu’ah iqamah (fourth prayer): choose a time after the khutbah.",
  });
  // A page loaded before several prayers posts one khutbah: saving it would
  // empty the weekly Jumu'ah, so it is out of date.
  const old = formOf(demoPrayer(now));
  old.set("khutbah", "12:45");
  old.set("jummah_iqamah", "13:00");
  assert.equal(prayerFormValues(old), null);
});
test("the iqamah switch keeps only the chosen kind (PR4 D-2)", () => {
  const form = formOf(demoPrayer(now));
  // A stale box of the other kind is ignored, whichever kind is chosen.
  form.set("mode_fajr", "after");
  form.set("offset_fajr", "20");
  form.set("mode_dhuhr", "fixed");
  form.set("offset_dhuhr", "15");
  const settings = saved(form).data!;
  assert.equal(settings.fajr, "");
  assert.equal(settings.iqamah_offsets.fajr, 20);
  assert.equal(settings.dhuhr, "12:30");
  assert.equal(settings.iqamah_offsets.dhuhr, null);
});
test("a prayer stored with both shows both boxes, and saving it is refused until the board picks one (D-14 amendment)", () => {
  const stored = {
    ...demoPrayer(now),
    fajr: "05:30",
    iqamah_offsets: { ...demoPrayer(now).iqamah_offsets, fajr: 20 },
  };
  const text = prayerFormText(stored);
  assert.equal(text.mode_fajr, "both");
  assert.equal(text.fajr, "05:30");
  assert.equal(text.offset_fajr, "20");
  const form = formOf(stored);
  assert.deepEqual(
    saved(form).error?.issues.map((issue) => issue.message),
    ["Fajr iqamah: pick Fixed time or After adhan, not both."],
  );
  // Picking one side saves only that side.
  form.set("mode_fajr", "after");
  assert.equal(saved(form).data?.fajr, "");
  assert.equal(saved(form).data?.iqamah_offsets.fajr, 20);
  form.set("mode_fajr", "fixed");
  assert.equal(saved(form).data?.fajr, "05:30");
  assert.equal(saved(form).data?.iqamah_offsets.fajr, null);
});
test("a form without the iqamah switch is an out-of-date page", () => {
  const form = formOf(demoPrayer(now));
  form.delete("mode_isha");
  assert.equal(prayerFormValues(form), null);
  form.set("mode_isha", "sometimes");
  assert.equal(prayerFormValues(form), null);
});
test("start corrections in an old form are ignored (ADR 0017)", () => {
  const base = demoPrayer(now);
  const form = formOf(base);
  form.set("adjustment_dhuhr", "2");
  form.set("exception_0_date", "2026-09-11");
  form.set("exception_0_reason", "Synthetic test");
  form.set("exception_0_adjustment_dhuhr", "3");
  const data = saved(form).data!;
  assert.equal("adjustments" in data, false);
  assert.equal("adjustments" in data.exceptions[0], false);
});
test("a stray latitude or longitude from an old Prayer page is accepted and ignored (PR7)", () => {
  const form = formOf(demoPrayer(now));
  form.set("latitude", "12.05");
  form.set("longitude", "-61.75");
  const result = saved(form);
  assert.equal(result.success, true);
  assert.equal("latitude" in result.data!, false);
  assert.equal("longitude" in result.data!, false);
  assert.equal(prayerFormText(demoPrayer(now)).latitude, undefined);
});
test("the Hijri date stays as calculated: a save writes 0, whatever an old page posts (review fixes P2)", () => {
  const form = formOf({ ...demoPrayer(now), hijri_adjustment: 1 });
  assert.equal(prayerFormText(demoPrayer(now)).hijri_adjustment, undefined);
  assert.equal(saved(form).data!.hijri_adjustment, 0);
  form.set("hijri_adjustment", "-1");
  assert.equal(saved(form).data!.hijri_adjustment, 0);
});
test("a Friday's Jumu'ah choice is read from the form; no choice means as usual", () => {
  const form = formOf(demoPrayer(now));
  // Friday 18 September 2026.
  form.set("exception_0_date", "2026-09-18");
  form.set("exception_0_reason", "Mid-term break");
  assert.deepEqual(saved(form).data!.exceptions[0].jumuah, { change: "none" });
  form.set("exception_0_jumuah", "cancelled");
  assert.deepEqual(saved(form).data!.exceptions[0].jumuah, {
    change: "cancelled",
  });
  form.set("exception_0_jumuah", "changed");
  // That Friday's own prayers, by place (review fixes P2).
  form.set("exception_0_jumuah_0_khutbah", "13:15");
  form.set("exception_0_jumuah_0_iqamah", "13:30");
  form.set("exception_0_jumuah_1_khutbah", "14:15");
  form.set("exception_0_jumuah_1_iqamah", "14:30");
  // A page loaded before the room was removed still posts it: it is ignored.
  form.set("exception_0_jumuah_location", "Lecture Hall 1");
  form.set("jummah_location", "Lecture Hall 1");
  const posted = saved(form).data!;
  assert.deepEqual(posted.exceptions[0].jumuah, {
    change: "changed",
    sessions: [
      { khutbah: "13:15", iqamah: "13:30" },
      { khutbah: "14:15", iqamah: "14:30" },
    ],
  });
  assert.equal("jummah_location" in posted, false);
});
test("a refused prayer form shows each problem on its own box", () => {
  const form = formOf(demoPrayer(now));
  form.set("valid_until", "");
  form.set("exception_0_date", "2026-09-18");
  form.set("exception_0_reason", "");
  form.set("exception_0_jumuah", "changed");
  form.set("exception_0_jumuah_0_khutbah", "");
  form.set("exception_0_jumuah_0_iqamah", "");
  assert.equal(saved(form).success, false);
  assert.deepEqual(problems(form), {
    valid_until:
      "Times start on and Times end on: fixed times need both dates, and the end cannot be before the start.",
    exception_0_reason:
      "Changes for one date: add a reason (shown to visitors).",
    exception_0_jumuah_0_khutbah:
      "Changed Jumu’ah khutbah: choose a valid time.",
    exception_0_jumuah_0_iqamah: "Changed Jumu’ah iqamah: choose a valid time.",
  });
  // A changed Friday with every prayer removed names its choice.
  form.delete("exception_0_jumuah_0_khutbah");
  form.delete("exception_0_jumuah_0_iqamah");
  assert.equal(
    problems(form).exception_0_jumuah,
    "Changed Jumu’ah: keep at least one prayer, or choose No Jumu’ah this week.",
  );
});
test("a date card with only a daily iqamah time is refused, not dropped", () => {
  const form = formOf(demoPrayer(now));
  form.set("exception_0_date", "");
  form.set("exception_0_reason", "");
  form.set("exception_0_fajr", "06:30");
  assert.equal(saved(form).success, false);
  assert.deepEqual(problems(form), {
    exception_0_date: "Changes for one date: choose a valid date.",
    exception_0_reason:
      "Changes for one date: add a reason (shown to visitors).",
  });
  // A card left completely empty is not a change.
  form.set("exception_0_fajr", "");
  assert.deepEqual(saved(form).data!.exceptions, []);
});
test("bad times and minutes are refused by box name", () => {
  const form = formOf(demoPrayer(now));
  form.set("fajr", "25:00");
  form.set("jumuah_0_khutbah", "noon");
  form.set("mode_asr", "after");
  form.set("offset_asr", "200");
  form.set("exception_0_date", "2026-09-11");
  form.set("exception_0_reason", "Synthetic test");
  form.set("exception_0_isha", "9pm");
  assert.equal(saved(form).success, false);
  assert.deepEqual(problems(form), {
    fajr: "Fajr iqamah: choose a valid time.",
    jumuah_0_khutbah: "Jumu’ah khutbah (first prayer): choose a valid time.",
    offset_asr: "Asr iqamah: use whole minutes after the adhan, from 0 to 120.",
    exception_0_isha: "Isha iqamah on this date: choose a valid time.",
  });
});
test("dated iqamah overrides relative schedule only on its date", () => {
  const form = formOf({ ...demoPrayer(now), valid_until: "2026-10-01" });
  form.set("mode_fajr", "after");
  form.set("offset_fajr", "20");
  form.set("exception_0_date", "2026-09-11");
  form.set("exception_0_reason", "Synthetic test");
  form.set("exception_0_fajr", "06:00");
  const settings = saved(form).data!;
  const startsOn = (day: Date) => calculatePrayers(demoMusallahPin, day);
  assert.equal(
    congregationTimes(settings, startsOn(now), now).find(
      (row) => row.id === "fajr",
    )?.time,
    "06:00",
  );
  const tomorrow = new Date("2026-09-12T12:00:00-04:00");
  const start = startsOn(tomorrow).find((row) => row.id === "fajr")!;
  const expected = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Grenada",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(Date.parse(start.iso) + 20 * 60000));
  assert.equal(
    congregationTimes(settings, startsOn(tomorrow), tomorrow).find(
      (row) => row.id === "fajr",
    )?.time,
    expected,
  );
});
test("invalid and duplicate exceptions are rejected; expired fixed schedules stay hidden", () => {
  const settings = demoPrayer(now);
  const form = formOf(settings);
  form.set("exception_0_date", "2026-02-30");
  form.set("exception_0_reason", "test");
  assert.equal(saved(form).success, false);
  form.set("exception_0_date", "2026-09-11");
  form.set("exception_1_date", "2026-09-11");
  form.set("exception_1_reason", "duplicate");
  assert.deepEqual(
    saved(form).error!.issues.map((issue) => issue.message),
    ["Changes for one date: use each date only once."],
  );
  const later = new Date("2026-09-12T12:00:00-04:00");
  assert.deepEqual(
    congregationTimes(
      settings,
      calculatePrayers(demoMusallahPin, later),
      later,
    ),
    [],
  );
  assert.deepEqual(
    calculatePrayers({ latitude: 90, longitude: -61.75 }, now),
    [],
  );
});
