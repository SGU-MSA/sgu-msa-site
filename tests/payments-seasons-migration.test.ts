import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { PGlite, type Transaction } from "@electric-sql/pglite";

// PR6 WP-3 (docs/contracts/pr6-go2pay-payments.md): every migration in order on an isolated
// PostgreSQL engine with the Supabase stand-ins of `npm run test:db`. The same rules run on real
// Postgres in scripts/test-backend.ts (database suite).
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
      "select area, action, highlight, record_id from activity_log where id > $1 order by id",
      [id],
    );
  return { db, rows, value, refused, login, admin, lastLogId, logSince };
}

const insertItem = `insert into payment_items (slug, name, kind, category, about, heading, listed, position)
  values ($1, $2, $3, $4, $5, $6, $7, 1) returning id`;
const item = (
  slug: string,
  overrides: Partial<{
    kind: string;
    category: string;
    about: string;
    heading: string;
    listed: boolean;
  }> = {},
) => [
  slug,
  slug,
  overrides.kind ?? "fund",
  overrides.category ?? "sadaqah",
  overrides.about ?? "",
  overrides.heading ?? "",
  overrides.listed ?? false,
];

test("seasons: three starter seasons, read by visitors, one current name each, in-use seasons stay", async () => {
  const { db, rows, value, refused, admin, lastLogId, logSince } =
    await setup();
  try {
    const board = await admin("board");
    assert.deepEqual(
      await rows(
        "anon",
        "select name, hijri_month, hijri_first_day, hijri_last_day from seasons order by hijri_month",
      ),
      [
        {
          name: "Ramadan",
          hijri_month: 9,
          hijri_first_day: 1,
          hijri_last_day: null,
        },
        {
          name: "Eid al-Fitr",
          hijri_month: 10,
          hijri_first_day: 1,
          hijri_last_day: 1,
        },
        {
          name: "Eid al-Adha",
          hijri_month: 12,
          hijri_first_day: 10,
          hijri_last_day: 10,
        },
      ],
    );
    await refused(
      "anon",
      "insert into seasons (name, board_starts_on, board_ends_on) values ('X', current_date, current_date)",
      [],
      "42501",
    );
    // Typed seasons need both days; a Hijri anchor needs month and day together.
    for (const [label, sql] of [
      ["typed without days", "insert into seasons (name) values ('No days')"],
      [
        "month without day",
        "insert into seasons (name, hijri_month) values ('Half', 1)",
      ],
      [
        "until before from",
        "insert into seasons (name, hijri_month, hijri_first_day, hijri_last_day) values ('Back', 1, 10, 9)",
      ],
    ])
      await refused(board, sql, [], "23514", label);
    await refused(
      board,
      "insert into seasons (name, hijri_month, hijri_first_day) values ('ramadan', 9, 1)",
      [],
      "23505",
      "a second current Ramadan",
    );

    // A confirmed day is highlighted in Recent changes (D-18).
    const mark = await lastLogId();
    const ramadan = String(
      await value(board, "select id from seasons where name = 'Ramadan'"),
    );
    await rows(
      board,
      "update seasons set board_starts_on = '2027-02-08' where id = $1",
      [ramadan],
    );
    await rows(board, "update seasons set name = 'Ramadan' where id = $1", [
      ramadan,
    ]);
    const logged = await logSince(mark);
    assert.deepEqual(
      logged.map((entry) => [entry.area, entry.highlight]),
      [["seasons", true]],
      "a day change is highlighted; an unchanged save is not logged",
    );

    // SGU08: archived only when no current item uses it.
    const fund = String(
      await value(board, insertItem, [...item("iftar")]).then(String),
    );
    await rows(board, "update payment_items set season_id = $1 where id = $2", [
      ramadan,
      fund,
    ]);
    await refused(
      board,
      "update seasons set archived_at = now() where id = $1",
      [ramadan],
      "SGU08",
    );
    await rows(
      board,
      "update payment_items set archived_at = now() where id = $1",
      [fund],
    );
    await rows(board, "update seasons set archived_at = now() where id = $1", [
      ramadan,
    ]);
    assert.equal(
      Number(await value("anon", "select count(*) from seasons")),
      2,
      "visitors no longer see it",
    );
    await refused(
      board,
      "update seasons set name = 'Changed' where id = $1",
      [ramadan],
      "SGU06",
    );
    await refused(board, "delete from seasons", [], "42501");
  } finally {
    await db.close();
  }
});

