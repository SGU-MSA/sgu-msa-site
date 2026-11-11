import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { pageTextKeys } from "../src/lib/content/documents";
import { pageTextSaveSchema } from "../src/lib/content/page-fields";
import {
  demoHandoverSteps,
  demoListOptions,
  demoMerch,
  demoPaymentItems,
  demoPeople,
  demoRecords,
  demoSeasons,
  demoSections,
  demoSharedLogins,
} from "../src/lib/demo/fixtures";
import { resetDatabase } from "../scripts/staging-review/database";
import {
  PRESERVED_TABLES,
  PRODUCTION_PROJECT_REF,
  RESET_TABLES,
  STAGING_PROJECT_REF,
  checkTarget,
  databaseConfig,
  redact,
  resetInputSchema,
  reviewLogins,
  stagingSeedPlan,
  type ResetInput,
} from "../scripts/staging-review/plan";
import { ensureLogins } from "../scripts/staging-review/logins";
import { starterPageTexts } from "../scripts/starter-page-texts";
import { demoSeed } from "./support/demo-seed";

// The staging review-site reset (docs/contracts/staging-review-site.md): the pure plan and target
// guard, the database reset on PGlite with every migration, and the review-branch workflow.
const root = new URL("../", import.meta.url);
const dbPassword = "fake-db-password-1";
const secretKey = "sb_secret_test";
const stagingUrl = `https://${STAGING_PROJECT_REF}.supabase.co`;
const pooler = `postgresql://postgres.${STAGING_PROJECT_REF}:${dbPassword}@aws-0-us-west-2.pooler.supabase.com:5432/postgres`;
const direct = `postgresql://postgres:${dbPassword}@db.${STAGING_PROJECT_REF}.supabase.co:5432/postgres`;

const validInput = (): Record<string, unknown> => ({
  supabaseUrl: stagingUrl,
  secretKey,
  databaseUrl: pooler,
  databaseCaFile: "ca.pem",
  loginDomain: "sgu-msa.invalid",
  passwords: {
    president: "Fake-President-1!x",
    treasurer: "Fake-Treasurer-2!x",
    board: "Fake-Board-Member-3!x",
  },
});
const parsed = (patch: Record<string, unknown> = {}) =>
  resetInputSchema.safeParse({ ...validInput(), ...patch });
const input = (patch: Record<string, unknown> = {}): ResetInput => {
  const result = parsed(patch);
  assert.ok(result.success, JSON.stringify(result.error?.issues));
  return result.data;
};

test("starterPageTexts gives every key once and each passes the save rules", () => {
  const texts = starterPageTexts();
  assert.deepEqual(
    texts.map((text) => text.key),
    [...pageTextKeys],
  );
  for (const { key, document } of texts)
    assert.ok(pageTextSaveSchema(key).safeParse(document).success, key);
});

test("checkTarget accepts the staging pooler and direct addresses", () => {
  assert.deepEqual(checkTarget(input(), {}), { ok: true });
  assert.deepEqual(checkTarget(input({ databaseUrl: direct }), {}), {
    ok: true,
  });
  assert.deepEqual(checkTarget(input({ supabaseUrl: `${stagingUrl}/` }), {}), {
    ok: true,
  });
});

