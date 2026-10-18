import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { PGlite, type Transaction } from "@electric-sql/pglite";

// PR5c (supabase/migrations/202610150001_schema.sql): season pages, an
// event's season, merch collections and items, and merch sizes as priced
// items. Every migration in order on an isolated PostgreSQL engine with the
// Supabase stand-ins of `npm run test:db`.
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
  const admin = async (name: string) => {
    const id = randomUUID();
    const email = `${name}-${id.slice(0, 8)}@example.invalid`;
    await rows("owner", "insert into auth.users (id, email) values ($1, $2)", [
      id,
      email,
    ]);
    await rows("owner", "select public.owner_add_admin($1, $2, true)", [
      email,
      `Testname ${name}`,
    ]);
    return { user: id };
  };
  return { db, rows, value, refused, admin };
}

const photo = () => `${randomUUID()}.webp`;

test("season pages: Ramadan's page is seeded; addresses are made once and never change", async () => {
  const { db, rows, value, admin } = await setup();
  try {
    const board = await admin("board");
    const seasons = await rows(
      "anon",
      "select name, slug, has_page, sign_up_form, jsonb_array_length(schedule) as rows, jsonb_array_length(photos) as photos from seasons order by name",
    );
    assert.deepEqual(seasons, [
      {
        name: "Eid al-Adha",
        slug: "eid-al-adha",
        has_page: false,
        sign_up_form: "",
        rows: 0,
        photos: 0,
      },
      {
        name: "Eid al-Fitr",
        slug: "eid-al-fitr",
        has_page: false,
        sign_up_form: "",
        rows: 0,
        photos: 0,
      },
      {
        name: "Ramadan",
        slug: "ramadan",
        has_page: true,
        sign_up_form: "ramadan_volunteer",
        rows: 4,
        photos: 5,
      },
    ]);
    // A new season's address comes from its name; a second one with the
    // same start gets "-2"; a sent address is ignored on update.
    const id = await value(
      board,
      "insert into seasons (name, board_starts_on, board_ends_on) values ('Islamic Awareness Week!', current_date, current_date) returning id",
    );
    assert.equal(
      await value(board, "select slug from seasons where id = $1", [id]),
      "islamic-awareness-week",
    );
    await rows(board, "update seasons set archived_at = now() where id = $1", [
      id,
    ]);
    await rows(
      board,
      "insert into seasons (name, board_starts_on, board_ends_on) values ('Islamic Awareness Week', current_date, current_date)",
    );
    assert.equal(
      await value(
        board,
        "select slug from seasons where name = 'Islamic Awareness Week'",
      ),
      "islamic-awareness-week-2",
    );
    await rows(
      board,
      "update seasons set slug = 'other', name = 'Ramadan month' where slug = 'ramadan'",
    );
    assert.equal(
      await value("anon", "select name from seasons where slug = 'ramadan'"),
      "Ramadan month",
    );
  } finally {
    await db.close();
  }
});

test("season pages: the schedule and photo lists are checked by the database", async () => {
  const { db, rows, refused, admin } = await setup();
  try {
    const board = await admin("board");
    const update = (column: string, value: unknown) =>
      rows(
        board,
        `update seasons set ${column} = $1::jsonb where slug = 'ramadan'`,
        [JSON.stringify(value)],
      );
    await update("schedule", [{ what: "Iftar", when: "Maghrib", where: "" }]);
    for (const bad of [
      [{ what: "", when: "Maghrib" }],
      [{ what: "Iftar" }],
      [{ what: "x".repeat(121), when: "Maghrib" }],
      Array.from({ length: 41 }, () => ({ what: "a", when: "b" })),
      { what: "Iftar", when: "Maghrib" },
    ])
      await refused(
        board,
        "update seasons set schedule = $1::jsonb where slug = 'ramadan'",
        [JSON.stringify(bad)],
        "23514",
        JSON.stringify(bad).slice(0, 60),
      );
    await update("photos", [{ src: `/media/${photo()}`, alt: "Iftar" }]);
    for (const bad of [
      [{ src: "https://example.com/a.webp", alt: "x" }],
      [{ src: `/media/${photo()}`, alt: " " }],
      Array.from({ length: 13 }, () => ({
        src: `/media/${photo()}`,
        alt: "x",
      })),
    ])
      await refused(
        board,
        "update seasons set photos = $1::jsonb where slug = 'ramadan'",
        [JSON.stringify(bad)],
        "23514",
      );
    await refused(
      board,
      "update seasons set sign_up_form = 'Not A Key' where slug = 'ramadan'",
      [],
      "23514",
    );
  } finally {
    await db.close();
  }
});

