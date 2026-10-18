import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { GRENADA_BOUNDS, inGrenada } from "../src/lib/maps/place";

// PR7 WP-1 (docs/contracts/pr7-single-pin-map.md): every migration in order on an isolated PostgreSQL
// engine with the Supabase stand-ins of `npm run test:db`. Real Postgres: scripts/test-backend.ts.
const root = new URL("../", import.meta.url);
const migrationsDir = new URL("supabase/migrations/", root);
const migrationName = "202610150001_schema.sql";

async function database() {
  const db = new PGlite();
  await db.exec(
    await readFile(new URL("tests/database/supabase-stubs.sql", root), "utf8"),
  );
  for (const name of (await readdir(migrationsDir)).sort())
    if (name.endsWith(".sql"))
      await db.exec(await readFile(new URL(name, migrationsDir), "utf8"));
  return db;
}

type Actor = "owner" | "anon" | { user: string };

/** One statement as `actor`, the way PostgREST runs a request ("owner" = the SQL editor). */
function run(db: PGlite, actor: Actor, sql: string, params: unknown[] = []) {
  return db.transaction(async (tx) => {
    if (actor !== "owner") {
      const role = actor === "anon" ? "anon" : "authenticated";
      const claims = actor === "anon" ? { role } : { role, sub: actor.user };
      await tx.query(
        "select set_config('role', $1, true), set_config('request.jwt.claims', $2, true)",
        [role, JSON.stringify(claims)],
      );
    }
    return (await tx.query<Record<string, unknown>>(sql, params)).rows;
  });
}

async function admin(db: PGlite) {
  const id = randomUUID();
  const email = `board-${id.slice(0, 8)}@example.invalid`;
  await run(db, "owner", "insert into auth.users (id, email) values ($1, $2)", [
    id,
    email,
  ]);
  await run(db, "owner", "select public.owner_add_admin($1, $2, true)", [
    email,
    "Testname Board",
  ]);
  return { user: id };
}

const move = "update musallah_location set latitude = $1, longitude = $2";

test("the musallah location starts at the user's Google place and is the only row", async () => {
  const db = await database();
  try {
    assert.deepEqual(
      await run(
        db,
        "anon",
        "select id, latitude, longitude from musallah_location",
      ),
      [{ id: 1, latitude: 12.0025521, longitude: -61.7723834 }],
    );
    await assert.rejects(
      run(
        db,
        "owner",
        "insert into musallah_location (id, latitude, longitude) values (2, 12, -61.75)",
      ),
    );
    assert.equal(
      (
        await run(
          db,
          "owner",
          "select count(*)::int as n from activity_log where area = 'musallah_location'",
        )
      )[0].n,
      0,
      "the seed is not a board change",
    );
  } finally {
    await db.close();
  }
});

test("only pins within about 1.5 km of the SGU campus are stored (D-9; review fixes P4)", async () => {
  const db = await database();
  try {
    for (const [label, place] of [
      ["Petit St. Vincent", [12.536, -61.384]],
      ["Union Island", [12.6, -61.43]],
      ["Trinidad", [10.65, -61.5]],
      ["Petite Martinique", [12.52, -61.385]],
      ["Carriacou", [12.48, -61.45]],
      ["St. George's", [12.0561, -61.7488]],
      ["the sea off campus", [11.985, -61.7724]],
      ["out of range", [91, -61.75]],
      ["empty", [null, -61.75]],
    ] as const)
      await assert.rejects(run(db, "owner", move, [...place]), label);
    for (const [label, place] of [
      ["the starting pin", [12.0025521, -61.7723834]],
      ["1.4 km north", [12.0151, -61.7723834]],
      ["1.4 km east", [12.0025521, -61.7595]],
    ] as const)
      await run(db, "owner", move, [...place]).then(
        () => undefined,
        (error) => assert.fail(`${label}: ${error}`),
      );
  } finally {
    await db.close();
  }
});

test("visitors read, any admin moves the pin with one logged change, nobody deletes", async () => {
  const db = await database();
  try {
    const board = await admin(db);
    await assert.rejects(run(db, "anon", move, [12.01, -61.77]));
    await assert.rejects(run(db, "anon", "delete from musallah_location"));
    await assert.rejects(run(db, board, "delete from musallah_location"));
    const before = Number(
      (
        await run(
          db,
          "owner",
          "select coalesce(max(id), 0) as n from activity_log",
        )
      )[0].n,
    );
    await run(db, board, move, [12.003, -61.7724]);
    const log = await run(
      db,
      "owner",
      "select area, action, highlight, record_id, before, after, actor from activity_log where id > $1",
      [before],
    );
    assert.equal(log.length, 1);
    const [entry] = log as {
      area: string;
      action: string;
      highlight: boolean;
      record_id: string;
      before: Record<string, unknown>;
      after: Record<string, unknown>;
      actor: string;
    }[];
    assert.deepEqual(
      [entry.area, entry.action, entry.highlight, entry.record_id, entry.actor],
      ["musallah_location", "updated", false, "1", board.user],
    );
    assert.deepEqual(
      [entry.before.latitude, entry.before.longitude],
      [12.0025521, -61.7723834],
    );
    assert.deepEqual(
      [entry.after.latitude, entry.after.longitude],
      [12.003, -61.7724],
    );
    assert.equal(
      (
        await run(
          db,
          "owner",
          "select count(*)::int as n from musallah_location",
        )
      )[0].n,
      1,
    );
  } finally {
    await db.close();
  }
});

test("GRENADA_BOUNDS is the same box as the migration's check (one rule, two copies)", async () => {
  const sql = await readFile(new URL(migrationName, migrationsDir), "utf8");
  const box = sql.match(
    /latitude between ([\d.-]+) and ([\d.-]+) and longitude between ([\d.-]+) and ([\d.-]+)/,
  );
  assert.ok(box, "the migration names the Grenada box");
  assert.deepEqual(box.slice(1).map(Number), [
    GRENADA_BOUNDS.south,
    GRENADA_BOUNDS.north,
    GRENADA_BOUNDS.west,
    GRENADA_BOUNDS.east,
  ]);
  assert.ok(inGrenada({ latitude: 12.0025521, longitude: -61.7723834 }));
});