test("checkTarget refuses every other target without leaking secrets", () => {
  const prodPooler = pooler.replaceAll(
    STAGING_PROJECT_REF,
    PRODUCTION_PROJECT_REF,
  );
  const cases: [
    string,
    Partial<Record<string, unknown>>,
    { VERCEL_ENV?: string },
  ][] = [
    [
      "production ref in the Supabase URL",
      { supabaseUrl: `https://${PRODUCTION_PROJECT_REF}.supabase.co` },
      {},
    ],
    ["production ref in the database URL", { databaseUrl: prodPooler }, {}],
    [
      "another project",
      { supabaseUrl: "https://abcdefghijklmnopqrst.supabase.co" },
      {},
    ],
    [
      "http Supabase URL",
      { supabaseUrl: `http://${STAGING_PROJECT_REF}.supabase.co` },
      {},
    ],
    ["other host", { supabaseUrl: "https://example.invalid" }, {}],
    [
      "localhost",
      {
        databaseUrl: `postgresql://postgres:${dbPassword}@localhost:5432/postgres`,
      },
      {},
    ],
    [
      "loopback",
      {
        databaseUrl: `postgresql://postgres:${dbPassword}@127.0.0.1:5432/postgres`,
      },
      {},
    ],
    [
      "not postgres",
      {
        databaseUrl: `mysql://postgres:${dbPassword}@db.${STAGING_PROJECT_REF}.supabase.co/x`,
      },
      {},
    ],
    [
      "wrong user",
      {
        databaseUrl: `postgresql://admin:${dbPassword}@db.${STAGING_PROJECT_REF}.supabase.co/x`,
      },
      {},
    ],
    ["production environment", {}, { VERCEL_ENV: "production" }],
  ];
  for (const [label, patch, env] of cases) {
    const result = checkTarget(input(patch), env);
    assert.equal(result.ok, false, label);
    if (!result.ok) {
      const text = result.problems.join("\n");
      assert.ok(result.problems.length > 0, label);
      assert.ok(!text.includes(dbPassword), label);
      assert.ok(!text.includes(secretKey), label);
    }
  }
});

test("checkTarget refuses a database URL with options that could redirect or weaken it", () => {
  const encodedProd = PRODUCTION_PROJECT_REF.replace("t", "%74");
  for (const suffix of [
    `?host=db.${PRODUCTION_PROJECT_REF}.supabase.co`,
    `?host=db.${encodedProd}.supabase.co`,
    "?sslmode=disable",
    "?sslmode=no-verify",
    "?user=postgres",
    "#fragment",
  ]) {
    const result = checkTarget(
      input({ databaseUrl: `${direct}${suffix}` }),
      {},
    );
    assert.equal(result.ok, false, suffix);
    if (!result.ok)
      assert.ok(!result.problems.join("\n").includes(dbPassword), suffix);
  }
});

test("the pg config is built from the checked parts only", () => {
  for (const url of [pooler, direct]) {
    assert.deepEqual(checkTarget(input({ databaseUrl: url }), {}), {
      ok: true,
    });
    const config = databaseConfig(url, "CA");
    assert.equal(config.host, new URL(url).hostname);
    assert.equal(config.password, dbPassword);
    assert.equal(config.port, 5432);
    assert.equal(config.database, "postgres");
    assert.deepEqual(config.ssl, { ca: "CA", rejectUnauthorized: true });
    assert.ok(!("connectionString" in config));
  }
});

test("ensureLogins updates existing review logins and touches no other user", async () => {
  const calls: string[] = [];
  const users: { id: string; email: string }[] = [
    { id: "u-other", email: "someone@example.invalid" },
  ];
  const fake = {
    auth: {
      admin: {
        createUser: async ({ email }: { email: string }) => {
          calls.push(`create ${email}`);
          const user = { id: `u-${users.length}`, email };
          users.push(user);
          return { data: { user }, error: null };
        },
        updateUserById: async (id: string) => {
          calls.push(`update ${id}`);
          return { data: {}, error: null };
        },
      },
    },
  };
  const run = () =>
    ensureLogins(
      fake as never,
      users.map((u) => ({ ...u })),
      input(),
    );
  const first = await run();
  assert.equal(calls.filter((c) => c.startsWith("create")).length, 3);
  assert.ok(calls.every((c) => !c.includes("u-other")));
  calls.length = 0;
  const second = await run();
  assert.deepEqual(second, first);
  assert.equal(calls.filter((c) => c.startsWith("create")).length, 0);
  assert.equal(calls.length, 3);
  assert.ok(calls.every((c) => !c.includes("u-other")));
  const failing = {
    auth: {
      admin: {
        createUser: async () => ({ data: {}, error: { message: "boom" } }),
      },
    },
  };
  await assert.rejects(
    ensureLogins(failing as never, [], input()),
    /login failed: boom/,
  );
});

