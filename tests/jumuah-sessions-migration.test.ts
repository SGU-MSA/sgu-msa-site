import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { PGlite, type Transaction } from "@electric-sql/pglite";

// Several Jumu'ah prayers (review fixes P2): 202610160001_jumuah_sessions.sql on top of the four baseline
// files, on an isolated PostgreSQL engine with the Supabase stand-ins of `npm run test:db`.
const root = new URL("../", import.meta.url);
const migrationsDir = new URL("supabase/migrations/", root);
const file = "202610160001_jumuah_sessions.sql";

/** The baseline (and every file before this one), then optionally this file. */
async function database({ withFile = true } = {}) {
  const db = new PGlite();
  await db.exec(
    await readFile(new URL("tests/database/supabase-stubs.sql", root), "utf8"),
  );
  for (const name of (await readdir(migrationsDir)).sort())
    if (name.endsWith(".sql") && (withFile || name < file))
      await db.exec(await readFile(new URL(name, migrationsDir), "utf8"));
  return db;
}
const applyFile = async (db: PGlite) =>
  db.exec(await readFile(new URL(file, migrationsDir), "utf8"));

type Actor = "owner" | { user: string };

/** One transaction as `actor`, the way PostgREST runs a request ("owner" = the SQL editor). */
function rowsOf(db: PGlite) {
  return (actor: Actor, sql: string, params: unknown[] = []) =>
    db.transaction(async (tx: Transaction) => {
      if (actor !== "owner")
        await tx.query(
          "select set_config('role', 'authenticated', true), set_config('request.jwt.claims', $1, true)",
          [JSON.stringify({ role: "authenticated", sub: actor.user })],
        );
      return (await tx.query(sql, params)).rows as Record<string, unknown>[];
    });
}

async function boardMember(db: PGlite) {
  const rows = rowsOf(db);
  const id = randomUUID();
  const email = `board-${id.slice(0, 8)}@example.invalid`;
  await rows("owner", "insert into auth.users (id, email) values ($1, $2)", [
    id,
    email,
  ]);
  await rows("owner", "select public.owner_add_admin($1, $2, true)", [
    email,
    "Testname Board",
  ]);
  return { user: id };
}

const first = { khutbah: "12:45", iqamah: "13:00" };
const second = { khutbah: "13:45", iqamah: "14:00" };

test("jumuah_sessions: the starter row has none; a board member saves two in order; bad lists are refused", async () => {
  const db = await database();
  const rows = rowsOf(db);
  try {
    const read = async () =>
      (
        await rows(
          "owner",
          "select jumuah_sessions, khutbah, jummah_iqamah from prayer_settings where id = 1",
        )
      )[0];
    assert.deepEqual(await read(), {
      jumuah_sessions: [],
      khutbah: "",
      jummah_iqamah: "",
    });
    const board = await boardMember(db);
    const save = (list: unknown, dates = ["2026-10-01", "2026-12-31"]) =>
      rows(
        board,
        "update prayer_settings set valid_from = $2, valid_until = $3, jumuah_sessions = $1::jsonb where id = 1",
        [JSON.stringify(list), ...dates],
      );
    await save([second, first]);
    assert.deepEqual((await read()).jumuah_sessions, [second, first]);
    await save([]);

    const refusals: [string, unknown, string[]?][] = [
      ["not a list", { khutbah: "12:45", iqamah: "13:00" }],
      ["five prayers", Array(5).fill(first)],
      ["a room", [{ ...first, location: "Hall" }]],
      ["no iqamah", [{ khutbah: "12:45" }]],
      ["a bad clock", [{ khutbah: "12:45", iqamah: "24:00" }]],
      ["a clock as a number", [{ khutbah: "12:45", iqamah: 1300 }]],
      ["iqamah before the khutbah", [{ khutbah: "13:00", iqamah: "12:45" }]],
      ["iqamah at the khutbah", [{ khutbah: "13:00", iqamah: "13:00" }]],
      ["null", null],
      ["prayers without the schedule's dates", [first], ["", ""]],
      [
        "prayers ending before they start",
        [first],
        ["2026-10-31", "2026-10-01"],
      ],
    ];
    for (const [label, list, dates] of refusals)
      await assert.rejects(save(list, dates), { code: "23514" }, label);
    assert.deepEqual((await read()).jumuah_sessions, [], "last valid save");
  } finally {
    await db.close();
  }
});

test("jumuah_sessions: a weekly Jumu'ah set before the file becomes the first prayer, the Hijri date is as calculated; running it twice changes nothing", async () => {
  const db = await database({ withFile: false });
  const rows = rowsOf(db);
  try {
    await rows(
      "owner",
      `update prayer_settings set valid_from = '2026-10-01', valid_until = '2026-12-31',
         khutbah = '12:45', jummah_iqamah = '13:00', hijri_adjustment = 1,
         exceptions = '[{"date":"2026-10-16","reason":"Exams","iqamah":{},"jumuah":{"change":"changed","khutbah":"13:15","iqamah":"13:30"}}]'::jsonb
       where id = 1`,
    );
    await rows(
      "owner",
      "update handover_steps set details = 'Our own words.' where position = 1",
    );
    const changedFriday = {
      date: "2026-10-16",
      reason: "Exams",
      iqamah: {},
      jumuah: {
        change: "changed",
        sessions: [{ khutbah: "13:15", iqamah: "13:30" }],
      },
    };
    for (let run = 0; run < 2; run++) {
      await applyFile(db);
      const [settings] = await rows(
        "owner",
        "select jumuah_sessions, khutbah, jummah_iqamah, exceptions, hijri_adjustment from prayer_settings where id = 1",
      );
      // The old one-Friday shape is rewritten as a list of one prayer, and
      // the Hijri date is back to as calculated.
      assert.deepEqual(settings, {
        jumuah_sessions: [first],
        khutbah: "",
        jummah_iqamah: "",
        exceptions: [changedFriday],
        hijri_adjustment: 0,
      });
    }
    // So a change outside the app (a "site owner" SQL fix) is accepted by the new rule.
    await rows(
      "owner",
      "update prayer_settings set notice = 'Sisters use the side door.' where id = 1",
    );
    // The starter hand-over step no longer names the Hijri date setting; a board's own words are kept.
    const steps = await rows(
      "owner",
      "select details from handover_steps where position in (1, 5) order by position",
    );
    assert.deepEqual(
      steps.map((step) => step.details),
      ["Our own words.", "Upcoming events, iqamah end date, old notices."],
    );
  } finally {
    await db.close();
  }
});

test("jumuah_sessions: an old one-Friday change the new rule refuses is left as it was, and the file still runs", async () => {
  const db = await database({ withFile: false });
  const rows = rowsOf(db);
  try {
    // Accepted before this file (no order rule), refused after it: iqamah before the khutbah.
    const old = [
      {
        date: "2026-10-16",
        reason: "Exams",
        iqamah: {},
        jumuah: { change: "changed", khutbah: "13:30", iqamah: "13:15" },
      },
    ];
    await rows(
      "owner",
      "update prayer_settings set exceptions = $1::jsonb where id = 1",
      [JSON.stringify(old)],
    );
    await applyFile(db);
    const [settings] = await rows(
      "owner",
      "select exceptions from prayer_settings where id = 1",
    );
    assert.deepEqual(settings.exceptions, old);
  } finally {
    await db.close();
  }
});
