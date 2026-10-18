import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { PGlite, type Transaction } from "@electric-sql/pglite";

// PR5a WP1 (docs/contracts/pr5a-notices-events-continuity.md): every migration in order on an
// isolated PostgreSQL engine with the Supabase stand-ins of `npm run test:db`. The same rules run on
// real Postgres in scripts/test-backend.ts (database suite).
const root = new URL("../", import.meta.url);
const migrationsDir = new URL("supabase/migrations/", root);

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

/** One transaction as `actor`, the way PostgREST runs a request ("owner" = the SQL editor). */
function within<T>(
  db: PGlite,
  actor: Actor,
  work: (tx: Transaction) => Promise<T>,
) {
  return db.transaction(async (tx) => {
    if (actor !== "owner") {
      const role = actor === "anon" ? "anon" : "authenticated";
      const claims = actor === "anon" ? { role } : { role, sub: actor.user };
      await tx.query(
        "select set_config('role', $1, true), set_config('request.jwt.claims', $2, true)",
        [role, JSON.stringify(claims)],
      );
    }
    return work(tx);
  });
}

async function setup() {
  const db = await database();
  const rows = async (actor: Actor, sql: string, params: unknown[] = []) =>
    within(
      db,
      actor,
      async (tx) => (await tx.query(sql, params)).rows,
    ) as Promise<Record<string, unknown>[]>;
  const value = async (actor: Actor, sql: string, params: unknown[] = []) =>
    Object.values((await rows(actor, sql, params))[0])[0];
  const refused = (
    actor: Actor,
    sql: string,
    params: unknown[],
    code: string,
    label = sql,
  ) =>
    assert.rejects(rows(actor, sql, params), (error: { code?: string }) => {
      assert.equal(error.code, code, label);
      return true;
    });
  const login = async (name: string) => {
    const id = randomUUID();
    const email = `${name}-${id.slice(0, 8)}@example.invalid`;
    await rows("owner", "insert into auth.users (id, email) values ($1, $2)", [
      id,
      email,
    ]);
    return { id, email };
  };
  const admin = async (name: string) => {
    const account = await login(name);
    await rows("owner", "select public.owner_add_admin($1, $2, true)", [
      account.email,
      `Testname ${name}`,
    ]);
    return { user: account.id };
  };
  const lastLogId = async () =>
    Number(
      await value("owner", "select coalesce(max(id), 0) from activity_log"),
    );
  const logSince = (id: number) =>
    rows(
      "owner",
      "select area, action, highlight, before, after from activity_log where id > $1 order by id",
      [id],
    );
  return { db, rows, value, refused, login, admin, lastLogId, logSince };
}

// A Grenada date `days` from the database's today.
const grenadaDay = (days: number) =>
  `((now() at time zone 'America/Grenada')::date + ${days})`;

test("urgent notices: alone, ending on or after their date in Grenada time, several at once, each hiding at its own end", async () => {
  const { db, rows, refused, admin } = await setup();
  try {
    const board = await admin("board");
    const insert =
      "insert into announcements (title, date, published, featured, expires_on, urgent_until) values ($1, $2, true, $3, $4, $5)";
    const at = (iso: string) => ["Urgent", "2026-10-10", false, null, iso];
    for (const [label, params] of [
      [
        "with featured",
        ["Urgent", "2026-10-10", true, null, "2026-10-10T20:00:00Z"],
      ],
      [
        "with Hide after",
        ["Urgent", "2026-10-10", false, "2026-10-12", "2026-10-10T20:00:00Z"],
      ],
      // 2026-10-10 03:00 UTC is 9 Oct, 11 PM in Grenada: before the notice's own date.
      ["ending before its date in Grenada", at("2026-10-10T03:00:00Z")],
    ] as const)
      await refused(board, insert, [...params], "23514", label);
    // Midnight of its own date in Grenada is allowed.
    await rows(board, insert, at("2026-10-10T04:00:00Z"));
    await rows(board, insert, [
      "Featured",
      "2026-10-10",
      true,
      "2026-10-12",
      null,
    ]);

    const urgent = (title: string, ends: string) =>
      rows(
        board,
        `insert into announcements (title, date, published, urgent_until)
         values ($1, ${grenadaDay(-2)}, true, ${ends}) returning id`,
        [title],
      ).then((result) => String(result[0].id));
    const first = await urgent("First", "now() + interval '1 hour'");
    await urgent("Second", "now() + interval '2 hours'");
    await urgent("Ended", "now() - interval '1 minute'");
    const visible = async () =>
      (
        await rows(
          "anon",
          "select title from announcements where urgent_until is not null order by title",
        )
      ).map((row) => row.title);
    assert.deepEqual(await visible(), ["First", "Second"]);
    await rows(
      board,
      "update announcements set urgent_until = now() - interval '1 second' where id = $1",
      [first],
    );
    assert.deepEqual(await visible(), ["Second"]);
    // The board still reads every row.
    assert.equal(
      (
        await rows(
          board,
          "select id from announcements where urgent_until is not null",
        )
      ).length,
      4,
    );
  } finally {
    await db.close();
  }
});