test("resetInputSchema refuses unsafe or malformed input", () => {
  assert.ok(parsed().success);
  const weak = { ...(validInput().passwords as object), president: "short" };
  assert.ok(!parsed({ passwords: weak }).success, "weak password");
  const same = {
    president: "Fake-Same-Pass-1!x",
    treasurer: "Fake-Same-Pass-1!x",
    board: "Fake-Board-Member-3!x",
  };
  assert.ok(!parsed({ passwords: same }).success, "equal passwords");
  assert.ok(parsed({ loginDomain: "review.example.invalid" }).success);
  for (const bad of [
    "a@b",
    "club@example.invalid",
    "a+b.invalid",
    "a b.invalid",
    "nodot",
    "Upper.invalid",
  ])
    assert.ok(!parsed({ loginDomain: bad }).success, bad);
  assert.ok(!parsed({ secretKey: "eyJhbGciOi" }).success, "key prefix");
  assert.ok(!parsed({ extra: 1 }).success, "unknown key");
  assert.ok(parsed({ go2payTestLinks: { sadaqah: "go2pay.gd/557" } }).success);
  assert.ok(
    !parsed({ go2payTestLinks: { nope: "go2pay.gd/557" } }).success,
    "slug",
  );
  assert.ok(
    !parsed({ go2payTestLinks: { sadaqah: "https://example.invalid/557" } })
      .success,
    "link",
  );
  assert.ok(
    !parsed({
      go2payTestLinks: { sadaqah: "go2pay.gd/557", iftar: "go2pay.gd/557" },
    }).success,
    "repeated product",
  );
  assert.ok(
    !parsed({ reviewDeployHook: "https://example.invalid/hook" }).success,
  );
  assert.ok(
    parsed({
      reviewDeployHook:
        "https://api.vercel.com/v1/integrations/deploy/prj_fake/hook",
    }).success,
  );
});

test("reviewLogins gives the three addresses with E-4's permissions", () => {
  assert.deepEqual(
    reviewLogins("sgu-msa.invalid").map((l) => [
      l.role,
      l.email,
      l.can_manage_people,
      l.can_manage_money,
    ]),
    [
      ["president", "president@sgu-msa.invalid", true, true],
      ["treasurer", "treasurer@sgu-msa.invalid", false, true],
      ["board", "board@sgu-msa.invalid", false, false],
    ],
  );
  const people = new Map(demoPeople().map((p) => [p.id, p]));
  assert.deepEqual(
    reviewLogins("example.invalid").map(
      (l) => people.get(l.personId)?.role_title,
    ),
    ["President", "Treasurer", "Secretary"],
  );
});

const accounts = {
  president: "11111111-1111-4111-8111-111111111111",
  treasurer: "22222222-2222-4222-8222-222222222222",
  board: "33333333-3333-4333-8333-333333333333",
};
const planFor = (now: Date, links: [string, number][] = []) =>
  stagingSeedPlan(now, accounts, new Map(links), starterPageTexts());

test("stagingSeedPlan follows the contract's order and fixture counts", () => {
  const now = new Date(demoSeed);
  const plan = planFor(now, [["sadaqah", 557]]);
  assert.deepEqual(
    plan.map((step) => step.table),
    RESET_TABLES.filter((table) => table !== "activity_log"),
  );
  const rows = (table: string) => plan.find((s) => s.table === table)!.rows;
  assert.equal(rows("list_options").length, demoListOptions().length);
  assert.equal(rows("people_sections").length, demoSections().length);
  assert.equal(rows("people").length, demoPeople().length);
  assert.equal(rows("admins").length, 3);
  assert.equal(rows("seasons").length, demoSeasons(now).length);
  assert.equal(
    rows("merch_collections").length,
    demoMerch().collections.length,
  );
  assert.equal(rows("merch_items").length, demoMerch().items.length);
  assert.equal(rows("events").length, demoRecords("events", now).length);
  assert.equal(
    rows("announcements").length,
    demoRecords("announcements", now).length,
  );
  assert.equal(
    rows("news_posts").length,
    demoRecords("news_posts", now).length,
  );
  assert.equal(
    rows("newsletters").length,
    demoRecords("newsletters", now).length,
  );
  assert.equal(rows("handover_steps").length, demoHandoverSteps(now).length);
  assert.equal(rows("shared_logins").length, demoSharedLogins(now).length);
  assert.equal(rows("page_texts").length, pageTextKeys.length);
  const items = demoPaymentItems(now);
  assert.equal(rows("payment_items").length, items.length);
  const sadaqah = items.find(({ item }) => item.slug === "sadaqah")!.item.id;
  assert.deepEqual(rows("payment_item_links"), [
    { go2pay_product_id: 557, payment_item_id: sadaqah },
  ]);
  const archived = items
    .filter(({ archived }) => archived)
    .map(({ item }) => item.id);
  assert.ok(archived.length > 0);
  for (const row of rows("payment_items"))
    assert.equal(Boolean(row.archived_at), archived.includes(String(row.id)));
  assert.deepEqual(
    planFor(now).find((s) => s.table === "payment_item_links")!.rows,
    [],
  );
  const fixtureProducts = new Set(items.map(({ product }) => product));
  for (const step of plan)
    for (const row of step.rows)
      if ("go2pay_product_id" in row)
        assert.ok(!fixtureProducts.has(Number(row.go2pay_product_id)));
  assert.throws(() => planFor(now, [["nope", 1]]));
  assert.ok(!JSON.stringify(plan).includes("9001"));
});

