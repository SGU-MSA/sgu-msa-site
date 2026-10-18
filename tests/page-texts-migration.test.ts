import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { editorialDocuments, pageTextKeys } from "../src/lib/content/documents";
import { pageTextProblems } from "../src/lib/content/page-fields";
import {
  googleFormSqlPattern,
  googleFormSqlRefused,
  isGoogleFormUrl,
} from "../src/lib/integrations/google-forms";

// PR5b WP1 (docs/contracts/pr5b-page-text-forms-reminders.md): every migration in order on an
// isolated PostgreSQL engine with the Supabase stand-ins of `npm run test:db`.
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
  /**
   * A board member: in the General board, or with "manage people" in the
   * Executive board as President (the only group that may hold it, 2026-10-06).
   */
  const admin = async (name: string, managePeople = false) => {
    const id = randomUUID();
    const email = `${name}-${id.slice(0, 8)}@example.invalid`;
    await rows("owner", "insert into auth.users (id, email) values ($1, $2)", [
      id,
      email,
    ]);
    await rows("owner", "select public.owner_add_admin($1, $2, $3)", [
      email,
      `Testname ${name}`,
      managePeople,
    ]);
    return { user: id };
  };
  /** A board member in the Executive board, who edits Pages (review 3 B). */
  const executive = async (name: string) => {
    const account = await admin(name, true);
    await rows(
      "owner",
      `update people set role_title = 'Secretary',
        section_id = (select id from people_sections where kind = 'executive')
      where id = (select person_id from admins where user_id = $1)`,
      [account.user],
    );
    return account;
  };
  return { db, rows, refused, admin, executive };
}

const photo = () => `${randomUUID()}.webp`;

test("page texts: every document seeded, valid and savable unchanged; everyone reads, only the Executive board writes, nobody deletes", async () => {
  const { db, rows, refused, admin, executive } = await setup();
  try {
    const seeded = await rows("anon", "select key, document from page_texts");
    assert.deepEqual(
      seeded.map((row) => row.key).sort(),
      [...pageTextKeys].sort(),
    );
    for (const { key, document } of seeded) {
      const name = key as (typeof pageTextKeys)[number];
      assert.ok(
        editorialDocuments[name].schema.safeParse(document).success,
        `${name} matches its schema`,
      );
      assert.deepEqual(pageTextProblems(name, document), [], name);
    }
    // PR6 PR-C: the receipt note starts filled in (seeded here; no add-on migration).
    assert.deepEqual(
      seeded.find((row) => row.key === "integrations")?.document,
      {
        payments: {
          receipt_note:
            "Thank you for supporting the SGU MSA. JazakAllahu khayran. Questions: so-msa@sgu.edu. This is not a tax receipt.",
        },
      },
    );
    // Seeding is not a board change.
    assert.deepEqual(
      await rows(
        "owner",
        "select * from activity_log where area = 'page_texts'",
      ),
      [],
    );

    await refused(
      "anon",
      "update page_texts set document = '{}' where key = 'faq'",
      [],
      "42501",
    );
    // A signed-in account without board access changes nothing.
    const outsider = { user: randomUUID() };
    assert.deepEqual(
      await rows(
        outsider,
        "update page_texts set document = '{}' where key = 'faq' returning key",
      ),
      [],
    );
    // Review 3 B: a board member outside the Executive board changes nothing.
    const general = await admin("general");
    assert.deepEqual(
      await rows(
        general,
        "update page_texts set document = document where key = 'faq' returning key",
      ),
      [],
    );
    await refused(
      general,
      "insert into page_texts (key, document) values ('ramadan', '{}')",
      [],
      "42501",
      "only the Executive board inserts",
    );
    const board = await executive("board");
    const [before] = await rows(
      board,
      "select document, updated_at from page_texts where key = 'about'",
    );
    const changed = structuredClone(before.document) as {
      board: { heading: string };
    };
    changed.board.heading = "Meet the board";
    await rows(
      board,
      "update page_texts set document = $1 where key = 'about' and updated_at = $2",
      [JSON.stringify(changed), before.updated_at],
    );
    const [log] = await rows(
      "owner",
      "select action, record_id, before, after, actor from activity_log where area = 'page_texts'",
    );
    assert.equal(log.action, "updated");
    assert.equal(log.record_id, "about");
    assert.equal(log.actor, board.user);
    // The log keeps the full documents, so History can put the old one back.
    assert.deepEqual(
      (log.before as { document: unknown }).document,
      before.document,
    );
    assert.equal(
      (log.after as { document: { board: { heading: string } } }).document.board
        .heading,
      "Meet the board",
    );

    await refused(
      board,
      "delete from page_texts where key = 'about'",
      [],
      "42501",
    );
    await refused(
      board,
      "insert into page_texts (key, document) values ('ramadan', '{}')",
      [],
      "23514",
      "only the known keys",
    );
    await refused(
      board,
      "update page_texts set document = '[]' where key = 'faq'",
      [],
      "23514",
      "a document is an object",
    );
  } finally {
    await db.close();
  }
});