test("event status and dates: the database keeps the rules (review 2)", async () => {
  const { db, rows, refused, admin } = await setup();
  try {
    const board = await admin("board");
    const event = (columns: string, values: unknown[]) =>
      rows(
        board,
        `insert into events (title, date, ${columns}) values ('Event', '2026-10-10', ${values.map((_, i) => `$${i + 1}`).join(", ")}) returning status, status_note, end_date`,
        values,
      );
    assert.deepEqual(await event("location", ["Hall"]), [
      { status: "scheduled", status_note: "", end_date: null },
    ]);
    await event("status, status_note", ["cancelled", "Speaker unwell"]);
    await event("status", ["postponed"]);
    // 10 PM to 3 AM the next day; all day over three days; an end date
    // equal to the start date.
    await event("start_time, end_date, end_time", [
      "22:00",
      "2026-10-11",
      "03:00",
    ]);
    await event("end_date", ["2026-10-12"]);
    await event("start_time, end_date, end_time", [
      "18:00",
      "2026-10-10",
      "20:00",
    ]);
    for (const [label, columns, values] of [
      ["cancelled without a reason", "status", ["cancelled"]],
      [
        "cancelled with a blank reason",
        "status, status_note",
        ["cancelled", "  "],
      ],
      ["unknown status", "status", ["moved"]],
      ["reason too long", "status_note", ["x".repeat(251)]],
      [
        "end before start on the same day",
        "start_time, end_time",
        ["22:00", "03:00"],
      ],
      ["end equal to start", "start_time, end_time", ["22:00", "22:00"]],
      ["end without a start", "end_time", ["22:00"]],
      ["end date before the start date", "end_date", ["2026-10-09"]],
    ] as const)
      await refused(
        board,
        `insert into events (title, date, ${columns}) values ('Event', '2026-10-10', ${values.map((_, i) => `$${i + 1}`).join(", ")})`,
        [...values],
        "23514",
        label,
      );
    // The other tables keep "end after start" and have no end date.
    for (const table of ["announcements", "news_posts", "newsletters"])
      await refused(
        board,
        `insert into ${table} (title, date, start_time, end_time) values ('Item', '2026-10-10', '22:00', '03:00')`,
        [],
        "23514",
        table,
      );
  } finally {
    await db.close();
  }
});