test("payment items: the category locks once a fund is shown; slugs never change or repeat", async () => {
  const { db, rows, value, refused, admin, login, lastLogId, logSince } =
    await setup();
  try {
    const board = await admin("board");
    const outsider = { user: (await login("outsider")).id };
    await refused("anon", insertItem, item("anon"), "42501");
    await refused(outsider, insertItem, item("outsider"), "42501");

    // A client-sent first_shown_at is ignored; an unlisted fund is not locked.
    const fund = String(
      await value(
        board,
        `insert into payment_items (slug, name, kind, category, listed, position, first_shown_at)
         values ('iftar', 'Iftar', 'fund', 'sadaqah', false, 1, '2020-01-01') returning id`,
      ),
    );
    const shown = () =>
      value(board, "select first_shown_at from payment_items where id = $1", [
        fund,
      ]);
    assert.equal(await shown(), null);
    await rows(
      board,
      "update payment_items set category = 'general' where id = $1",
      [fund],
    );

    // The first listed save stamps it, and is highlighted.
    const mark = await lastLogId();
    await rows(board, "update payment_items set listed = true where id = $1", [
      fund,
    ]);
    const stamped = await shown();
    assert.ok(stamped instanceof Date);
    assert.ok((await logSince(mark)).every((entry) => entry.highlight));

    // Then category and kind are locked; everything else still changes.
    for (const change of ["category = 'sadaqah'", "kind = 'priced'"])
      await refused(
        board,
        `update payment_items set ${change} where id = $1`,
        [fund],
        "SGU10",
        change,
      );
    await rows(
      board,
      `update payment_items set name = 'Iftar 2027', about = 'Helps pay for iftar.', heading = 'Ramadan',
         shows_from = '2027-02-01', shows_until = '2027-03-10', listed = false,
         first_shown_at = null where id = $1`,
      [fund],
    );
    assert.deepEqual(await shown(), stamped, "the stamp cannot be cleared");
    const mark2 = await lastLogId();
    await rows(board, "update payment_items set listed = true where id = $1", [
      fund,
    ]);
    assert.ok(
      (await logSince(mark2)).every((entry) => !entry.highlight),
      "listing again is not a new lock",
    );

    // Slugs: never changed, never reused (archived rows included).
    await refused(
      board,
      "update payment_items set slug = 'iftar-2' where id = $1",
      [fund],
      "SGU10",
    );
    await rows(
      board,
      "update payment_items set archived_at = now() where id = $1",
      [fund],
    );
    await refused(board, insertItem, item("iftar"), "23505");
    await refused(
      board,
      "update payment_items set name = 'Archived edit' where id = $1",
      [fund],
      "SGU06",
    );

    // Zakat funds can be listed from the start (D-75); insert-listed funds lock at once.
    const zakat = String(
      await value(
        board,
        insertItem,
        item("zakat-al-mal", {
          category: "zakat_al_mal",
          about: "Passed on to people in need.",
          listed: true,
        }),
      ),
    );
    assert.ok(
      (await value(
        board,
        "select first_shown_at from payment_items where id = $1",
        [zakat],
      )) instanceof Date,
    );

    // Priced items: always General, no heading, never locked by listing.
    for (const [label, params] of [
      ["priced sadaqah", item("t1", { kind: "priced", category: "sadaqah" })],
      [
        "priced heading",
        item("t2", { kind: "priced", category: "general", heading: "Tickets" }),
      ],
      ["heading over 40", item("long", { heading: "x".repeat(41) })],
      ["about over 300", item("about", { about: "x".repeat(301) })],
      ["bad slug", item("Bad Slug")],
    ] as const)
      await refused(board, insertItem, [...params], "23514", label);
    // No default category or kind (D-29).
    await refused(
      board,
      insertItem,
      [...item("none").slice(0, 3), null, "", "", false],
      "23502",
    );
    const ticket = String(
      await value(
        board,
        insertItem,
        item("dinner-ticket", {
          kind: "priced",
          category: "general",
          listed: true,
        }),
      ),
    );
    assert.equal(
      await value(
        board,
        "select first_shown_at from payment_items where id = $1",
        [ticket],
      ),
      null,
    );
    await refused(board, "delete from payment_items", [], "42501");

    // Visitors read current listed rows only (an unlisted draft stays private).
    await value(board, insertItem, item("unlisted-draft"));
    assert.deepEqual(
      (await rows("anon", "select slug from payment_items order by slug")).map(
        (row) => row.slug,
      ),
      ["dinner-ticket", "zakat-al-mal"],
    );
  } finally {
    await db.close();
  }
});