test("Pages follow the Executive board (review 3 B): moving someone in or out, or turning their login off, gives or takes it at once", async () => {
  const { db, rows, admin } = await setup();
  try {
    const canEdit = async (actor: { user: string }) =>
      (await rows(actor, "select public.can_edit_pages() as can"))[0].can;
    const edit = async (actor: { user: string }) =>
      (
        await rows(
          actor,
          "update page_texts set document = document where key = 'faq' returning key",
        )
      ).length;
    const member = await admin("member");
    const manager = await admin("manager", true);
    assert.equal(await canEdit(member), false, "General board");
    assert.equal(await edit(member), 0);
    const move = (group: "executive" | "general", role: string) =>
      rows(
        manager,
        `update people set role_title = $2,
          section_id = (select id from people_sections where kind = $1)
        where id = (select person_id from admins where user_id = $3)`,
        [group, role, member.user],
      );
    await move("executive", "Treasurer");
    assert.equal(await canEdit(member), true, "moved into the Executive board");
    assert.equal(await edit(member), 1);
    await move("general", "Musallah coordinator");
    assert.equal(await canEdit(member), false, "moved out again");
    assert.equal(await edit(member), 0);
    // A login turned off edits nothing, even in the Executive board.
    await move("executive", "Treasurer");
    const [access] = await rows(
      "owner",
      "select person_id, updated_at from admins where user_id = $1",
      [member.user],
    );
    await rows(
      manager,
      "select public.set_access($1, true, false, false, $2)",
      [access.person_id, access.updated_at],
    );
    assert.equal(await canEdit(member), false, "login turned off");
    assert.equal(await edit(member), 0);
    // Nobody signed out can ask.
    await assert.rejects(rows("anon", "select public.can_edit_pages()"));
  } finally {
    await db.close();
  }
});

