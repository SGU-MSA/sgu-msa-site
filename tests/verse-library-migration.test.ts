import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { load } from "js-yaml";
import { reminderPlaces } from "../src/lib/content/schemas";
import library from "../src/lib/quran/verse-library.json";
import { plainArabic } from "../src/lib/quran/search";
import { arabicEmEstimate, fitsOneLine } from "../src/shared/ui/arabicFit";

// Review fixes PR-3 (2026-10-05: one musallah room) and Review 3 E (2026-10-06: the fixed verse
// library, supabase/migrations/202610150003_quran_verses.sql): every migration in order on an isolated
// PostgreSQL engine with the Supabase stand-ins of `npm run test:db`.
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
function rowsOf(db: PGlite) {
  return (actor: Actor, sql: string, params: unknown[] = []) =>
    db.transaction(async (tx: Transaction) => {
      if (actor !== "owner") {
        const role = actor === "anon" ? "anon" : "authenticated";
        const claims = actor === "anon" ? { role } : { role, sub: actor.user };
        await tx.query(
          "select set_config('role', $1, true), set_config('request.jwt.claims', $2, true)",
          [role, JSON.stringify(claims)],
        );
      }
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

const refusedWith = (work: Promise<unknown>, code: string, label: string) =>
  assert.rejects(work, (error: { code?: string }) => {
    assert.equal(error.code, code, label);
    return true;
  });

test("one musallah room: no weekly room, and a changed Friday holds only its prayers' two times", async () => {
  const db = await database();
  const rows = rowsOf(db);
  try {
    const [settings] = await rows(
      "owner",
      "select * from prayer_settings where id = 1",
    );
    assert.equal("jummah_location" in settings, false, "the weekly room");

    const board = await boardMember(db);
    const save = (list: unknown[]) =>
      rows(board, "update prayer_settings set exceptions = $1::jsonb", [
        JSON.stringify(list),
      ]);
    const changed = {
      date: "2026-10-23",
      reason: "Speaker",
      iqamah: {},
      // That Friday's own prayers (review fixes P2, 202610160001).
      jumuah: {
        change: "changed",
        sessions: [{ khutbah: "13:15", iqamah: "13:30" }],
      },
    };
    await save([changed]);
    await refusedWith(
      save([{ ...changed, jumuah: { ...changed.jumuah, location: "Hall" } }]),
      "23514",
      "a room on a changed Friday",
    );
    await refusedWith(
      save([
        {
          ...changed,
          jumuah: {
            change: "changed",
            sessions: [{ khutbah: "13:15", iqamah: "13:30", location: "Hall" }],
          },
        },
      ]),
      "23514",
      "a room on a changed Friday's prayer",
    );
    await refusedWith(
      save([
        {
          ...changed,
          jumuah: { change: "changed", sessions: [{ khutbah: "13:15" }] },
        },
      ]),
      "23514",
      "a changed Friday without its iqamah",
    );
    await refusedWith(
      save([{ ...changed, date: "2026-10-22" }]),
      "23514",
      "a Jumu'ah change on a Thursday",
    );
  } finally {
    await db.close();
  }
});

test("the verse library: every verse of verse-library.json, exactly, and nothing else", async () => {
  const db = await database();
  const rows = rowsOf(db);
  try {
    const stored = await rows(
      "anon",
      "select surah, ayah, reference, surah_name, arabic, meaning from quran_verses order by surah, ayah",
    );
    assert.equal(stored.length, library.verses.length);
    assert.deepEqual(
      stored,
      library.verses.map((verse) => ({
        surah: verse.surah,
        ayah: verse.ayah,
        reference: `${verse.surah}:${verse.ayah}`,
        surah_name: library.surahs[verse.surah - 1],
        arabic: verse.arabic,
        meaning: verse.meaning,
      })),
    );
  } finally {
    await db.close();
  }
});

test("the verse library: whole verses that fit one line, the basmala left out, in Qur'an order", () => {
  assert.equal(library.surahs.length, 114);
  assert.equal(library.verses.length, 1655);
  let previous = 0;
  for (const verse of library.verses) {
    const reference = `${verse.surah}:${verse.ayah}`;
    assert.ok(fitsOneLine(arabicEmEstimate(verse.arabic)), reference);
    assert.ok(verse.arabic.trim() && verse.meaning.trim(), reference);
    assert.doesNotMatch(verse.arabic, /^\uFEFF/, reference);
    const order = verse.surah * 1000 + verse.ayah;
    assert.ok(order > previous, `${reference} in order`);
    previous = order;
  }
  const find = (reference: string) =>
    library.verses.find(
      (verse) => `${verse.surah}:${verse.ayah}` === reference,
    );
  // 112:1 without the basmala the service puts before it; 1:1 is the basmala.
  assert.equal(plainArabic(find("112:1")!.arabic), "قل هو الله احد");
  assert.equal(plainArabic(find("1:1")!.arabic), "بسم الله الرحمن الرحيم");
  // A verse too long for one line is not in the library.
  assert.equal(find("2:255"), undefined);
});

test("the starting “Verse on each page”: every place names a library verse (YAML and migration alike)", async () => {
  const db = await database();
  const rows = rowsOf(db);
  try {
    const yaml = load(
      await readFile(new URL("content/reminder-places.yaml", root), "utf8"),
    ) as { places: Record<string, string> };
    const [seeded] = await rows(
      "anon",
      "select document from page_texts where key = 'reminder-places'",
    );
    assert.deepEqual(seeded.document, yaml);
    assert.deepEqual(
      Object.keys(yaml.places).sort(),
      [...reminderPlaces].sort(),
    );
    for (const reference of Object.values(yaml.places)) {
      const found = await rows(
        "anon",
        "select reference from quran_verses where reference = $1",
        [reference],
      );
      assert.equal(found.length, 1, `${reference} is in the library`);
    }
  } finally {
    await db.close();
  }
});