test("New board term tables: board only, starter steps, no deletes, archived rows read-only, logged", async () => {
  const { db, rows, value, refused, login, admin, lastLogId, logSince } =
    await setup();
  try {
    const board = await admin("board");
    const outsider = { user: (await login("outsider")).id };
    assert.deepEqual(
      (
        await rows(
          "owner",
          "select title, link, done_on from handover_steps order by position",
        )
      ).map((row) => [row.title, row.link, row.done_on]),
      [
        ["Invite the new board", "/admin/people", null],
        ["Turn off leaving members’ logins", "/admin/people", null],
        ["Update the team list", "/admin/people", null],
        ["Change shared passwords", "", null],
        ["Check content", "/admin/prayer-times", null],
        ["Tell the site owner who the new board is", "", null],
      ],
    );
    for (const table of ["handover_steps", "shared_logins"]) {
      await refused("anon", `select * from ${table}`, [], "42501", table);
      assert.equal((await rows(outsider, `select * from ${table}`)).length, 0);
    }
    assert.equal(
      await value(board, "select count(*)::int from handover_steps"),
      6,
    );
    await refused(
      outsider,
      "insert into handover_steps (title, position) values ('Denied', 9)",
      [],
      "42501",
    );

    let mark = await lastLogId();
    const step = String(
      await value(
        board,
        "insert into handover_steps (title, details, link, position) values ('Hand over the key', 'From the old treasurer', '/admin', 7) returning id",
      ),
    );
    await rows(
      board,
      "update handover_steps set done_on = '2026-10-05' where id = $1",
      [step],
    );
    assert.deepEqual(
      (await logSince(mark)).map((row) => [
        row.area,
        row.action,
        row.highlight,
      ]),
      [
        ["handover_steps", "created", false],
        ["handover_steps", "updated", false],
      ],
    );
    for (const link of [
      "https://example.com",
      "/admin/",
      "/people",
      "/admin/People",
    ])
      await refused(
        board,
        "insert into handover_steps (title, link, position) values ('Step', $1, 8)",
        [link],
        "23514",
        link,
      );
    await refused(
      board,
      "delete from handover_steps where id = $1",
      [step],
      "42501",
    );

    // "Start a new term": one logged update per ticked step.
    await rows(
      board,
      "update handover_steps set done_on = '2026-10-04' where position in (1, 2)",
    );
    mark = await lastLogId();
    await rows(
      board,
      "update handover_steps set done_on = null where done_on is not null and archived_at is null",
    );
    assert.equal((await logSince(mark)).length, 3);

    // Archived steps change only by Restore.
    await rows(
      board,
      "update handover_steps set archived_at = now() where id = $1",
      [step],
    );
    await refused(
      board,
      "update handover_steps set title = 'Changed' where id = $1",
      [step],
      "SGU06",
    );
    await rows(
      board,
      "update handover_steps set archived_at = null where id = $1",
      [step],
    );

    // Shared logins: holders come from People; purging a holder empties the box, even when archived.
    const holder = String(
      await value(
        board,
        "insert into people (full_name, section_id, position, show_on_public) select 'Testname Holder', id, 9, false from people_sections where kind = 'general' returning id",
      ),
    );
    const shared = String(
      await value(
        board,
        "insert into shared_logins (service, holder_person_id, second_factor_person_id, last_changed_on, note) values ('MSA Gmail', $1, $1, '2026-09-09', 'Recovery phone is the secretary''s') returning id",
        [holder],
      ),
    );
    await refused(
      board,
      "insert into shared_logins (service) values ('  ')",
      [],
      "23514",
    );
    await refused(
      board,
      "insert into shared_logins (service, holder_person_id) values ('Go2Pay', $1)",
      [randomUUID()],
      "23503",
    );
    await refused(
      board,
      "delete from shared_logins where id = $1",
      [shared],
      "42501",
    );
    await rows(
      board,
      "update shared_logins set archived_at = now() where id = $1",
      [shared],
    );
    await refused(
      board,
      "update shared_logins set holder_person_id = null where id = $1",
      [shared],
      "SGU06",
    );
    await rows(board, "update people set archived_at = now() where id = $1", [
      holder,
    ]);
    mark = await lastLogId();
    await rows(board, "delete from people where id = $1", [holder]);
    assert.deepEqual(
      await rows(
        "owner",
        "select holder_person_id, second_factor_person_id, archived_at is not null as archived from shared_logins where id = $1",
        [shared],
      ),
      [
        {
          holder_person_id: null,
          second_factor_person_id: null,
          archived: true,
        },
      ],
    );
    assert.ok(
      (await logSince(mark)).some(
        (row) => row.area === "shared_logins" && row.action === "updated",
      ),
    );
  } finally {
    await db.close();
  }
});