test("save_page_texts (dashboard polish): a page and the texts it shows in one step, or none", async () => {
  const { db, rows, admin, executive } = await setup();
  try {
    const board = await executive("board");
    const read = async () =>
      Object.fromEntries(
        (
          await rows(
            "owner",
            "select key, document, updated_at from page_texts where key in ('prayer', 'musallah')",
          )
        ).map((row) => [row.key, row]),
      ) as Record<
        "prayer" | "musallah",
        { document: Record<string, unknown>; updated_at: unknown }
      >;
    const save = async (
      actor: { user: string },
      keys: string[],
      documents: unknown[],
      versions: unknown[],
    ) =>
      (
        await rows(
          actor,
          "select public.save_page_texts($1, $2::jsonb[], $3::timestamptz[]) as result",
          [keys, documents.map((doc) => JSON.stringify(doc)), versions],
        )
      )[0].result;
    const before = await read();
    const marked = (key: "prayer" | "musallah", mark: string) => ({
      ...before[key].document,
      mark,
    });
    // One stale version: nothing changes, nothing is logged.
    assert.equal(
      await save(
        board,
        ["prayer", "musallah"],
        [marked("prayer", "a"), marked("musallah", "a")],
        [before.prayer.updated_at, "2000-01-01T00:00:00Z"],
      ),
      "conflict",
    );
    assert.deepEqual(await read(), before);
    // Outside the Executive board: refused whole, as RLS hides the rows.
    const general = await admin("general");
    assert.equal(
      await save(
        general,
        ["prayer", "musallah"],
        [marked("prayer", "b"), marked("musallah", "b")],
        [before.prayer.updated_at, before.musallah.updated_at],
      ),
      "conflict",
    );
    assert.deepEqual(await read(), before);
    assert.deepEqual(
      await rows(
        "owner",
        "select id from activity_log where area = 'page_texts'",
      ),
      [],
    );
    // Both current: both saved, each its own change in the log.
    assert.equal(
      await save(
        board,
        ["musallah", "prayer"],
        [marked("musallah", "c"), marked("prayer", "c")],
        [before.musallah.updated_at, before.prayer.updated_at],
      ),
      "ok",
    );
    const after = await read();
    assert.equal(after.prayer.document.mark, "c");
    assert.equal(after.musallah.document.mark, "c");
    assert.deepEqual(
      (
        await rows(
          "owner",
          "select record_id, actor from activity_log where area = 'page_texts' order by record_id",
        )
      ).map((row) => [row.record_id, row.actor]),
      [
        ["musallah", board.user],
        ["prayer", board.user],
      ],
    );
    // A text given twice, or none: refused before anything changes.
    await assert.rejects(
      save(
        board,
        ["prayer", "prayer"],
        [marked("prayer", "d"), marked("prayer", "e")],
        [after.prayer.updated_at, after.prayer.updated_at],
      ),
      (error: { code?: string }) => error.code === "22023",
    );
    await assert.rejects(
      save(board, [], [], []),
      (error: { code?: string }) => error.code === "22023",
    );
    await assert.rejects(
      rows(
        "anon",
        "select public.save_page_texts(array['faq'], array['{}'::jsonb], array[now()])",
      ),
    );
  } finally {
    await db.close();
  }
});

test("page texts: a photo a page names is public and kept; an unnamed one is neither", async () => {
  const { db, rows, executive } = await setup();
  try {
    const board = await executive("board");
    const [named, unnamed] = [photo(), photo()];
    for (const name of [named, unnamed])
      await rows(
        "owner",
        "insert into storage.objects (bucket_id, name) values ('community', $1)",
        [name],
      );
    // Deep in the document, as a list item's photo.
    await rows(
      board,
      `update page_texts set document = jsonb_set(document, '{features,0,image,src}', to_jsonb('/media/' || $1::text))
       where key = 'home'`,
      [named],
    );
    const shown = (
      await rows(
        "anon",
        "select name from storage.objects where bucket_id = 'community'",
      )
    ).map((row) => row.name);
    assert.deepEqual(
      [named, unnamed].map((name) => shown.includes(name)),
      [true, false],
    );
    const inUse = async (name: string) =>
      (
        await rows(board, "select public.community_file_in_use($1) as used", [
          name,
        ])
      )[0].used;
    assert.equal(await inUse(named), true);
    assert.equal(await inUse(unnamed), false);
    // A text that only mentions the name is not a photo.
    assert.equal(
      (
        await rows(
          "owner",
          "select public.page_text_names_file($1::jsonb, $2) as named",
          [JSON.stringify({ note: `/media/${unnamed}` }), unnamed],
        )
      )[0].named,
      false,
    );
  } finally {
    await db.close();
  }
});

test("an event's sign-up link: Google Forms only, checked for every row", async () => {
  const { db, rows, refused, executive } = await setup();
  try {
    const board = await executive("board");
    const insert =
      "insert into events (title, date, url) values ('Iftar', current_date + 3, $1)";
    await rows(board, insert, ["https://forms.gle/AbC123"]);
    await rows(board, insert, [
      "https://docs.google.com/forms/d/e/1FAIpQ/viewform",
    ]);
    await rows(board, insert, [""]);
    await refused(
      board,
      insert,
      ["https://example.com/signup"],
      "23514",
      "not Google Forms",
    );
    const [check] = await rows(
      "owner",
      "select convalidated from pg_constraint where conname = 'events_url_google_forms'",
    );
    // A clean database has no older rows to wait for: the rule holds for all of them.
    assert.equal(check.convalidated, true);
  } finally {
    await db.close();
  }
});

