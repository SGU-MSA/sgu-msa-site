import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { PGlite, type Transaction } from "@electric-sql/pglite";

// Review fixes P5 (supabase/migrations/202610160004_term_export.sql): "Free
// up space" clears the photos and PDFs of archived events, news posts and
// newsletters dated in a term that nothing else uses, for "manage people"
// holders only, and names those files; a file something else still uses
// stays, link and all. Every migration in order, the four
// baseline files first, on an isolated PostgreSQL engine with the Supabase
// stand-ins of `npm run test:db`.
const root = new URL("../", import.meta.url);
const migrationsDir = new URL("supabase/migrations/", root);

async function database() {
  const db = new PGlite();
  await db.exec(
    await readFile(new URL("tests/database/supabase-stubs.sql", root), "utf8"),
  );
  const names = (await readdir(migrationsDir)).filter((name) =>
    name.endsWith(".sql"),
  );
  assert.ok(names.includes("202610160004_term_export.sql"));
  for (const name of names.sort())
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

const photo = () => `${randomUUID()}.webp`;
const pdf = () => `${randomUUID()}.pdf`;

test("Free up space: managers only; archived items in the days lose the files only they use, nothing else changes", async () => {
  const db = await database();
  const rows = async (actor: Actor, sql: string, params: unknown[] = []) =>
    within(
      db,
      actor,
      async (tx) => (await tx.query(sql, params)).rows,
    ) as Promise<Record<string, unknown>[]>;
  const refused = (
    actor: Actor,
    sql: string,
    params: unknown[],
    code: string,
  ) =>
    assert.rejects(rows(actor, sql, params), (error: { code?: string }) => {
      assert.equal(error.code, code, sql);
      return true;
    });
  const admin = async (name: string, manager: boolean) => {
    const id = randomUUID();
    const email = `${name}-${id.slice(0, 8)}@example.invalid`;
    await rows("owner", "insert into auth.users (id, email) values ($1, $2)", [
      id,
      email,
    ]);
    await rows("owner", "select public.owner_add_admin($1, $2, $3)", [
      email,
      `Testname ${name}`,
      manager,
    ]);
    return { user: id };
  };
  try {
    const manager = await admin("manager", true);
    const member = await admin("member", false);
    const files = {
      oldPhoto: photo(),
      oldPdf: pdf(),
      shared: photo(),
      later: photo(),
      newsletter: pdf(),
      notice: photo(),
    };
    const add = async (
      table: string,
      date: string,
      archived: boolean,
      image: string,
      file = "",
    ) =>
      (
        await rows(
          "owner",
          `insert into public.${table} (title, date, image_path, image_alt, file_path, archived_at)
           values ('Item', $1, $2, case when $2 = '' then '' else 'A photo' end, $3, $4) returning id`,
          [date, image, file, archived ? new Date().toISOString() : null],
        )
      )[0].id as string;
    const old = await add(
      "events",
      "2026-09-10",
      true,
      files.oldPhoto,
      files.oldPdf,
    );
    const sharedNews = await add(
      "news_posts",
      "2026-09-11",
      true,
      files.shared,
    );
    const current = await add("events", "2026-09-12", false, files.shared);
    const later = await add("events", "2027-01-10", true, files.later);
    // Its photo is the shared one (kept), its PDF only its own (removed).
    const letter = await add(
      "newsletters",
      "2026-12-01",
      true,
      files.shared,
      files.newsletter,
    );
    // Two archived events of the term share a photo: it goes from both.
    const twin = await add("events", "2026-10-01", true, files.oldPhoto);
    const notice = await add("announcements", "2026-09-15", true, files.notice);
    const call = "select public.release_archived_files($1, $2) as files";
    const range = ["2026-08-01", "2026-12-31"];

    // Visitors cannot call it; a board member without "manage people" is refused.
    await refused("anon", call, range, "42501");
    await refused(member, call, range, "42501");
    await refused(manager, call, ["2026-12-31", "2026-08-01"], "22023");
    assert.equal(
      (
        await rows("owner", "select image_path from events where id = $1", [
          old,
        ])
      )[0].image_path,
      files.oldPhoto,
    );

    const [{ files: released }] = await rows(manager, call, range);
    // The shared photo stays, on every item: a current event still uses it.
    assert.deepEqual(
      released,
      [files.oldPdf, files.oldPhoto, files.newsletter].sort(),
    );
    const after = async (table: string, id: string) =>
      (
        await rows(
          "owner",
          `select title, image_path, file_path, image_alt, archived_at is not null as archived from public.${table} where id = $1`,
          [id],
        )
      )[0];
    assert.deepEqual(await after("events", old), {
      title: "Item",
      image_path: "",
      file_path: "",
      image_alt: "A photo",
      archived: true,
    });
    assert.equal((await after("events", twin)).image_path, "");
    assert.deepEqual(await after("news_posts", sharedNews), {
      title: "Item",
      image_path: files.shared,
      file_path: "",
      image_alt: "A photo",
      archived: true,
    });
    const letterAfter = await after("newsletters", letter);
    assert.equal(letterAfter.image_path, files.shared);
    assert.equal(letterAfter.file_path, "");
    // Current items, other days and announcements keep their files.
    assert.equal((await after("events", current)).image_path, files.shared);
    assert.equal((await after("events", later)).image_path, files.later);
    assert.equal(
      (await after("announcements", notice)).image_path,
      files.notice,
    );

    // Each item's change is logged as the manager's update (the migrations'
    // own updates, with no actor, are left out).
    const logged = await rows(
      "owner",
      "select area, action, actor, after ->> 'image_path' as image, after ->> 'file_path' as file from activity_log where action = 'updated' and actor is not null order by area, image",
    );
    assert.deepEqual(
      logged.map((row) => [
        row.area,
        row.action,
        row.actor,
        row.image,
        row.file,
      ]),
      [
        ["events", "updated", manager.user, "", ""],
        ["events", "updated", manager.user, "", ""],
        ["newsletters", "updated", manager.user, files.shared, ""],
      ],
    );
    // A second run finds nothing left to clear.
    assert.deepEqual((await rows(manager, call, range))[0].files, []);
  } finally {
    await db.close();
  }
});