test("the log highlights urgent notices and still highlights prayer changes; files follow the urgent end", async () => {
  const { db, rows, value, admin, lastLogId, logSince } = await setup();
  try {
    const board = await admin("board");
    let mark = await lastLogId();
    const plain = String(
      await value(
        board,
        `insert into announcements (title, date, published) values ('Plain', ${grenadaDay(0)}, true) returning id`,
      ),
    );
    await rows(
      board,
      "update announcements set urgent_until = now() + interval '1 hour' where id = $1",
      [plain],
    );
    await rows(
      board,
      "update announcements set urgent_until = null where id = $1",
      [plain],
    );
    await rows(
      board,
      "update announcements set title = 'Plain again' where id = $1",
      [plain],
    );
    await rows(
      board,
      "update prayer_settings set notice = 'Changed' where id = 1",
    );
    assert.deepEqual(
      (await logSince(mark)).map((row) => [
        row.area,
        row.action,
        row.highlight,
      ]),
      [
        ["announcements", "created", false],
        ["announcements", "updated", true],
        ["announcements", "updated", true],
        ["announcements", "updated", false],
        ["prayer_settings", "updated", true],
      ],
    );

    // Public files: an urgent notice's photo hides with the notice; events and the team clause still work.
    const photo = () => `${randomUUID()}.webp`;
    const [ended, current, eventPhoto, teamPhoto] = [
      photo(),
      photo(),
      photo(),
      photo(),
    ];
    for (const name of [ended, current, eventPhoto, teamPhoto])
      await rows(
        "owner",
        "insert into storage.objects (bucket_id, name) values ('community', $1)",
        [name],
      );
    const notice = (name: string, ends: string) =>
      rows(
        board,
        `insert into announcements (title, date, published, image_path, image_alt, urgent_until)
         values ('Urgent', ${grenadaDay(-1)}, true, $1, 'A photo', ${ends})`,
        [name],
      );
    await notice(ended, "now() - interval '1 minute'");
    await notice(current, "now() + interval '1 hour'");
    await rows(
      board,
      "insert into events (title, date, published, image_path, image_alt) values ('Event', current_date + 3, true, $1, 'A photo')",
      [eventPhoto],
    );
    await rows(
      board,
      `insert into people (full_name, role_title, section_id, position, show_on_public, photo_path)
       select 'Testname Listed', 'Secretary', id, 1, true, $1
       from people_sections where kind = 'executive'`,
      [teamPhoto],
    );
    const shown = (
      await rows(
        "anon",
        "select name from storage.objects where bucket_id = 'community'",
      )
    ).map((row) => row.name);
    assert.deepEqual(
      [ended, current, eventPhoto, teamPhoto].map((name) =>
        shown.includes(name),
      ),
      [false, true, true, true],
    );
    mark = await lastLogId();
    assert.ok(mark > 0);
  } finally {
    await db.close();
  }
});

test("Remove login: deleting the account logs whose login it was, readable by the board, so past changes keep the name", async () => {
  const { db, rows, value, admin } = await setup();
  try {
    const board = await admin("board");
    const member = await admin("member");
    const person = await value(
      "owner",
      "select person_id from admins where user_id = $1",
      [member.user],
    );
    // Deactivate, then delete the account (what the secret key's Auth call does).
    await rows(
      "owner",
      "update admins set deactivated_at = now() where user_id = $1",
      [member.user],
    );
    await rows("owner", "delete from auth.users where id = $1", [member.user]);
    assert.equal(
      await value(
        "owner",
        "select count(*)::int from admins where user_id = $1",
        [member.user],
      ),
      0,
    );
    // The query the Recent changes adapter runs, as a board member under RLS.
    const removed = await rows(
      board,
      "select record_id, before from activity_log where area = 'admins' and action = 'deleted'",
    );
    assert.deepEqual(
      removed.map((row) => [
        row.record_id,
        (row.before as { user_id?: string }).user_id,
      ]),
      [[person, member.user]],
    );
  } finally {
    await db.close();
  }
});