test("the sign-up forms list: the database refuses a link that is not a Google Form (D-25)", async () => {
  const { db, rows, refused, executive } = await setup();
  try {
    const board = await executive("board");
    const update = `update page_texts
      set document = jsonb_set(document, '{forms,volunteer,url}', to_jsonb($1::text))
      where key = 'forms' returning key`;
    assert.equal(
      (await rows(board, update, ["https://forms.gle/AbC123"])).length,
      1,
    );
    assert.equal(
      (await rows(board, update, [""])).length,
      1,
      "no link: closed",
    );
    await refused(
      board,
      update,
      ["https://example.com/form"],
      "23514",
      "not Google Forms",
    );
    await refused(
      board,
      update,
      ["https://docs.google.com/forms/../document/d/abc/edit"],
      "23514",
      "resolves to a Google Doc",
    );
    // Other pages may link anywhere secure.
    await rows(
      board,
      `update page_texts set document = jsonb_set(document, '{forms}', '{"x":{"url":"https://example.com"}}')
       where key = 'faq'`,
    );
  } finally {
    await db.close();
  }
});

test("the Google Forms rule: the app and the database agree", async () => {
  const db = await database();
  try {
    const cases: [string, boolean][] = [
      ["https://docs.google.com/forms/d/e/1FAIpQLSf/viewform", true],
      [
        "https://docs.google.com/forms/d/e/1FAIpQLSf/viewform?usp=sf_link",
        true,
      ],
      ["https://forms.gle/9ZuhdAz6PXKReYW58", true],
      ["http://forms.gle/9ZuhdAz6PXKReYW58", false],
      ["https://docs.google.com/document/d/abc/edit", false],
      ["https://docs.google.com.evil.test/forms/d/abc", false],
      ["https://user:pass@forms.gle/abc", false],
      ["https://forms.gle/", false],
      ["https://docs.google.com/forms/", false],
      ["https://forms.gle/abc def", false],
      ["https://evil.test/https://forms.gle/abc", false],
      // A browser resolves these to a page that is not a form.
      ["https://docs.google.com/forms/../document/d/abc/edit", false],
      ["https://docs.google.com/forms/%2E%2E/document/d/abc/edit", false],
      ["https://docs.google.com/forms/x/./../../document/d/abc", false],
      ["https://docs.google.com/forms/x\\..\\..\\document/d/abc", false],
      ["https://forms.gle/..", false],
      ["https://docs.google.com/forms/d/e/1FAIpQ.LSf/viewform", true],
    ];
    for (const [value, expected] of cases) {
      assert.equal(isGoogleFormUrl(value), expected, `app: ${value}`);
      const { rows } = await db.query<{ ok: boolean }>(
        "select public.is_google_form_url($1) as ok",
        [value],
      );
      assert.equal(rows[0].ok, expected, `database: ${value}`);
    }
    // The patterns in the schema are the shared ones.
    const migration = await readFile(
      new URL("202610150001_schema.sql", migrationsDir),
      "utf8",
    );
    assert.ok(migration.includes(`url ~ '${googleFormSqlPattern}'`));
    assert.ok(migration.includes(`url !~* '${googleFormSqlRefused}'`));
  } finally {
    await db.close();
  }
});