test("merch: visitors read current rows only; any board member writes; nothing is deleted; changes are logged", async () => {
  const { db, rows, value, refused, admin } = await setup();
  try {
    const board = await admin("board");
    assert.deepEqual(
      await rows(
        "anon",
        "select c.name, c.era, count(i.id)::int as items from merch_collections c left join merch_items i on i.collection_id = c.id group by c.name, c.era, c.position order by c.position",
      ),
      [
        { name: "Green Collection", era: "past", items: 1 },
        { name: "Maroon Collection", era: "past", items: 1 },
        { name: "Shukr", era: "current", items: 1 },
      ],
    );
    const collection = await value(
      board,
      "insert into merch_collections (name, era, position) values ('Winter', 'current', 4) returning id",
    );
    const item = await value(
      board,
      `insert into merch_items (collection_id, name, photos, position)
       values ($1, 'Hoodie', $2::jsonb, 1) returning id`,
      [
        collection,
        JSON.stringify([{ src: `/media/${photo()}`, alt: "Front" }]),
      ],
    );
    await refused(
      board,
      "insert into merch_collections (name, era, position) values ('X', 'soon', 5)",
      [],
      "23514",
    );
    // Archived: off the public read, read-only until restored.
    await rows(
      board,
      "update merch_collections set archived_at = now() where id = $1",
      [collection],
    );
    assert.equal(
      Number(
        await value("anon", "select count(*) from merch_items where id = $1", [
          item,
        ]),
      ),
      0,
      "an item of an archived collection is not public",
    );
    await refused(
      board,
      "update merch_collections set name = 'Y' where id = $1",
      [collection],
      "SGU06",
    );
    await refused(board, "delete from merch_items", [], "42501");
    await refused(
      "anon",
      "insert into merch_collections (name, era, position) values ('Z', 'past', 9)",
      [],
      "42501",
    );
    assert.ok(
      Number(
        await value(
          "owner",
          "select count(*) from activity_log where area in ('merch_collections', 'merch_items')",
        ),
      ) >= 3,
    );
    // The board drags collections and items into order.
    const ids = (
      await rows(
        board,
        "select id, updated_at from merch_collections where archived_at is null order by position",
      )
    ).reverse();
    assert.equal(
      await value(
        board,
        "select public.save_order('merch_collections', $1::uuid[], $2::timestamptz[])",
        [ids.map((row) => row.id), ids.map((row) => row.updated_at)],
      ),
      "ok",
    );
  } finally {
    await db.close();
  }
});

test("merch sizes: priced items of an item, one per label, never a fund or seasonal", async () => {
  const { db, rows, value, refused, admin } = await setup();
  try {
    const board = await admin("board");
    const shirt = await value(
      "anon",
      "select id from merch_items where name = 'Shukr long-sleeve'",
    );
    const size = (slug: string, label: string | null, extra = "") =>
      `insert into payment_items (slug, name, kind, category, listed, position, merch_item_id, size_label${extra ? ", " + extra.split("=")[0] : ""})
       values ('${slug}', 'Shukr · ${label}', 'priced', 'general', true, 1, '${shirt}', ${label === null ? "null" : `'${label}'`}${extra ? ", " + extra.split("=")[1] : ""})`;
    await rows(board, size("shukr-m", "M"));
    await refused(board, size("shukr-m-2", "m"), [], "23505", "one current M");
    await refused(
      board,
      size("shukr-x", null),
      [],
      "23514",
      "a size has a label",
    );
    await refused(
      board,
      `insert into payment_items (slug, name, kind, category, position, merch_item_id, size_label)
       values ('fund-size', 'X', 'fund', 'general', 1, $1, 'S')`,
      [shirt],
      "23514",
      "a size is priced",
    );
    await refused(
      board,
      `insert into payment_items (slug, name, kind, category, position, size_label)
       values ('no-item', 'X', 'priced', 'general', 1, 'S')`,
      [],
      "23514",
      "a label needs an item",
    );
    // SGU16: the item stays while it has a current size.
    await refused(
      board,
      "update merch_items set archived_at = now() where id = $1",
      [shirt],
      "SGU16",
    );
    // Archived, its label is free again.
    await rows(
      board,
      "update payment_items set archived_at = now() where slug = 'shukr-m'",
    );
    await rows(board, size("shukr-m-again", "M"));
    await rows(
      board,
      "update payment_items set archived_at = now() where slug = 'shukr-m-again'",
    );
    await rows(
      board,
      "update merch_items set archived_at = now() where id = $1",
      [shirt],
    );
  } finally {
    await db.close();
  }
});

test("photos of season pages and current merch items are public and kept", async () => {
  const { db, rows, admin } = await setup();
  try {
    const board = await admin("board");
    const [season, merch, eid, none] = [photo(), photo(), photo(), photo()];
    for (const name of [season, merch, eid, none])
      await rows(
        "owner",
        "insert into storage.objects (bucket_id, name) values ('community', $1)",
        [name],
      );
    const list = (name: string) =>
      JSON.stringify([{ src: `/media/${name}`, alt: "A photo" }]);
    await rows(
      board,
      "update seasons set photos = $1::jsonb where slug = 'ramadan'",
      [list(season)],
    );
    // A season without a page keeps its photo private, but in use.
    await rows(
      board,
      "update seasons set photos = $1::jsonb where slug = 'eid-al-fitr'",
      [list(eid)],
    );
    await rows(
      board,
      "update merch_items set photos = $1::jsonb where name = 'Shukr long-sleeve'",
      [list(merch)],
    );
    const shown = (
      await rows(
        "anon",
        "select name from storage.objects where bucket_id = 'community'",
      )
    ).map((row) => row.name);
    assert.deepEqual(
      [season, merch, eid, none].map((name) => shown.includes(name)),
      [true, true, false, false],
    );
    const inUse = async (name: string) =>
      (
        await rows(board, "select public.community_file_in_use($1) as used", [
          name,
        ])
      )[0].used;
    assert.deepEqual(await Promise.all([season, merch, eid, none].map(inUse)), [
      true,
      true,
      true,
      false,
    ]);
  } finally {
    await db.close();
  }
});

test("an event may belong to a season", async () => {
  const { db, rows, value, refused, admin } = await setup();
  try {
    const board = await admin("board");
    const ramadan = await value(
      "anon",
      "select id from seasons where slug = 'ramadan'",
    );
    await rows(
      board,
      "insert into events (title, date, published, season_id) values ('Iftar', current_date, true, $1)",
      [ramadan],
    );
    await refused(
      board,
      "insert into events (title, date, published, season_id) values ('X', current_date, true, $1)",
      [randomUUID()],
      "23503",
    );
  } finally {
    await db.close();
  }
});
