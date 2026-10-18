import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// Daily check WP-2 (docs/contracts/daily-check-notifications.md): every migration in order on an
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

/** One statement as a PostgREST role ("service_role" = the server's secret key). */
async function as(
  db: PGlite,
  role: "anon" | "authenticated" | "service_role",
  sql: string,
  params: unknown[] = [],
) {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('role', $1, true)", [role]);
    return (await tx.query(sql, params)).rows;
  });
}

test("warning_emails_sent: only the secret key reads and adds rows (ADR 0022)", async () => {
  const db = await database();
  const insert =
    "insert into public.warning_emails_sent (warning_key, step, emailed_on) values ($1, $2, $3)";
  for (const role of ["anon", "authenticated"] as const) {
    await assert.rejects(
      as(db, role, "select * from public.warning_emails_sent"),
      (error: { code?: string }) => error.code === "42501",
      `${role} must not read`,
    );
    await assert.rejects(
      as(db, role, insert, ["iqamah:2026-10-15", "first", "2026-10-08"]),
      (error: { code?: string }) => error.code === "42501",
      `${role} must not insert`,
    );
  }
  await as(db, "service_role", insert, [
    "iqamah:2026-10-15",
    "first",
    "2026-10-08",
  ]);
  assert.deepEqual(
    await as(
      db,
      "service_role",
      "select warning_key, step, emailed_on::text as on from public.warning_emails_sent",
    ),
    [{ warning_key: "iqamah:2026-10-15", step: "first", on: "2026-10-08" }],
  );
  // RLS is on with no policies: even a grant would show nothing to the API roles.
  const [{ relrowsecurity }] = (
    await db.query<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class where oid = 'public.warning_emails_sent'::regclass",
    )
  ).rows;
  assert.equal(relrowsecurity, true);
  const policies = await db.query(
    "select 1 from pg_policies where tablename = 'warning_emails_sent'",
  );
  assert.equal(policies.rows.length, 0);
});

test("warning_emails_sent: one row per warning and step, known steps only", async () => {
  const db = await database();
  const insert = (key: string, step: string) =>
    db.query(
      "insert into public.warning_emails_sent (warning_key, step, emailed_on) values ($1, $2, '2026-10-08')",
      [key, step],
    );
  await insert("iqamah:2026-10-15", "first");
  await insert("iqamah:2026-10-15", "last_call");
  await assert.rejects(
    insert("iqamah:2026-10-15", "first"),
    (error: { code?: string }) => error.code === "23505",
  );
  for (const [key, step] of [
    ["iqamah:2026-10-15", "second"],
    ["", "first"],
    ["x".repeat(201), "first"],
  ])
    await assert.rejects(
      insert(key, step),
      (error: { code?: string }) => error.code === "23514",
      `${key.slice(0, 10)} ${step}`,
    );
});

test("community_storage_bytes: one number of the files' space, for visitors and the nightly check too", async () => {
  const db = await database();
  const bytes = async (role: "anon" | "authenticated") =>
    Number(
      (
        (await as(
          db,
          role,
          "select public.community_storage_bytes() as bytes",
        )) as { bytes: unknown }[]
      )[0].bytes,
    );
  assert.equal(await bytes("anon"), 0, "no files yet");
  await db.query(
    `insert into storage.objects (bucket_id, name, metadata) values
       ('community', $1, '{"size": 1500}'), ('community', $2, '{"size": 2500}'), ('community', $3, null)`,
    [
      "11111111-1111-4111-8111-111111111111.webp",
      "22222222-2222-4222-8222-222222222222.pdf",
      "33333333-3333-4333-8333-333333333333.webp",
    ],
  );
  // Visitors cannot list the files themselves (only published ones), yet read the total.
  assert.equal(await bytes("anon"), 4000);
  assert.equal(await bytes("authenticated"), 4000);
  await assert.rejects(
    as(db, "service_role", "select public.community_storage_bytes()"),
    (error: { code?: string }) => error.code === "42501",
  );
});
