import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// Review fixes PR-2 (.plans/review-fixes-plan.md; PR3 contract amendment 2026-10-05) and review 2
// (.plans/review2-plan.md PR-B): the team groups and "Save order", on an isolated PostgreSQL engine with the Supabase stand-ins of `npm run test:db`.
// Real Postgres: scripts/test-backend.ts.
const root = new URL("../", import.meta.url);
const migrationsDir = new URL("supabase/migrations/", root);
const schemaName = "202610150001_schema.sql";

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

const sectionsSql =
  "select id, name, position, shown_by_default, updated_at::text as version from people_sections where archived_at is null order by position, name";
type Row = {
  id: string;
  name: string;
  position: number;
  shown_by_default: boolean;
  version: string;
};

const saveOrder = (db: PGlite, actor: Actor, list: string, rows: Row[]) =>
  run(
    db,
    actor,
    "select public.save_order($1, $2::uuid[], $3::timestamptz[]) as result",
    [list, rows.map((row) => row.id), rows.map((row) => row.version)],
  ).then((result) => result[0].result);

test("the three groups, Executive board and General board permanent; new people start shown in each (review fixes P4)", async () => {
  const db = await database();
  try {
    const sections = (await run(db, "owner", sectionsSql)) as Row[];
    assert.deepEqual(
      sections.map(({ name, position, shown_by_default }) => [
        name,
        position,
        shown_by_default,
      ]),
      [
        ["Executive board", 1, true],
        ["General board", 2, true],
        ["Advisors/Faculty", 3, true],
      ],
    );
    assert.deepEqual(
      (
        await run(
          db,
          "owner",
          "select kind from people_sections order by position",
        )
      ).map((row) => row.kind),
      ["executive", "general", null],
    );
    // The site owner's "add an admin" step: with "manage people" the new
    // admin goes in the Executive board (the only group that may hold it,
    // 2026-10-06) as President unless another role is given; without it in
    // the General board. Hidden either way.
    await admin(db);
    const other = randomUUID();
    await run(
      db,
      "owner",
      "insert into auth.users (id, email) values ($1, $2)",
      [other, `other-${other.slice(0, 8)}@example.invalid`],
    );
    await run(
      db,
      "owner",
      "select public.owner_add_admin($1, 'Testname Other', false)",
      [`other-${other.slice(0, 8)}@example.invalid`],
    );
    const treasurer = randomUUID();
    await run(
      db,
      "owner",
      "insert into auth.users (id, email) values ($1, $2)",
      [treasurer, `treasurer-${treasurer.slice(0, 8)}@example.invalid`],
    );
    await run(
      db,
      "owner",
      "select public.owner_add_admin($1, 'Testname Treasurer', true, 'Treasurer')",
      [`treasurer-${treasurer.slice(0, 8)}@example.invalid`],
    );
    assert.deepEqual(
      await run(
        db,
        "owner",
        `select s.name, p.role_title, p.show_on_public, a.can_manage_people
        from people p join people_sections s on s.id = p.section_id join admins a on a.person_id = p.id
        order by p.created_at, p.full_name`,
      ),
      [
        {
          name: "Executive board",
          role_title: "President",
          show_on_public: false,
          can_manage_people: true,
        },
        {
          name: "General board",
          role_title: "",
          show_on_public: false,
          can_manage_people: false,
        },
        {
          name: "Executive board",
          role_title: "Treasurer",
          show_on_public: false,
          can_manage_people: true,
        },
      ],
    );
  } finally {
    await db.close();
  }
});

