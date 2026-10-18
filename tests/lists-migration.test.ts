import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// Review fixes P3 (supabase/migrations/202610160002_lists.sql): the Lists, an event's category and term, and
// newsletter images, on top of the baseline, with the Supabase stand-ins of `npm run test:db`.
const root = new URL("../", import.meta.url);
const migrationsDir = new URL("supabase/migrations/", root);
const listsMigration = "202610160002_lists.sql";

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

const option = (db: PGlite, list: string, slug: string) =>
  run(db, "owner", "select * from list_options where list = $1 and slug = $2", [
    list,
    slug,
  ]).then((rows) => rows[0] as { id: string; updated_at: string });

const addEvent = (db: PGlite, actor: Actor, extra: Record<string, unknown>) =>
  run(
    db,
    actor,
    `insert into events (title, date, category_id, term_id) values ('Iftar', '2026-10-20', $1, $2) returning id`,
    [extra.category_id ?? null, extra.term_id ?? null],
  );

test("the starter lists: the five event categories and seven resource kinds, no terms, applied twice", async () => {
  const db = await database();
  try {
    // Running the file again changes nothing (idempotent).
    await db.exec(
      await readFile(new URL(listsMigration, migrationsDir), "utf8"),
    );
    const rows = await run(
      db,
      "anon",
      "select list, slug, position from list_options order by list, position",
    );
    assert.deepEqual(
      rows.filter((row) => row.list === "event_categories").map((r) => r.slug),
      ["msa", "academic", "informational", "faith", "social"],
    );
    assert.deepEqual(
      rows
        .filter((row) => row.list === "resource_categories")
        .map((r) => r.slug),
      [
        "newsletter",
        "infographic",
        "guide",
        "academic",
        "faith",
        "ramadan",
        "incoming-students",
      ],
    );
    assert.equal(rows.filter((row) => row.list === "terms").length, 0);
    assert.equal(
      (
        await run(
          db,
          "owner",
          "select count(*)::int as n from activity_log where area = 'list_options'",
        )
      )[0].n,
      0,
      "the starter options are not a board change",
    );
  } finally {
    await db.close();
  }
});

test("any board member adds, renames and orders options; visitors only read", async () => {
  const db = await database();
  try {
    const board = await admin(db);
    await assert.rejects(
      run(
        db,
        "anon",
        "insert into list_options (list, name, slug, position) values ('terms', 'Fall', 'fall', 1)",
      ),
    );
    await run(
      db,
      board,
      "insert into list_options (list, name, slug, position) values ('terms', '2026 Fall', '2026-fall', 1), ('terms', '2027 Spring', '2027-spring', 2)",
    );
    // The same name twice in one list is refused, whatever its case.
    await assert.rejects(
      run(
        db,
        board,
        "insert into list_options (list, name, slug, position) values ('terms', '2026 fall ', '2026-fall-2', 3)",
      ),
    );
    const fall = await option(db, "terms", "2026-fall");
    const spring = await option(db, "terms", "2027-spring");
    await run(
      db,
      board,
      "update list_options set name = 'Fall 2026' where id = $1",
      [fall.id],
    );
    // The slug and the list stay.
    await assert.rejects(
      run(db, board, "update list_options set slug = 'fall' where id = $1", [
        fall.id,
      ]),
    );
    await assert.rejects(
      run(
        db,
        board,
        "update list_options set list = 'event_categories' where id = $1",
        [fall.id],
      ),
    );
    const renamed = await option(db, "terms", "2026-fall");
    assert.equal(
      (
        await run(
          db,
          board,
          "select public.save_order('list_options', $1, $2) as r",
          [
            [spring.id, fall.id],
            [spring.updated_at, renamed.updated_at],
          ],
        )
      )[0].r,
      "ok",
    );
    assert.deepEqual(
      (
        await run(
          db,
          "anon",
          "select name from list_options where list = 'terms' order by position",
        )
      ).map((row) => row.name),
      ["2027 Spring", "Fall 2026"],
    );
    assert.ok(
      Number(
        (
          await run(
            db,
            "owner",
            "select count(*)::int as n from activity_log where area = 'list_options'",
          )
        )[0].n,
      ) >= 4,
      "adds, the rename and the moves are logged",
    );
  } finally {
    await db.close();
  }
});

test("an event takes a category and a term from their own lists; a used option cannot be deleted", async () => {
  const db = await database();
  try {
    const board = await admin(db);
    const msa = await option(db, "event_categories", "msa");
    const social = await option(db, "event_categories", "social");
    await run(
      db,
      board,
      "insert into list_options (list, name, slug, position) values ('terms', '2026 Fall', '2026-fall', 1)",
    );
    const fall = await option(db, "terms", "2026-fall");
    // A term in the category box, or a category in the term box, is refused.
    await assert.rejects(addEvent(db, board, { category_id: fall.id }));
    await assert.rejects(addEvent(db, board, { term_id: msa.id }));
    const [event] = await addEvent(db, board, {
      category_id: msa.id,
      term_id: fall.id,
    });
    // Used: refused with the foreign-key code, archived or not.
    await run(
      db,
      board,
      "update events set archived_at = now() where id = $1",
      [event.id],
    );
    await assert.rejects(
      run(db, board, "delete from list_options where id = $1", [msa.id]),
      (error: { code?: string }) => error.code === "23503",
    );
    await assert.rejects(
      run(db, board, "delete from list_options where id = $1", [fall.id]),
    );
    // Unused: deleted, and visitors cannot delete.
    await assert.rejects(
      run(db, "anon", "delete from list_options where id = $1", [social.id]),
    );
    assert.equal(
      (
        await run(
          db,
          "anon",
          "select count(*)::int as n from list_options where id = $1",
          [social.id],
        )
      )[0].n,
      1,
    );
    await run(db, board, "delete from list_options where id = $1", [social.id]);
    assert.equal(
      (
        await run(
          db,
          "anon",
          "select count(*)::int as n from list_options where id = $1",
          [social.id],
        )
      )[0].n,
      0,
    );
  } finally {
    await db.close();
  }
});

test("a resource category the Resources page uses cannot be deleted", async () => {
  const db = await database();
  try {
    const board = await admin(db);
    // The starter Resources page uses "guide" (Jumu'ah at SGU) but not "ramadan".
    const guide = await option(db, "resource_categories", "guide");
    const ramadan = await option(db, "resource_categories", "ramadan");
    await assert.rejects(
      run(db, board, "delete from list_options where id = $1", [guide.id]),
      (error: { code?: string }) => error.code === "23503",
    );
    await run(db, board, "delete from list_options where id = $1", [
      ramadan.id,
    ]);
  } finally {
    await db.close();
  }
});

test("a newsletter may be an uploaded image (WebP) or a PDF, nothing else", async () => {
  const db = await database();
  try {
    const board = await admin(db);
    const add = (file: string) =>
      run(
        db,
        board,
        "insert into newsletters (title, date, file_path) values ('October', '2026-10-01', $1)",
        [file],
      );
    await add(`${randomUUID()}.pdf`);
    await add(`${randomUUID()}.webp`);
    await assert.rejects(add(`${randomUUID()}.png`));
    await assert.rejects(add("newsletter.pdf"));
  } finally {
    await db.close();
  }
});