test("the verse library (Review 3 E): everyone reads it, nobody adds, changes or removes a verse", async () => {
  const { db, rows, refused, admin } = await setup();
  try {
    const board = await admin("board");
    const one =
      "select reference, surah_name, meaning from quran_verses where reference = '94:5'";
    for (const actor of ["anon", board] as const)
      assert.deepEqual(await rows(actor, one), [
        {
          reference: "94:5",
          surah_name: "Ash-Sharh",
          meaning: "For indeed, with hardship [will be] ease.",
        },
      ]);
    const insert =
      "insert into quran_verses (surah, ayah, surah_name, arabic, meaning) values (49, 10, 'Al-Hujuraat', 'إِنَّمَا', 'The believers')";
    for (const actor of ["anon", board] as const) {
      await refused(actor, insert, [], "42501", "adding a verse");
      await refused(
        actor,
        "update quran_verses set meaning = 'x' where reference = '94:5'",
        [],
        "42501",
        "changing a verse",
      );
      await refused(
        actor,
        "delete from quran_verses where reference = '94:5'",
        [],
        "42501",
        "removing a verse",
      );
    }
    // The reference follows the numbers; one row per verse.
    await refused(
      "owner",
      "insert into quran_verses (surah, ayah, surah_name, arabic, meaning) values (94, 5, 'Ash-Sharh', 'x', 'x')",
      [],
      "23505",
      "one row per verse",
    );
    await refused(
      "owner",
      "insert into quran_verses (surah, ayah, surah_name, arabic, meaning) values (115, 1, 'x', 'x', 'x')",
      [],
      "23514",
      "a surah over 114",
    );
    // Nothing about the library is logged: it never changes.
    assert.deepEqual(
      await rows(
        "owner",
        "select id from activity_log where area = 'quran_verses'",
      ),
      [],
    );
  } finally {
    await db.close();
  }
});

test("resources (review fixes PR-1): no link-less starter resources, the two “Archive” ones archived, not a board change", async () => {
  const { db, rows } = await setup();
  try {
    const [{ document }] = await rows(
      "anon",
      "select document from page_texts where key = 'resources'",
    );
    const items = (document as { items: { id: string; archived?: boolean }[] })
      .items;
    assert.deepEqual(
      items.map((item) => [item.id, item.archived === true]),
      [
        ["newsletter-april-2026", true],
        ["jumuah-guide", false],
        ["finding-the-musallah", false],
        ["community-events-archive", true],
      ],
    );
    // The newsletter's picture text no longer says "placeholder".
    const pictures = (
      document as { items: { id: string; image?: { alt: string } }[] }
    ).items.map((item) => [item.id, item.image?.alt]);
    assert.deepEqual(pictures[0], [
      "newsletter-april-2026",
      "MSA newsletter cover",
    ]);
    assert.ok(pictures.every(([, alt]) => !/placeholder/i.test(alt ?? "")));
    assert.deepEqual(
      await rows(
        "owner",
        "select * from activity_log where area = 'page_texts'",
      ),
      [],
    );
  } finally {
    await db.close();
  }
});

test("History restore (review 3 D): page text and prayer settings record which version a restore put back, in a new log entry; a save clears it", async () => {
  const { db, rows, executive } = await setup();
  try {
    // Pages are for the Executive board (review 3 B).
    const board = await executive("restorer");
    for (const [table, where] of [
      ["page_texts", "key = 'faq'"],
      ["prayer_settings", "id = 1"],
    ] as const) {
      // The starting row is dated, so History can say when it was.
      const [start] = await rows(
        "owner",
        `select updated_at, restored_from from ${table} where ${where}`,
      );
      assert.ok(start.updated_at instanceof Date, table);
      assert.equal(start.restored_from, null, table);
      const restoredFrom = "2026-10-05T18:14:00.000Z";
      const change =
        table === "page_texts"
          ? 'document = document || \'{"heading":"Restored"}\''
          : "notice = 'Restored'";
      await rows(
        board,
        `update ${table} set ${change}, restored_from = $1 where ${where}`,
        [restoredFrom],
      );
      const [entry] = await rows(
        "owner",
        `select action, before, after from activity_log where area = $1 order by id desc limit 1`,
        [table],
      );
      assert.equal(entry.action, "updated", table);
      assert.equal(
        (entry.before as Record<string, unknown>).restored_from,
        null,
        table,
      );
      assert.equal(
        Date.parse(
          String((entry.after as Record<string, unknown>).restored_from),
        ),
        Date.parse(restoredFrom),
        table,
      );
      // An ordinary save clears it again.
      await rows(
        board,
        `update ${table} set restored_from = null where ${where} returning 1`,
      );
      const [cleared] = await rows(
        "owner",
        `select restored_from from ${table} where ${where}`,
      );
      assert.equal(cleared.restored_from, null, table);
    }
  } finally {
    await db.close();
  }
});