test("review 2: permanent groups, Executive board roles, deleting an empty group, the team list without consent", async () => {
  const db = await database();
  try {
    const board = await admin(db);
    const [executive, general] = (await run(db, "owner", sectionsSql)) as Row[];
    const refused = (
      actor: Actor,
      sql: string,
      params: unknown[],
      code: string,
    ) =>
      assert.rejects(
        run(db, actor, sql, params),
        (error: { code?: string }) => {
          assert.equal(error.code, code, sql);
          return true;
        },
      );

    // The Executive board and the General board keep their names, stay current
    // and are never deleted, even by the site owner; nobody adds another one.
    for (const group of [executive, general]) {
      await refused(
        board,
        "update people_sections set name = 'Renamed' where id = $1",
        [group.id],
        "SGU13",
      );
      await refused(
        board,
        "update people_sections set archived_at = now() where id = $1",
        [group.id],
        "SGU13",
      );
      await refused(
        "owner",
        "delete from people_sections where id = $1",
        [group.id],
        "SGU13",
      );
      await refused(
        "owner",
        "update people_sections set kind = null where id = $1",
        [group.id],
        "SGU13",
      );
    }
    await run(
      db,
      board,
      "update people_sections set shown_by_default = false where id = $1",
      [executive.id],
    );
    await refused(
      board,
      "insert into people_sections (name, position, kind) values ('Second executive', 9, 'executive')",
      [],
      "42501",
    );

    // In the Executive board, only its five roles.
    const insert =
      "insert into people (full_name, role_title, section_id, position, show_on_public) values ('Testname Exec', $1, $2, 1, true) returning id";
    await refused(board, insert, ["Events lead", executive.id], "SGU12");
    await refused(board, insert, ["", executive.id], "SGU12");
    const [{ id: treasurer }] = await run(db, board, insert, [
      "Treasurer",
      executive.id,
    ]);
    // One current person per role (2026-10-06): the board's admin is President.
    await refused(board, insert, ["President", executive.id], "SGU17");
    await refused(board, insert, ["Treasurer", executive.id], "SGU17");
    await run(db, board, insert.replace("Testname Exec", "Testname Vice"), [
      "Vice President (Sisters)",
      executive.id,
    ]);
    await refused(
      board,
      "update people set role_title = 'Events lead' where id = $1",
      [treasurer],
      "SGU12",
    );
    const general_person = (
      await run(
        db,
        board,
        insert.replace("Testname Exec", "Testname General"),
        ["Events lead", general.id],
      )
    )[0].id;
    await refused(
      board,
      "update people set section_id = $1 where id = $2",
      [executive.id, general_person],
      "SGU12",
    );

    // Listed with no consent record, in role order; a photo whenever uploaded.
    // The Executive board is always listed (review fixes P4): the President
    // (`owner_add_admin`, "Show" unticked) too.
    const photo = `${randomUUID()}.webp`;
    await run(db, board, "update people set photo_path = $1 where id = $2", [
      photo,
      treasurer,
    ]);
    assert.deepEqual(
      (
        await run(
          db,
          "anon",
          "select full_name, photo_path from public.public_team()",
        )
      ).map((row) => [row.full_name, row.photo_path]),
      [
        ["Testname Board", null],
        ["Testname Vice", null],
        ["Testname Exec", photo],
        ["Testname General", null],
      ],
    );

    // A board group: archived when nobody current is in it; deleted by a
    // "manage people" holder only once nobody, archived or not, is in it.
    const [{ id: own }] = await run(
      db,
      board,
      "insert into people_sections (name, position) values ('Volunteers', 9) returning id",
    );
    const [{ id: member }] = await run(
      db,
      board,
      "insert into people (full_name, section_id, position, show_on_public) values ('Testname Volunteer', $1, 1, false) returning id",
      [own],
    );
    await run(
      db,
      board,
      "update people set archived_at = now() where id = $1",
      [member],
    );
    await run(
      db,
      board,
      "update people_sections set archived_at = now() where id = $1",
      [own],
    );
    await refused(
      board,
      "delete from people_sections where id = $1",
      [own],
      "23503",
    );
    await run(db, board, "delete from people where id = $1", [member]);
    assert.equal(
      (
        await run(
          db,
          board,
          "delete from people_sections where id = $1 returning id",
          [own],
        )
      ).length,
      1,
    );
  } finally {
    await db.close();
  }
});