test("redact hides secrets and the database URL's password", () => {
  const text = `failed ${secretKey} at ${pooler} with ${dbPassword}`;
  const clean = redact(text, [secretKey, pooler, ""]);
  assert.ok(!clean.includes(secretKey));
  assert.ok(!clean.includes(dbPassword));
  assert.ok(clean.includes("[hidden]"));
});

// --- the database reset, on PGlite with every migration ----------------------------------

type Actor = "owner" | "anon" | { user: string };

async function database() {
  const db = new PGlite();
  await db.exec(
    await readFile(new URL("tests/database/supabase-stubs.sql", root), "utf8"),
  );
  const dir = new URL("supabase/migrations/", root);
  for (const name of (await readdir(dir)).sort())
    if (name.endsWith(".sql"))
      await db.exec(await readFile(new URL(name, dir), "utf8"));
  return db;
}
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
const rows = async (
  db: PGlite,
  actor: Actor,
  sql: string,
  params: unknown[] = [],
) =>
  within(
    db,
    actor,
    async (tx) => (await tx.query(sql, params)).rows,
  ) as Promise<Record<string, unknown>[]>;
const first = async (db: PGlite, actor: Actor, sql: string) =>
  Object.values((await rows(db, actor, sql))[0])[0];

const developer = "44444444-4444-4444-8444-444444444444";

async function withJunk(db: PGlite) {
  for (const [name, id] of [
    ["president", accounts.president],
    ["treasurer", accounts.treasurer],
    ["board", accounts.board],
    ["developer", developer],
  ])
    await rows(
      db,
      "owner",
      "insert into auth.users (id, email) values ($1, $2)",
      [id, `${name}@example.invalid`],
    );
  await rows(
    db,
    "owner",
    "insert into public.events (title, date) values ('Old junk', '2020-01-01')",
  );
  await rows(
    db,
    "owner",
    "insert into public.payment_items (slug, name, kind, category, position) values ('junk', 'Junk', 'fund', 'general', 1)",
  );
  await rows(
    db,
    "owner",
    "insert into public.payment_item_links (go2pay_product_id, payment_item_id) select 5, id from public.payment_items where slug = 'junk'",
  );
  await rows(
    db,
    "owner",
    "insert into public.warning_emails_sent values ('k', 'first', '2026-01-01')",
  );
  // A change by an admin so the activity log has an entry before the reset.
  await rows(
    db,
    "owner",
    "select public.owner_add_admin($1, 'Junk Admin', true)",
    [`developer@example.invalid`],
  );
}

const apply = (db: PGlite, plan: ReturnType<typeof planFor>) =>
  db.transaction((tx) => resetDatabase(tx, plan));

