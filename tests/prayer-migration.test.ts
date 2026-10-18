import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// The prayer settings rules: every migration in order on an isolated PostgreSQL engine with the
// Supabase stand-ins of `npm run test:db`, written as the site owner (no RLS).
const root = new URL("../", import.meta.url);
const migrationsDir = new URL("supabase/migrations/", root);

async function prayerDatabase() {
  const db = new PGlite();
  await db.exec(
    await readFile(new URL("tests/database/supabase-stubs.sql", root), "utf8"),
  );
  for (const name of (await readdir(migrationsDir)).sort())
    if (name.endsWith(".sql"))
      await db.exec(await readFile(new URL(name, migrationsDir), "utf8"));
  return db;
}

/** A changed Friday with these prayers. */
const sessions = (...list: Record<string, unknown>[]) => ({
  change: "changed",
  sessions: list,
});

const saveExceptions = (db: PGlite, list: unknown[]) =>
  db.query("update prayer_settings set exceptions=$1::jsonb where id=1", [
    JSON.stringify(list),
  ]);

test("prayer settings: PostgreSQL constraints reject unsafe values", async () => {
  const db = await prayerDatabase();
  try {
    await db.query(
      "update prayer_settings set adjustments=$1::jsonb where id=1",
      [JSON.stringify({ fajr: 2 })],
    );
    for (const value of [
      { fajr: 61 },
      { fajr: 1.5 },
      { fajr: null },
      { unknown: 3 },
    ])
      await assert.rejects(
        db.query(
          "update prayer_settings set adjustments=$1::jsonb where id=1",
          [JSON.stringify(value)],
        ),
      );
    const valid = {
      date: "2026-09-11",
      reason: "Synthetic migration test",
      adjustments: {},
      iqamah: { fajr: "05:30" },
    };
    await saveExceptions(db, [valid]);
    for (const list of [
      [{ ...valid, date: "2026-02-30" }],
      [valid, valid],
      [{ ...valid, iqamah: { fajr: "25:10" } }],
      [{ ...valid, reason: "" }],
    ])
      await assert.rejects(saveExceptions(db, list));
    const rows = await db.query("select id from prayer_settings");
    assert.equal(rows.rows.length, 1);
  } finally {
    await db.close();
  }
});

test("prayer settings store the Hijri adjustment and Friday Jumu'ah changes (PR4; one musallah room)", async () => {
  const db = await prayerDatabase();
  try {
    const hijri = async () =>
      (
        await db.query<{ hijri_adjustment: number }>(
          "select hijri_adjustment from prayer_settings where id=1",
        )
      ).rows[0].hijri_adjustment;
    assert.equal(await hijri(), 0, "the starter row means 'as calculated'");
    for (const value of [-1, 1, 0]) {
      await db.query("update prayer_settings set hijri_adjustment=$1", [value]);
      assert.equal(await hijri(), value);
    }
    for (const value of [2, -2, null])
      await assert.rejects(
        db.query("update prayer_settings set hijri_adjustment=$1", [value]),
      );

    // Start corrections (retired, ADR 0017) stay accepted when present.
    const old = {
      date: "2026-10-08",
      reason: "Mid-term break",
      adjustments: {
        fajr: 0,
        sunrise: 0,
        dhuhr: 0,
        asr: 0,
        maghrib: 0,
        isha: 0,
      },
      iqamah: { fajr: "05:30", dhuhr: "" },
    };
    const daily = { date: "2026-10-08", reason: "Mid-term break", iqamah: {} };
    const cancelled = {
      date: "2026-10-09",
      reason: "Campus closed",
      iqamah: {},
      jumuah: { change: "cancelled" },
    };
    const changed = {
      date: "2026-10-16",
      reason: "Exam week",
      iqamah: { isha: "20:00" },
      // That Friday's own prayers (review fixes P2, 202610160001).
      jumuah: {
        change: "changed",
        sessions: [{ khutbah: "13:15", iqamah: "13:45" }],
      },
    };
    for (const list of [
      [old],
      [daily],
      [{ ...daily, jumuah: { change: "none" } }],
      [daily, cancelled, changed],
      [{ ...old, date: "2026-10-09", jumuah: { change: "cancelled" } }],
    ])
      await saveExceptions(db, list);

    const refusals: [string, unknown][] = [
      ["bad start corrections", { ...daily, adjustments: { fajr: 61 } }],
      ["start corrections not a map", { ...daily, adjustments: null }],
      ["cancelled on a Thursday", { ...cancelled, date: "2026-10-08" }],
      ["changed on a Thursday", { ...changed, date: "2026-10-08" }],
      ["unknown change", { ...cancelled, jumuah: { change: "moved" } }],
      ["missing change", { ...cancelled, jumuah: {} }],
      ["jumuah not an object", { ...cancelled, jumuah: "cancelled" }],
      ["jumuah null", { ...cancelled, jumuah: null }],
      ["unknown key", { ...changed, jumuah: { ...changed.jumuah, note: "x" } }],
      [
        "extra key on cancelled",
        { ...cancelled, jumuah: { change: "cancelled", khutbah: "13:15" } },
      ],
      [
        "a room (the musallah is one room)",
        { ...changed, jumuah: { ...changed.jumuah, location: "Hall" } },
      ],
      [
        "the single khutbah of before several prayers",
        {
          ...changed,
          jumuah: { change: "changed", khutbah: "13:15", iqamah: "13:45" },
        },
      ],
      [
        "missing iqamah time",
        { ...changed, jumuah: sessions({ khutbah: "13:15" }) },
      ],
      [
        "bad khutbah time",
        { ...changed, jumuah: sessions({ khutbah: "24:00", iqamah: "13:45" }) },
      ],
      [
        "empty iqamah time",
        { ...changed, jumuah: sessions({ khutbah: "13:15", iqamah: "" }) },
      ],
      [
        "time as a number",
        { ...changed, jumuah: sessions({ khutbah: "13:15", iqamah: 1345 }) },
      ],
      [
        "iqamah before the khutbah",
        { ...changed, jumuah: sessions({ khutbah: "13:15", iqamah: "13:00" }) },
      ],
      [
        "no prayer",
        { ...changed, jumuah: { change: "changed", sessions: [] } },
      ],
      [
        "five prayers",
        {
          ...changed,
          jumuah: {
            change: "changed",
            sessions: Array(5).fill({ khutbah: "13:15", iqamah: "13:45" }),
          },
        },
      ],
      ["missing iqamah map", { ...cancelled, iqamah: undefined }],
    ];
    for (const [label, exception] of refusals)
      await assert.rejects(
        saveExceptions(db, [exception]),
        { code: "23514" },
        label,
      );

    const stored = await db.query<{ exceptions: unknown[] }>(
      "select exceptions from prayer_settings where id=1",
    );
    assert.equal(stored.rows[0].exceptions.length, 1, "last valid save kept");
  } finally {
    await db.close();
  }
});