test("save_order: one step for the whole list, refused whole when anything is stale or archived", async () => {
  const db = await database();
  try {
    const board = await admin(db);
    const [executive, general, advisors] = (await run(
      db,
      "owner",
      sectionsSql,
    )) as Row[];
    const logged = async () =>
      Number(
        (
          await run(db, "owner", "select count(*)::int as n from activity_log")
        )[0].n,
      );

    // Visitors cannot call it; unknown lists and repeated rows are refused.
    await assert.rejects(
      saveOrder(db, "anon", "people_sections", [executive]),
      /permission denied/,
    );
    await assert.rejects(
      saveOrder(db, board, "admins", [executive]),
      /Unknown list/,
    );
    await assert.rejects(
      saveOrder(db, board, "people_sections", [executive, executive]),
      /each row once/i,
    );

    // A stale version anywhere changes nothing.
    const before = await logged();
    assert.equal(
      await saveOrder(db, board, "people_sections", [
        advisors,
        { ...general, version: "2001-01-01 00:00:00+00" },
        executive,
      ]),
      "conflict",
    );
    assert.deepEqual(
      ((await run(db, "owner", sectionsSql)) as Row[]).map((row) => row.name),
      ["Executive board", "General board", "Advisors/Faculty"],
    );
    assert.equal(await logged(), before);

    // Advisors first: two rows move and are logged; the one in place keeps its version.
    assert.equal(
      await saveOrder(db, board, "people_sections", [
        advisors,
        executive,
        general,
      ]),
      "ok",
    );
    const after = (await run(db, "owner", sectionsSql)) as Row[];
    assert.deepEqual(
      after.map(({ name, position }) => [name, position]),
      [
        ["Advisors/Faculty", 1],
        ["Executive board", 2],
        ["General board", 3],
      ],
    );
    assert.equal(await logged(), before + 3);
    assert.deepEqual(
      await run(
        db,
        "owner",
        "select actor, area, action, before ->> 'position' as was, after ->> 'position' as now from activity_log order by id desc limit 3",
      ),
      [
        {
          actor: board.user,
          area: "people_sections",
          action: "updated",
          was: "2",
          now: "3",
        },
        {
          actor: board.user,
          area: "people_sections",
          action: "updated",
          was: "1",
          now: "2",
        },
        {
          actor: board.user,
          area: "people_sections",
          action: "updated",
          was: "3",
          now: "1",
        },
      ],
    );

    // An archived row is never reordered (it is read-only until restored).
    const extra = randomUUID();
    await run(
      db,
      "owner",
      "insert into people_sections (id, name, position, archived_at) values ($1, 'Old', 9, now())",
      [extra],
    );
    const old = (
      await run(
        db,
        "owner",
        "select id, updated_at::text as version from people_sections where id = $1",
        [extra],
      )
    )[0] as Row;
    assert.equal(
      await saveOrder(db, board, "people_sections", [old, ...after]),
      "conflict",
    );
  } finally {
    await db.close();
  }
});

test("save_order also orders People in a section, funds and tickets, and hand-over steps", async () => {
  const db = await database();
  try {
    const board = await admin(db);
    for (const [list, label] of [
      ["people", "full_name"],
      ["payment_items", "name"],
      ["handover_steps", "title"],
    ] as const) {
      if (list === "people")
        await run(
          db,
          "owner",
          "insert into people (full_name, section_id, position, show_on_public) select 'Testname Second', id, 2, false from people_sections where kind = 'general'",
        );
      if (list === "payment_items")
        await run(
          db,
          "owner",
          `insert into payment_items (slug, name, kind, category, about, heading, listed, position) values
             ('first', 'First', 'priced', 'general', '', '', false, 1),
             ('second', 'Second', 'priced', 'general', '', '', false, 2)`,
        );
      const rows = (await run(
        db,
        "owner",
        `select id, ${label} as name, position, updated_at::text as version from ${list} where archived_at is null order by position, ${label}`,
      )) as Row[];
      assert.ok(rows.length >= 2, list);
      const reversed = [...rows].reverse();
      assert.equal(await saveOrder(db, board, list, reversed), "ok", list);
      assert.deepEqual(
        (
          await run(
            db,
            "owner",
            `select id from ${list} where archived_at is null order by position`,
          )
        ).map((row) => row.id),
        reversed.map((row) => row.id),
        list,
      );
    }
  } finally {
    await db.close();
  }
});

test("save_order locks the rows (one fixed order) before checking their versions, so a second save at the same moment gets 'conflict'", async () => {
  const sql = await readFile(new URL(schemaName, migrationsDir), "utf8");
  const body = sql.slice(sql.indexOf("create function public.save_order"));
  const lock = body.indexOf("order by id for update");
  assert.ok(lock > 0, "save_order locks its rows");
  assert.ok(
    lock < body.indexOf("updated_at = $2"),
    "the lock comes before the version check",
  );
});

