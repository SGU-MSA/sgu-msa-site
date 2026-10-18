import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { nearCampus, SGU_CAMPUS } from "../src/lib/maps/place";

// Review fixes P4 (the approved plan of 2026-10-07): 202610160003_team_list_and_campus_pin.sql on top of
// the baseline, on an isolated PostgreSQL engine with the Supabase stand-ins of `npm run test:db`.
const root = new URL("../", import.meta.url);
const migrationsDir = new URL("supabase/migrations/", root);
const migrationName = "202610160003_team_list_and_campus_pin.sql";

/** Every migration in order. */
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

/** A "manage people" holder: the President of the Executive board. */
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

async function groups(db: PGlite) {
  const rows = await run(db, "owner", "select id, kind from people_sections");
  const of = (kind: string | null) =>
    String(rows.find((row) => row.kind === kind)!.id);
  return { executive: of("executive"), general: of("general"), own: of(null) };
}

const insert =
  "insert into people (full_name, role_title, section_id, position, show_on_public, photo_path) values ($1, $2, $3, 1, $4, $5) returning id, updated_at::text as version";

test("the migration runs again without error (safe to re-run)", async () => {
  const db = await database();
  try {
    await db.exec(
      await readFile(new URL(migrationName, migrationsDir), "utf8"),
    );
  } finally {
    await db.close();
  }
});

test("the team list: the Executive board always, the others when ticked, photos only for the Executive board", async () => {
  const db = await database();
  try {
    const board = await admin(db);
    const { executive, general, own } = await groups(db);
    const photo = `${randomUUID()}.webp`;
    await run(db, board, insert, [
      "Testname Treasurer",
      "Treasurer",
      executive,
      false,
      photo,
    ]);
    await run(db, board, insert, [
      "Testname Listed",
      "Events lead",
      general,
      true,
      "",
    ]);
    await run(db, board, insert, ["Testname Hidden", "", general, false, ""]);
    await run(db, board, insert, ["Testname Advisor", "", own, true, ""]);
    const team = await run(
      db,
      "anon",
      "select section_kind, full_name, photo_path from public.public_team_list()",
    );
    assert.deepEqual(
      team.map((row) => [row.section_kind, row.full_name, row.photo_path]),
      [
        // owner_add_admin leaves "Show" unticked: the President shows anyway.
        ["executive", "Testname Board", null],
        ["executive", "Testname Treasurer", photo],
        ["general", "Testname Listed", null],
        [null, "Testname Advisor", null],
      ],
    );
    // public_team() keeps its columns for the photo storage rule.
    assert.deepEqual(
      (await run(db, "anon", "select full_name from public.public_team()")).map(
        (row) => row.full_name,
      ),
      team.map((row) => row.full_name),
    );
  } finally {
    await db.close();
  }
});

test("photos are for the Executive board: refused elsewhere (SGU40), kept hidden on the way out", async () => {
  const db = await database();
  try {
    const board = await admin(db);
    const { executive, general } = await groups(db);
    const photo = `${randomUUID()}.webp`;
    await assert.rejects(
      run(db, board, insert, ["Testname General", "", general, true, photo]),
      (error: { code?: string }) => error.code === "SGU40",
    );
    const [{ id: general_person }] = await run(db, board, insert, [
      "Testname General",
      "",
      general,
      true,
      "",
    ]);
    await assert.rejects(
      run(db, board, "update people set photo_path = $1 where id = $2", [
        photo,
        general_person,
      ]),
      (error: { code?: string }) => error.code === "SGU40",
    );
    // Moved out of the Executive board: the photo is kept but no longer
    // shown, and is back when they return (user, 2026-10-07).
    const [{ id: secretary }] = await run(db, board, insert, [
      "Testname Secretary",
      "Secretary",
      executive,
      true,
      photo,
    ]);
    const move = (section: string, role: string) =>
      run(
        db,
        board,
        "update people set section_id = $1, role_title = $2 where id = $3",
        [section, role, secretary],
      );
    const stored = async () =>
      (
        await run(db, "owner", "select photo_path from people where id = $1", [
          secretary,
        ])
      )[0].photo_path;
    const shown = async () =>
      (
        await run(
          db,
          "anon",
          "select photo_path from public.public_team_list() where person_id = $1",
          [secretary],
        )
      )[0]?.photo_path;
    await move(general, "");
    assert.equal(await stored(), photo);
    assert.equal(await shown(), null);
    await move(executive, "Secretary");
    assert.equal(await shown(), photo);
    // "Make <name> Treasurer instead?": the holder moved out keeps it hidden too.
    const [holder] = await run(db, board, insert, [
      "Testname Holder",
      "Treasurer",
      executive,
      true,
      photo,
    ]);
    const incoming = {
      id: randomUUID(),
      full_name: "Testname Incoming",
      role_title: "Treasurer",
      section_id: executive,
      position: 2,
      show_on_public: true,
      photo_path: "",
    };
    assert.equal(
      (
        await run(
          db,
          board,
          "select public.save_person_taking_role($1, null, $2, $3) as result",
          [JSON.stringify(incoming), holder.id, holder.version],
        )
      )[0].result,
      "ok",
    );
    assert.deepEqual(
      await run(
        db,
        "owner",
        "select p.photo_path, s.kind from people p join people_sections s on s.id = p.section_id where p.id = $1",
        [holder.id],
      ),
      [{ photo_path: photo, kind: "general" }],
    );
    assert.equal(
      (
        await run(
          db,
          "anon",
          "select photo_path from public.public_team_list() where person_id = $1",
          [holder.id],
        )
      )[0]?.photo_path,
      null,
    );
  } finally {
    await db.close();
  }
});

test("a new group's people start shown", async () => {
  const db = await database();
  try {
    const board = await admin(db);
    const [{ shown_by_default }] = await run(
      db,
      board,
      "insert into people_sections (name, position) values ('Volunteers', 9) returning shown_by_default",
    );
    assert.equal(shown_by_default, true);
  } finally {
    await db.close();
  }
});

test("nearCampus is the database's musallah pin rule (one rule, two copies)", async () => {
  const db = await database();
  try {
    const move =
      "update musallah_location set latitude = $1, longitude = $2 where id = 1";
    // A grid around campus, about 250 m apart, out to about 2.5 km.
    for (let north = -10; north <= 10; north++)
      for (let east = -10; east <= 10; east++) {
        const place = {
          latitude: SGU_CAMPUS.latitude + north * 0.00225,
          longitude: SGU_CAMPUS.longitude + east * 0.0023,
        };
        const stored = await run(db, "owner", move, [
          place.latitude,
          place.longitude,
        ]).then(
          () => true,
          () => false,
        );
        assert.equal(stored, nearCampus(place), JSON.stringify(place));
      }
  } finally {
    await db.close();
  }
});