test("resetDatabase empties, re-seeds under the real rules and restores every trigger", async () => {
  const db = await database();
  try {
    await withJunk(db);
    assert.ok(
      Number(
        await first(db, "owner", "select count(*) from public.activity_log"),
      ) > 0,
    );
    const verses = await first(
      db,
      "owner",
      "select count(*) from public.quran_verses",
    );

    const tables = (
      await rows(
        db,
        "owner",
        "select tablename from pg_tables where schemaname = 'public'",
      )
    )
      .map((r) => String(r.tablename))
      .sort();
    assert.deepEqual([...RESET_TABLES, ...PRESERVED_TABLES].sort(), tables);

    const plan = planFor(new Date(), [["sadaqah", 557]]);
    const counts = await apply(db, plan);
    for (const step of plan)
      assert.equal(counts[step.table], step.rows.length, step.table);
    assert.equal(counts.activity_log, 0);
    assert.equal(
      await first(
        db,
        "owner",
        "select count(*) from public.events where title = 'Old junk'",
      ),
      0,
    );
    assert.equal(
      await first(
        db,
        "owner",
        "select count(*) from public.payment_item_links where go2pay_product_id = 5",
      ),
      0,
    );
    assert.equal(
      await first(db, "owner", "select count(*) from public.quran_verses"),
      verses,
    );
    assert.equal(
      await first(
        db,
        "owner",
        "select count(*) from public.warning_emails_sent",
      ),
      1,
    );
    assert.equal(
      await first(
        db,
        "owner",
        `select count(*) from auth.users where id = '${developer}'`,
      ),
      1,
    );

    const expected = {
      president: [true, true],
      treasurer: [false, true],
      board: [false, false],
    };
    for (const [role, [people, money]] of Object.entries(expected)) {
      const actor = { user: accounts[role as keyof typeof accounts] };
      assert.equal(
        await first(db, actor, "select public.can_manage_people()"),
        people,
        role,
      );
      assert.equal(
        await first(db, actor, "select public.can_manage_money()"),
        money,
        role,
      );
      assert.equal(
        await first(db, actor, "select public.can_edit_pages()"),
        true,
        role,
      );
    }

    const published = demoRecords("events", new Date()).filter(
      (e) => e.published,
    ).length;
    assert.equal(
      await first(db, "anon", "select count(*) from public.events"),
      published,
    );
    assert.equal(published, 9);
    assert.equal(
      await first(
        db,
        "anon",
        "select count(*) from public.announcements where urgent_until is not null",
      ),
      2,
    );

    // Triggers are back: a later board edit is logged, the log is add-only again.
    await rows(
      db,
      { user: accounts.president },
      "update public.list_options set name = 'Social events' where slug = 'social'",
    );
    assert.equal(
      await first(db, "owner", "select count(*) from public.activity_log"),
      1,
    );
    await assert.rejects(
      rows(db, "owner", "delete from public.activity_log"),
      (e: { code?: string }) => e.code === "SGU05",
    );

    // Running twice gives the same content.
    const again = await apply(db, planFor(new Date(), [["sadaqah", 557]]));
    assert.deepEqual(again, counts);
  } finally {
    await db.close();
  }
});

test("a broken row rolls the whole reset back and leaves every trigger enabled", async () => {
  const db = await database();
  try {
    await withJunk(db);
    const logged = await first(
      db,
      "owner",
      "select count(*) from public.activity_log",
    );
    assert.ok(Number(logged) > 0);
    const plan = planFor(new Date());
    const events = plan.find((step) => step.table === "events")!;
    events.rows[0] = { ...events.rows[0], start_time: "25:99" };
    await assert.rejects(apply(db, plan));
    assert.equal(
      await first(
        db,
        "owner",
        "select count(*) from public.events where title = 'Old junk'",
      ),
      1,
    );
    assert.equal(
      await first(db, "owner", "select count(*) from public.activity_log"),
      logged,
    );
    assert.equal(
      await first(
        db,
        "owner",
        "select count(*) from pg_trigger where not tgisinternal and tgenabled <> 'O'",
      ),
      0,
    );
  } finally {
    await db.close();
  }
});

test("the review-branch workflow only mirrors main to the review branch", async () => {
  const text = await readFile(
    new URL(".github/workflows/review-branch.yml", root),
    "utf8",
  );
  assert.match(text, /on:\s*\n\s+push:\s*\n\s+branches: \[main\]/);
  assert.ok(!text.includes("pull_request"));
  assert.match(text, /permissions:\s*\n\s+contents: write/);
  assert.equal(
    [...text.matchAll(/^\s+[a-z-]+: (read|write|none)$/gm)].length,
    1,
  );
  const pushes = text.split("\n").filter((line) => line.includes("git push"));
  assert.deepEqual(
    pushes.map((line) => line.trim()),
    ["- run: git push --force origin origin/main:refs/heads/review"],
  );
  assert.ok(!text.includes("secrets."));
  assert.ok(!text.includes("github.event"));
});