test("hand-in plan (2026-10-06): the two permissions only in the Executive board; its moves need manage people", async () => {
  const db = await database();
  try {
    const refused = (
      actor: Actor,
      sql: string,
      params: unknown[],
      code: string,
    ) =>
      assert.rejects(
        run(db, actor, sql, params),
        (error: { code?: string }) => {
          assert.equal(error.code, code, sql);
          return true;
        },
      );
    /** A login added by the site owner: with "manage people" in the Executive board. */
    const login = async (
      name: string,
      managePeople: boolean,
      role?: string,
    ) => {
      const id = randomUUID();
      const email = `${name}-${id.slice(0, 8)}@example.invalid`;
      await run(
        db,
        "owner",
        "insert into auth.users (id, email) values ($1, $2)",
        [id, email],
      );
      await run(
        db,
        "owner",
        role
          ? "select public.owner_add_admin($1, $2, $3, $4)"
          : "select public.owner_add_admin($1, $2, $3)",
        [email, `Testname ${name}`, managePeople, ...(role ? [role] : [])],
      );
      const [{ person_id: person }] = await run(
        db,
        "owner",
        "select person_id from admins where user_id = $1",
        [id],
      );
      return { user: id, email, person: String(person) };
    };
    const access = async (person: string) =>
      (
        await run(
          db,
          "owner",
          "select can_manage_people, can_manage_money, updated_at::text as version from admins where person_id = $1",
          [person],
        )
      )[0] as {
        can_manage_people: boolean;
        can_manage_money: boolean;
        version: string;
      };
    const setAccess = async (
      actor: Actor,
      person: string,
      people: boolean,
      money: boolean,
    ) =>
      (
        await run(
          db,
          actor,
          "select public.set_access($1, $2, $3, true, $4) as result",
          [person, people, money, (await access(person)).version],
        )
      )[0].result;
    const [executive, general] = (await run(db, "owner", sectionsSql)) as Row[];
    const president = await login("president", true);
    const secretary = await login("secretary", true, "Secretary");
    const helper = await login("helper", false);

    // Outside the Executive board neither permission can be given, by the
    // dashboard or the site owner.
    assert.equal(
      await setAccess(president, helper.person, true, false),
      "not_executive",
    );
    assert.equal(
      await setAccess(president, helper.person, false, true),
      "not_executive",
    );
    await refused(
      "owner",
      "update admins set can_manage_money = true where person_id = $1",
      [helper.person],
      "SGU14",
    );
    const newcomer = randomUUID();
    const newcomerEmail = `newcomer-${newcomer.slice(0, 8)}@example.invalid`;
    await run(
      db,
      "owner",
      "insert into auth.users (id, email) values ($1, $2)",
      [newcomer, newcomerEmail],
    );
    const [{ id: newcomerPerson }] = await run(
      db,
      president,
      "insert into people (full_name, section_id, position, show_on_public) values ('Testname Newcomer', $1, 9, false) returning id",
      [general.id],
    );
    const grant = (manageMoney: boolean) =>
      run(
        db,
        president,
        "select public.grant_access($1, $2, false, $3) as result",
        [newcomerPerson, newcomerEmail, manageMoney],
      ).then((rows) => rows[0].result);
    assert.equal(await grant(true), "not_executive");
    assert.equal(await grant(false), "ok");
    // In the Executive board both can be given.
    assert.equal(
      await setAccess(president, secretary.person, true, true),
      "ok",
    );

    // Only "manage people" moves someone into or out of the Executive board
    // or changes an executive's role; other edits are any board member's.
    const insert =
      "insert into people (full_name, role_title, section_id, position, show_on_public) values ('Testname New exec', 'Treasurer', $1, 9, true)";
    await refused(helper, insert, [executive.id], "SGU15");
    await refused(
      helper,
      "update people set section_id = $1, role_title = 'Treasurer' where id = $2",
      [executive.id, helper.person],
      "SGU15",
    );
    await refused(
      helper,
      "update people set role_title = 'Treasurer' where id = $1",
      [secretary.person],
      "SGU15",
    );
    await refused(
      helper,
      "update people set section_id = $1, role_title = '' where id = $2",
      [general.id, secretary.person],
      "SGU15",
    );
    await run(
      db,
      helper,
      "update people set full_name = 'Testname Renamed' where id = $1",
      [secretary.person],
    );
    await run(db, president, insert, [executive.id]);

    // Moving someone out turns both permissions off in the same step.
    await run(
      db,
      president,
      "update people set section_id = $1, role_title = 'Musallah coordinator' where id = $2",
      [general.id, secretary.person],
    );
    const moved = await access(secretary.person);
    assert.equal(moved.can_manage_people, false);
    assert.equal(moved.can_manage_money, false);
    // Nobody moves themselves out while they can manage people, and the last
    // holder stays, even for the site owner.
    await refused(
      president,
      "update people set section_id = $1, role_title = '' where id = $2",
      [general.id, president.person],
      "SGU01",
    );
    await refused(
      "owner",
      "update people set section_id = $1, role_title = '' where id = $2",
      [general.id, president.person],
      "SGU02",
    );
    assert.equal((await access(president.person)).can_manage_people, true);
  } finally {
    await db.close();
  }
});