test("Go2Pay links: one item per product ever, add-only, highlighted, visitors see current items' links", async () => {
  const { db, rows, value, refused, admin, lastLogId, logSince } =
    await setup();
  try {
    const board = await admin("board");
    const first = String(
      await value(board, insertItem, item("general", { listed: true })),
    );
    const second = String(
      await value(board, insertItem, item("sadaqah", { listed: true })),
    );
    const draft = String(await value(board, insertItem, item("draft")));
    const link = (product: number, owner: string) =>
      rows(
        board,
        "insert into payment_item_links (go2pay_product_id, payment_item_id) values ($1, $2)",
        [product, owner],
      );
    const mark = await lastLogId();
    await link(1650, first);
    assert.deepEqual(
      (await logSince(mark)).map((entry) => [
        entry.area,
        entry.record_id,
        entry.highlight,
      ]),
      [["payment_item_links", "1650", true]],
    );
    await refused(
      board,
      "insert into payment_item_links (go2pay_product_id, payment_item_id) values (1650, $1)",
      [second],
      "23505",
      "a product already linked to another item",
    );
    await refused(
      board,
      "insert into payment_item_links (go2pay_product_id, payment_item_id) values (0, $1)",
      [second],
      "23514",
    );
    await refused(
      board,
      "update payment_item_links set payment_item_id = $1",
      [second],
      "42501",
    );
    await refused(board, "delete from payment_item_links", [], "42501");
    await refused(
      "anon",
      "insert into payment_item_links (go2pay_product_id, payment_item_id) values (2, $1)",
      [second],
      "42501",
    );

    await link(557, second);
    await link(42, draft);
    assert.deepEqual(
      (
        await rows(
          "anon",
          "select go2pay_product_id from payment_item_links order by 1",
        )
      ).map((row) => Number(row.go2pay_product_id)),
      [557, 1650],
      "an unlisted draft's link is hidden from visitors",
    );
    await rows(
      board,
      "update payment_items set archived_at = now() where id = $1",
      [second],
    );
    assert.deepEqual(
      (
        await rows(
          "anon",
          "select go2pay_product_id from payment_item_links order by 1",
        )
      ).map((row) => Number(row.go2pay_product_id)),
      [1650],
      "an archived item's link is hidden from visitors",
    );
    assert.equal(
      Number(await value(board, "select count(*) from payment_item_links")),
      3,
      "board members read every link",
    );
    assert.equal(
      (await rows("anon", "select slug from payment_items")).length,
      1,
      "visitors read current listed items only",
    );
  } finally {
    await db.close();
  }
});

test("an event has at most one ticket item, and each ticket item one event", async () => {
  const { db, rows, value, refused, admin } = await setup();
  try {
    const board = await admin("board");
    const ticket = String(
      await value(
        board,
        insertItem,
        item("ticket", { kind: "priced", category: "general" }),
      ),
    );
    const event = (title: string) =>
      rows(
        board,
        "insert into events (title, date, ticket_payment_item_id) values ($1, current_date, $2)",
        [title, ticket],
      );
    await event("Dinner");
    await refused(
      board,
      "insert into events (title, date, ticket_payment_item_id) values ('Second', current_date, $1)",
      [ticket],
      "23505",
    );
    await refused(
      board,
      "insert into events (title, date, ticket_payment_item_id) values ('Unknown', current_date, $1)",
      [randomUUID()],
      "23503",
    );
  } finally {
    await db.close();
  }
});

test("SGU09: nobody turns on their own manage money; another manager can", async () => {
  const { db, rows, value, admin } = await setup();
  try {
    const alpha = await admin("alpha");
    const beta = await admin("beta");
    const person = async (who: { user: string }) =>
      String(
        await value(
          "owner",
          "select person_id from admins where user_id = $1",
          [who.user],
        ),
      );
    const version = async (who: { user: string }) =>
      String(
        await value(
          "owner",
          "select updated_at::text from admins where user_id = $1",
          [who.user],
        ),
      );
    const setAccess = async (
      actor: { user: string },
      target: { user: string },
      money: boolean,
    ) =>
      value(actor, "select public.set_access($1, true, $2, true, $3)", [
        await person(target),
        money,
        await version(target),
      ]);
    assert.equal(await setAccess(alpha, alpha, true), "self_money");
    assert.equal(await setAccess(beta, alpha, true), "ok");
    // Turning one's own money permission off is allowed.
    assert.equal(await setAccess(alpha, alpha, false), "ok");
    assert.equal(
      await value(
        "owner",
        "select can_manage_money from admins where user_id = $1",
        [alpha.user],
      ),
      false,
    );
    // The site owner (SQL editor) is not a signed-in member: the rule does not apply.
    await rows(
      "owner",
      "update admins set can_manage_money = true where user_id = $1",
      [alpha.user],
    );
  } finally {
    await db.close();
  }
});
