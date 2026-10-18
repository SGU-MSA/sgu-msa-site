// Backend checks. Local only: they refuse any database or API that is not on this computer.
//
//   database  SQL-level checks of supabase/migrations on an empty throwaway database: RLS, the access
//             guard and its two-connection race, the add-only activity log, archive, storage and the
//             public team list. `npm run test:db` starts the database (compose.test.yaml), runs this
//             suite and removes the database (PR3 contract, D-17, D-18).
//   stack     real Auth, PostgREST and Storage on a fresh `npx supabase start` (`npm run test:backend`).
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import pg from "pg";
import { createSupabaseAccountInviter } from "../src/lib/backend/providers/supabase-inviter";
import { createSupabaseWarningLedger } from "../src/lib/backend/providers/supabase-ledger";
import { localDate } from "../src/lib/community/schema";

const migrationsDir = new URL("../supabase/migrations/", import.meta.url);

function localDatabaseUrl() {
  const url = process.env.SUPABASE_TEST_DB_URL;
  if (!url)
    throw new Error(
      "SUPABASE_TEST_DB_URL is missing. `npm run test:db` sets it for its throwaway database.",
    );
  if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname))
    throw new Error(
      "Backend tests only run against a database on this computer (127.0.0.1 or localhost).",
    );
  return url;
}

type Actor = "owner" | "anon" | "service_role" | { user: string };
type Account = { id: string; email: string };
type Admin = Account & { person: string };

// Runs one transaction as the given actor, the way PostgREST does: role plus JWT claims. "owner" is
// the migration owner, like the Supabase SQL editor.
async function within<T>(
  db: pg.Client,
  actor: Actor,
  work: () => Promise<T>,
): Promise<T> {
  await db.query("begin");
  try {
    if (actor !== "owner") {
      const role = typeof actor === "string" ? actor : "authenticated";
      const claims =
        typeof actor === "string" ? { role } : { role, sub: actor.user };
      await db.query(
        "select set_config('role', $1, true), set_config('request.jwt.claims', $2, true)",
        [role, JSON.stringify(claims)],
      );
    }
    const result = await work();
    await db.query("commit");
    return result;
  } catch (error) {
    await db.query("rollback");
    throw error;
  }
}

async function databaseSuite() {
  const url = localDatabaseUrl();
  const db = new pg.Client({ connectionString: url });
  await db.connect();
  const run = (actor: Actor, text: string, params: unknown[] = []) =>
    within(db, actor, () => db.query(text, params));
  const rows = async (actor: Actor, text: string, params: unknown[] = []) =>
    (await run(actor, text, params)).rows;
  const value = async (actor: Actor, text: string, params: unknown[] = []) =>
    Object.values((await rows(actor, text, params))[0])[0];
  const refused = (
    actor: Actor,
    text: string,
    params: unknown[],
    code: string,
  ) =>
    assert.rejects(run(actor, text, params), (error: { code?: string }) => {
      assert.equal(error.code, code, `${text} should fail with ${code}`);
      return true;
    });
  const as = (account: Account): Actor => ({ user: account.id });
  const step = async (name: string, check: () => Promise<void>) => {
    await check();
    console.log(`ok - ${name}`);
  };

  const account = async (label: string): Promise<Account> => {
    const id = randomUUID();
    const email = `${label}-${id.slice(0, 8)}@example.invalid`;
    await run("owner", "insert into auth.users (id, email) values ($1, $2)", [
      id,
      email,
    ]);
    return { id, email };
  };
  const admin = async (name: string, managePeople: boolean): Promise<Admin> => {
    const login = await account(name.toLowerCase().replace(/\W+/g, "-"));
    await run("owner", "select public.owner_add_admin($1, $2, $3)", [
      login.email,
      name,
      managePeople,
    ]);
    const person = await value(
      "owner",
      "select person_id from public.admins where user_id = $1",
      [login.id],
    );
    return { ...login, person: String(person) };
  };
  // Access versions travel as text: a JS Date would drop the microseconds of updated_at.
  const accessVersion = async (target: Admin) =>
    String(
      await value(
        "owner",
        "select updated_at::text from public.admins where person_id = $1",
        [target.person],
      ),
    );
  const setAccess = async (
    actor: Admin,
    target: Admin,
    managePeople: boolean,
    manageMoney: boolean,
    active: boolean,
    version?: string,
  ) =>
    value(as(actor), "select public.set_access($1, $2, $3, $4, $5)", [
      target.person,
      managePeople,
      manageMoney,
      active,
      version ?? (await accessVersion(target)),
    ]);
  const managers = async () =>
    (
      await rows(
        "owner",
        "select user_id from public.admins where can_manage_people and deactivated_at is null",
      )
    ).map((row) => row.user_id);
  const lastLogId = async () =>
    Number(
      await value(
        "owner",
        "select coalesce(max(id), 0) from public.activity_log",
      ),
    );
  const logSince = async (id: number) =>
    rows(
      "owner",
      "select actor, area, record_id, action, before, after, highlight from public.activity_log where id > $1 order by id",
      [id],
    );
  const sessions = async (user: Account) =>
    Number(
      await value(
        "owner",
        "select count(*) from auth.sessions where user_id = $1",
        [user.id],
      ),
    );

  try {
    const [state] = await rows(
      "owner",
      `select to_regclass('public.admins') is null as empty,
        to_regclass('auth.users') is not null and to_regclass('auth.sessions') is not null
        and to_regclass('storage.objects') is not null as supabase`,
    );
    assert.ok(
      state.empty,
      "Database tests need an empty database: `npm run test:db` starts a fresh one.",
    );
    assert.ok(
      state.supabase,
      "The database needs Supabase's auth and storage schemas (compose.test.yaml provides stand-ins).",
    );

    const migrations = (await readdir(migrationsDir))
      .filter((name) => name.endsWith(".sql"))
      .sort();
    const apply = async (name: string) => {
      const sql = await readFile(new URL(name, migrationsDir), "utf8");
      await run("owner", sql);
    };
    for (const name of migrations) await apply(name);
    console.log(`ok - applied ${migrations.length} migrations in order`);

    // The first admin of a new database, added by the site owner in the SQL editor (release checklist).
    const firstAdmin = await admin("Testname First", true);

    await step(
      "the first admin gets manage people and a hidden Executive board entry, as President",
      async () => {
        const [backfilled] = await rows(
          "owner",
          `select a.can_manage_people, a.can_manage_money, a.deactivated_at, p.full_name,
            p.role_title, p.show_on_public, s.name as section
          from public.admins a join public.people p on p.id = a.person_id
          join public.people_sections s on s.id = p.section_id where a.user_id = $1`,
          [firstAdmin.id],
        );
        assert.deepEqual(backfilled, {
          can_manage_people: true,
          can_manage_money: false,
          deactivated_at: null,
          full_name: "Testname First",
          role_title: "President",
          show_on_public: false,
          // "Manage people" is for the Executive board only (2026-10-06).
          section: "Executive board",
        });
        assert.deepEqual(
          await rows(
            "owner",
            "select name, position, shown_by_default from public.people_sections order by position",
          ),
          [
            // New people start shown in every group (review fixes P4).
            { name: "Executive board", position: 1, shown_by_default: true },
            { name: "General board", position: 2, shown_by_default: true },
            { name: "Advisors/Faculty", position: 3, shown_by_default: true },
          ],
        );
        const stranger = await account("stranger");
        await refused(
          "owner",
          "insert into public.admins (user_id) values ($1)",
          [stranger.id],
          "23502",
        );
      },
    );

    const alpha = await admin("Testname Alpha", true);
    const bravo = await admin("Testname Bravo", true);
    const member = await admin("Testname Member", false);
    const outsider = await account("outsider");
    // The site owner deactivates the first admin from the SQL editor (logged with no actor).
    await run(
      "owner",
      "update public.admins set deactivated_at = now() where user_id = $1",
      [firstAdmin.id],
    );
    const board = String(
      await value(
        "owner",
        // Any role title goes in the General board (review 2).
        "select id from public.people_sections where kind = 'general'",
      ),
    );

    await step("owner_add_admin works from the SQL editor only", async () => {
      for (const actor of ["anon", "service_role", as(alpha)] as Actor[])
        await refused(
          actor,
          "select public.owner_add_admin($1, 'Someone', true)",
          [outsider.email],
          "42501",
        );
      await assert.rejects(
        run("owner", "select public.owner_add_admin($1, 'Someone', true)", [
          "nobody@example.invalid",
        ]),
        /No Supabase Auth user/,
      );
      await assert.rejects(
        run("owner", "select public.owner_add_admin($1, 'Someone', true)", [
          alpha.email,
        ]),
        /already an admin/,
      );
    });

    const draft = String(
      await value(
        "owner",
        "insert into public.events (title, date) values ('Draft event', current_date) returning id",
      ),
    );
    const access = [bravo.person, false, false, true, "2000-01-01"];
    const grant = [bravo.person, outsider.email, false, false];

    await step("anonymous visitors are refused everywhere", async () => {
      for (const table of [
        "people",
        "people_sections",
        "admins",
        "activity_log",
      ])
        await refused("anon", `select * from public.${table}`, [], "42501");
      await refused(
        "anon",
        "select * from public.admin_accounts()",
        [],
        "42501",
      );
      await refused(
        "anon",
        "select public.set_access($1, $2, $3, $4, $5)",
        access,
        "42501",
      );
      await refused(
        "anon",
        "select public.grant_access($1, $2, $3, $4)",
        grant,
        "42501",
      );
      await refused(
        "anon",
        "insert into public.events (title, date) values ('Denied', current_date)",
        [],
        "42501",
      );
      assert.equal(
        (
          await run("anon", "select id from public.events where id = $1", [
            draft,
          ])
        ).rowCount,
        0,
      );
      await refused(
        "anon",
        "insert into storage.objects (bucket_id, name) values ('community', $1)",
        [`${randomUUID()}.pdf`],
        "42501",
      );
    });

    for (const [label, who] of [
      ["a signed-in outsider", outsider],
      ["a deactivated admin", firstAdmin],
    ] as const)
      await step(`${label} is refused everywhere`, async () => {
        const actor = as(who);
        for (const table of ["people", "people_sections", "activity_log"])
          assert.equal(
            (await run(actor, `select * from public.${table}`)).rowCount,
            0,
          );
        assert.deepEqual(
          (await rows(actor, "select user_id from public.admins")).map(
            (row) => row.user_id,
          ),
          who === firstAdmin ? [firstAdmin.id] : [],
          "only their own membership row is visible",
        );
        assert.equal(
          (await run(actor, "select * from public.admin_accounts()")).rowCount,
          0,
        );
        assert.equal(
          await value(
            actor,
            "select public.set_access($1, $2, $3, $4, $5)",
            access,
          ),
          "forbidden",
        );
        assert.equal(
          await value(
            actor,
            "select public.grant_access($1, $2, $3, $4)",
            grant,
          ),
          "forbidden",
        );
        await refused(
          actor,
          "insert into public.people (full_name, section_id, position, show_on_public) values ('Denied', $1, 1, false)",
          [board],
          "42501",
        );
        await refused(
          actor,
          "insert into public.people_sections (name, position) values ('Denied', 9)",
          [],
          "42501",
        );
        assert.equal(
          (await run(actor, "update public.people set role_title = 'Denied'"))
            .rowCount,
          0,
        );
        await refused(
          actor,
          "insert into public.events (title, date) values ('Denied', current_date)",
          [],
          "42501",
        );
        assert.equal(
          (
            await run(
              actor,
              "update public.events set title = 'Denied' where id = $1",
              [draft],
            )
          ).rowCount,
          0,
        );
        await refused(
          actor,
          "insert into storage.objects (bucket_id, name) values ('community', $1)",
          [`${randomUUID()}.pdf`],
          "42501",
        );
      });

    await step(
      "admins without manage people cannot change access (D-8)",
      async () => {
        assert.equal(
          await setAccess(member, bravo, false, false, true),
          "forbidden",
        );
        assert.equal(
          await value(
            as(member),
            "select public.grant_access($1, $2, $3, $4)",
            grant,
          ),
          "forbidden",
        );
        await refused(
          as(alpha),
          "update public.admins set can_manage_money = true where user_id = $1",
          [member.id],
          "42501",
        );
        const accounts = await rows(
          as(member),
          "select email from public.admin_accounts()",
        );
        assert.equal(accounts.length, 4, "every admin can read the logins");
      },
    );

    const person = (fields: string, values: unknown[]) =>
      value(
        as(member),
        `insert into public.people (${fields}) values (${values.map((_, i) => `$${i + 1}`).join(", ")}) returning id`,
        values,
      ).then(String);
    const executiveGroup = async () =>
      String(
        await value(
          "owner",
          "select id from public.people_sections where kind = 'executive'",
        ),
      );
    // Photos are for the Executive board only (review fixes P4). The
    // pictured entry is the first admin's (the President); another pictured
    // test entry takes the President role while `pictured` is archived.
    const pictureExecutive = async (fullName: string, photoName: string) =>
      value(
        as(alpha),
        "insert into public.people (full_name, section_id, position, show_on_public, role_title, photo_path) values ($1, $2, 9, false, 'President', $3) returning id",
        [fullName, await executiveGroup(), photoName],
      ).then(String);
    const withPresidentFree = async (body: () => Promise<void>) => {
      const archive = "update public.people set archived_at = $2 where id = $1";
      await run(as(member), archive, [pictured, new Date().toISOString()]);
      try {
        await body();
      } finally {
        await run(as(member), archive, [pictured, null]);
      }
    };
    const photo = `${randomUUID()}.webp`;
    let listed = "";
    let hidden = "";
    let pictured = "";

    await step(
      "People rules are enforced by the database: an answer, a photo name, the Executive board's roles",
      async () => {
        const base = "full_name, section_id, position";
        await refused(
          as(member),
          `insert into public.people (${base}) values ('Testname Unanswered', $1, 1)`,
          [board],
          "23502",
        );
        await assert.rejects(
          person(`${base}, show_on_public, photo_path`, [
            "Testname Badphoto",
            board,
            1,
            false,
            "photo.jpg",
          ]),
          // Outside the Executive board any photo is refused first (SGU40,
          // review fixes P4); a bad name is refused by the check either way.
          { code: /^(23514|SGU40)$/ },
        );
        const executive = String(
          await value(
            "owner",
            "select id from public.people_sections where kind = 'executive'",
          ),
        );
        await refused(
          as(alpha),
          `insert into public.people (${base}, role_title, show_on_public) values ('Testname Nobadge', $1, 1, 'Events lead', true)`,
          [executive],
          "SGU12",
        );
        // Only "manage people" adds someone to the Executive board (2026-10-06).
        await assert.rejects(
          person(`${base}, role_title, show_on_public`, [
            "Testname Newexec",
            executive,
            1,
            "Treasurer",
            true,
          ]),
          { code: "SGU15" },
        );
        // Listed and pictured with no consent record (review 2).
        listed = await person(`${base}, role_title, show_on_public`, [
          "Testname Listed",
          board,
          2,
          "",
          true,
        ]);
        hidden = await person(`${base}, show_on_public`, [
          "Testname Hidden",
          board,
          3,
          false,
        ]);
        // A photo outside the Executive board is refused (review fixes P4).
        await assert.rejects(
          person(`${base}, show_on_public, photo_path`, [
            "Testname Outside",
            board,
            4,
            true,
            photo,
          ]),
          { code: "SGU40" },
        );
        pictured = firstAdmin.person;
        await run(
          as(member),
          "update public.people set photo_path = $1, show_on_public = true where id = $2",
          [photo, pictured],
        );
      },
    );

    await step(
      "one current person per Executive board role (2026-10-06); save_person_taking_role hands it over in one step, logged",
      async () => {
        const [executive, general] = await Promise.all(
          ["executive", "general"].map(async (kind) =>
            String(
              await value(
                "owner",
                "select id from public.people_sections where kind = $1",
                [kind],
              ),
            ),
          ),
        );
        const insert = (
          actor: Actor,
          name: string,
          role: string,
          group: string,
        ) =>
          value(
            actor,
            "insert into public.people (full_name, role_title, section_id, position, show_on_public) values ($1, $2, $3, 1, false) returning id",
            [name, role, group],
          ).then(String);
        const entry = async (id: string) =>
          (
            await rows(
              "owner",
              "select full_name, role_title, section_id, position, archived_at, updated_at::text as version from public.people where id = $1",
              [id],
            )
          )[0];
        const holder = await insert(
          as(alpha),
          "Testname Holder",
          "Secretary",
          executive,
        );
        await assert.rejects(
          insert(as(alpha), "Testname Second", "Secretary", executive),
          { code: "SGU17" },
        );
        // Other groups take any title, as often as they like.
        await insert(as(alpha), "Testname Title one", "Secretary", general);
        await insert(as(alpha), "Testname Title two", "Secretary", general);
        // Moving someone into the taken role is refused too.
        await refused(
          as(alpha),
          "update public.people set section_id = $1, role_title = 'Secretary' where id = $2",
          [executive, hidden],
          "SGU17",
        );

        const before = await entry(holder);
        const newcomer = randomUUID();
        const take = (
          actor: Actor,
          version: string | null,
          holderVersion: string,
          person: string = newcomer,
        ) =>
          value(
            actor,
            "select public.save_person_taking_role($1, $2, $3, $4)",
            [
              JSON.stringify({
                id: person,
                full_name: "Testname Newcomer",
                role_title: "Secretary",
                section_id: executive,
                position: 7,
                show_on_public: false,
                photo_path: "",
              }),
              version,
              holder,
              holderVersion,
            ],
          );
        // Only "manage people" holders; stale screens change nothing.
        assert.equal(await take(as(member), null, before.version), "forbidden");
        assert.equal(
          await take(as(outsider), null, before.version),
          "forbidden",
        );
        assert.equal(
          await take(as(alpha), null, "2000-01-01 00:00:00+00"),
          "conflict",
        );
        assert.equal(
          await take(
            as(alpha),
            "2000-01-01 00:00:00+00",
            before.version,
            hidden,
          ),
          "conflict",
          "the entry changed: the holder stays too",
        );
        assert.deepEqual(await entry(holder), before);

        const since = await lastLogId();
        assert.equal(await take(as(alpha), null, before.version), "ok");
        const moved = await entry(holder);
        assert.equal(moved.section_id, general);
        assert.equal(moved.role_title, "");
        assert.equal(moved.archived_at, null, "nobody is deleted");
        assert.equal(
          moved.position,
          await value(
            "owner",
            "select max(position) from public.people where section_id = $1",
            [general],
          ),
          "last in the General board",
        );
        assert.equal((await entry(newcomer)).role_title, "Secretary");
        const logged = await logSince(since);
        assert.deepEqual(
          logged.map((row) => [row.actor, row.record_id, row.action]),
          [
            [alpha.id, holder, "updated"],
            [alpha.id, newcomer, "created"],
          ],
        );
        // The handed-over role cannot be taken back by a stale screen.
        assert.equal(await take(as(alpha), null, moved.version), "conflict");

        // Moving the holder out turns off their "manage people" (the access
        // guard): nobody hands away their own role while they hold it.
        const [own] = await rows(
          "owner",
          "select role_title, updated_at::text as version from public.people where id = $1",
          [alpha.person],
        );
        assert.equal(
          await value(
            as(alpha),
            "select public.save_person_taking_role($1, null, $2, $3)",
            [
              JSON.stringify({
                id: randomUUID(),
                full_name: "Testname Successor",
                role_title: own.role_title,
                section_id: executive,
                position: 8,
                show_on_public: false,
                photo_path: "",
              }),
              alpha.person,
              own.version,
            ],
          ),
          "self",
        );
        assert.equal((await entry(alpha.person)).section_id, executive);
        assert.deepEqual(
          (await managers()).sort(),
          [alpha.id, bravo.id].sort(),
        );

        // Restore brings no second holder back.
        await run(
          as(alpha),
          "update public.people set archived_at = now() where id = $1",
          [newcomer],
        );
        await run(
          as(alpha),
          "update public.people set section_id = $1, role_title = 'Secretary' where id = $2",
          [executive, holder],
        );
        await refused(
          as(alpha),
          "update public.people set archived_at = null where id = $1",
          [newcomer],
          "SGU17",
        );
      },
    );

    await step(
      "race: two saves of the same Executive board role at once leave one holder",
      async () => {
        const executive = String(
          await value(
            "owner",
            "select id from public.people_sections where kind = 'executive'",
          ),
        );
        const first = new pg.Client({ connectionString: url });
        const second = new pg.Client({ connectionString: url });
        await first.connect();
        await second.connect();
        try {
          const save = async (client: pg.Client, name: string) => {
            await client.query("begin");
            await client.query(
              "select set_config('role', 'authenticated', true), set_config('request.jwt.claims', $1, true)",
              [JSON.stringify({ role: "authenticated", sub: alpha.id })],
            );
            return client.query(
              "insert into public.people (full_name, role_title, section_id, position, show_on_public) values ($1, 'Treasurer', $2, 1, false)",
              [name, executive],
            );
          };
          await save(first, "Testname Racer one");
          let settled = false;
          // The refusal is caught at once: it may arrive while the first commits.
          const pending = save(second, "Testname Racer two").then(
            () => null,
            (error: { code?: string }) => error.code ?? "no code",
          );
          void pending.finally(() => {
            settled = true;
          });
          await delay(300);
          assert.equal(settled, false, "the second save waits for the first");
          await first.query("commit");
          assert.equal(await pending, "SGU17");
          await second.query("rollback");
        } finally {
          await first.end();
          await second.end();
        }
        assert.equal(
          await value(
            "owner",
            "select count(*)::int from public.people where role_title = 'Treasurer' and section_id = $1 and archived_at is null",
            [executive],
          ),
          1,
        );
        // Archived, so later steps find the role free.
        await run(
          "owner",
          "update public.people set archived_at = now() where full_name like 'Testname Racer%'",
        );
      },
    );

    await step(
      "nobody removes their own access or manage people; stale screens get conflict",
      async () => {
        assert.equal(await setAccess(alpha, alpha, false, false, true), "self");
        assert.equal(await setAccess(alpha, alpha, true, false, false), "self");
        assert.equal(
          await setAccess(
            alpha,
            bravo,
            true,
            true,
            true,
            "2000-01-01 00:00:00+00",
          ),
          "conflict",
        );
        assert.deepEqual(
          (await managers()).sort(),
          [alpha.id, bravo.id].sort(),
        );
      },
    );

    await step(
      "race: two managers removing each other at once leave one manager",
      async () => {
        const first = new pg.Client({ connectionString: url });
        const second = new pg.Client({ connectionString: url });
        await first.connect();
        await second.connect();
        try {
          const begin = async (client: pg.Client, actor: Admin) => {
            await client.query("begin");
            await client.query(
              "select set_config('role', 'authenticated', true), set_config('request.jwt.claims', $1, true)",
              [JSON.stringify({ role: "authenticated", sub: actor.id })],
            );
          };
          const remove = (client: pg.Client, target: Admin, version: string) =>
            client
              .query(
                "select public.set_access($1, false, false, true, $2) as result",
                [target.person, version],
              )
              .then((result) => result.rows[0].result);
          const alphaVersion = await accessVersion(alpha);
          const bravoVersion = await accessVersion(bravo);
          await begin(first, alpha);
          assert.equal(await remove(first, bravo, bravoVersion), "ok");
          await begin(second, bravo);
          let settled = false;
          const pending = remove(second, alpha, alphaVersion).finally(() => {
            settled = true;
          });
          await delay(300);
          assert.equal(
            settled,
            false,
            "the second removal waits for the first",
          );
          await first.query("commit");
          assert.equal(await pending, "last_manager");
          await second.query("commit");
        } finally {
          await first.end();
          await second.end();
        }
        assert.deepEqual(await managers(), [alpha.id]);
      },
    );

    await step(
      "the last manager is protected from the SQL editor, the secret key and user deletion",
      async () => {
        await refused(
          "owner",
          "update public.admins set can_manage_people = false where user_id = $1",
          [alpha.id],
          "SGU02",
        );
        await refused(
          "owner",
          "update public.admins set deactivated_at = now() where user_id = $1",
          [alpha.id],
          "SGU02",
        );
        await refused(
          "owner",
          "delete from auth.users where id = $1",
          [alpha.id],
          "SGU02",
        );
        // The secret key (service_role) has no write grant on admins at all.
        for (const text of [
          "update public.admins set can_manage_people = false where user_id = $1",
          "delete from public.admins where user_id = $1",
        ])
          await refused("service_role", text, [alpha.id], "42501");
        await refused(
          "service_role",
          "insert into public.admins (user_id, person_id) values ($1, $2)",
          [outsider.id, hidden],
          "42501",
        );
        assert.equal(await setAccess(alpha, bravo, true, false, true), "ok");
        assert.deepEqual(
          (await managers()).sort(),
          [alpha.id, bravo.id].sort(),
        );
      },
    );

    await step(
      "deactivation ends every session of that person only (D-15) and reactivation restores access",
      async () => {
        await run(
          "owner",
          "insert into auth.sessions (id, user_id) values (gen_random_uuid(), $1), (gen_random_uuid(), $1), (gen_random_uuid(), $2)",
          [member.id, bravo.id],
        );
        assert.equal(await setAccess(alpha, member, false, false, false), "ok");
        assert.equal(await sessions(member), 0);
        assert.equal(await sessions(bravo), 1);
        assert.equal(
          await value(as(member), "select public.is_admin()"),
          false,
        );
        assert.equal(
          (await run(as(member), "select id from public.people")).rowCount,
          0,
        );
        assert.equal(await setAccess(alpha, member, false, false, true), "ok");
        assert.equal(await value(as(member), "select public.is_admin()"), true);
      },
    );

    const invitee = await account("invitee");
    // In the Executive board, the only group that may hold "manage money"
    // (2026-10-06); added there by a manager.
    const newcomer = String(
      await value(
        as(alpha),
        `insert into public.people (full_name, role_title, section_id, position, show_on_public)
        values ('Testname Newcomer', 'Treasurer', (select id from public.people_sections where kind = 'executive'), 5, false)
        returning id`,
      ),
    );
    const grantAccess = (actor: Admin, target: string, email: string) =>
      value(as(actor), "select public.grant_access($1, $2, false, true)", [
        target,
        email,
      ]);

    await step(
      "grant_access links one login to one person, retry-safe",
      async () => {
        assert.equal(
          await grantAccess(alpha, newcomer, invitee.email.toUpperCase()),
          "ok",
        );
        assert.equal(await grantAccess(alpha, newcomer, invitee.email), "ok");
        assert.equal(
          await value(
            "owner",
            "select count(*)::int from public.admins where user_id = $1",
            [invitee.id],
          ),
          1,
        );
        assert.equal(
          await grantAccess(alpha, newcomer, outsider.email),
          "person_has_login",
        );
        assert.equal(
          await grantAccess(alpha, hidden, invitee.email),
          "already_linked",
        );
        assert.equal(
          await grantAccess(alpha, hidden, "nobody@example.invalid"),
          "no_account",
        );
        assert.equal(
          await grantAccess(alpha, randomUUID(), outsider.email),
          "person_archived",
        );
        const [login] = await rows(
          as(member),
          "select can_manage_people, can_manage_money, deactivated_at, last_sign_in_at from public.admin_accounts() where user_id = $1",
          [invitee.id],
        );
        assert.deepEqual(login, {
          can_manage_people: false,
          can_manage_money: true,
          deactivated_at: null,
          last_sign_in_at: null,
        });
      },
    );

    await step(
      "archiving a person deactivates their login; only managers may (D-8, D-12)",
      async () => {
        await run(
          "owner",
          "insert into auth.sessions (id, user_id) values (gen_random_uuid(), $1)",
          [invitee.id],
        );
        const archive =
          "update public.people set archived_at = now() where id = $1";
        await refused(as(member), archive, [newcomer], "SGU03");
        await refused(as(alpha), archive, [alpha.person], "SGU01");
        await run(as(alpha), archive, [newcomer]);
        assert.notEqual(
          await value(
            "owner",
            "select deactivated_at from public.admins where user_id = $1",
            [invitee.id],
          ),
          null,
        );
        assert.equal(await sessions(invitee), 0);
        assert.equal(
          await grantAccess(alpha, newcomer, outsider.email),
          "person_archived",
        );
      },
    );

    await step(
      "an archived person's login stays off; archived entries are read-only until restored (D-19, D-20)",
      async () => {
        const version = await value(
          "owner",
          "select updated_at::text from public.admins where person_id = $1",
          [newcomer],
        );
        assert.equal(
          await value(
            as(alpha),
            "select public.set_access($1, false, true, true, $2)",
            [newcomer, version],
          ),
          "person_archived",
        );
        const edit =
          "update public.people set role_title = 'Edited' where id = $1";
        for (const actor of [as(alpha), as(member), "owner"] as Actor[])
          await refused(actor, edit, [newcomer], "SGU06");
        await run(
          as(member),
          "update public.people set archived_at = now() where id = $1",
          [hidden],
        );
        await refused(
          as(member),
          "update public.people set archived_at = null, role_title = 'Edited' where id = $1",
          [hidden],
          "SGU06",
        );
        await run(
          as(member),
          "update public.people set archived_at = null where id = $1",
          [hidden],
        );
        assert.equal((await run(as(member), edit, [hidden])).rowCount, 1);
      },
    );

    await step(
      "an archived person's photo can be cleared, and nothing else (D-26)",
      async () => {
        let withdrawn = "";
        await withPresidentFree(async () => {
          withdrawn = await pictureExecutive(
            "Testname Withdrawn",
            `${randomUUID()}.webp`,
          );
          await run(
            as(member),
            "update public.people set archived_at = now() where id = $1",
            [withdrawn],
          );
        });
        const clear = "photo_path = ''";
        for (const [change, why] of [
          [`${clear}, role_title = 'Edited'`, "with another change"],
          [`${clear}, archived_at = now() - interval '1 day'`, "re-archived"],
          [
            `photo_path = '${randomUUID()}.webp'`,
            "a different photo instead of none",
          ],
        ])
          await refused(
            as(member),
            `update public.people set ${change} where id = $1`,
            [withdrawn],
            "SGU06",
          ).catch((error) => assert.fail(`${why}: ${error}`));
        const mark = await lastLogId();
        for (const actor of [as(member), "owner"] as Actor[])
          assert.equal(
            (
              await run(
                actor,
                `update public.people set ${clear} where id = $1`,
                [withdrawn],
              )
            ).rowCount,
            1,
          );
        const [cleared] = await rows(
          "owner",
          "select photo_path, archived_at is not null as archived from public.people where id = $1",
          [withdrawn],
        );
        assert.deepEqual(cleared, { photo_path: "", archived: true });
        const [entry] = await logSince(mark);
        assert.deepEqual(
          [entry.action, entry.after],
          ["updated", { photo_path: "[private]" }],
        );
        await refused(
          as(member),
          "update public.people set role_title = 'Edited' where id = $1",
          [withdrawn],
          "SGU06",
        );
      },
    );

    let volunteers = "";
    await step(
      "groups: unique current names; archived only when empty (D-7); the permanent ones always kept",
      async () => {
        volunteers = String(
          await value(
            as(member),
            "insert into public.people_sections (name, position) values ('Volunteers', 4) returning id",
          ),
        );
        await refused(
          as(member),
          "insert into public.people_sections (name, position) values ('executive BOARD', 5)",
          [],
          "23505",
        );
        const archive =
          "update public.people_sections set archived_at = now() where id = $1";
        // The General board is always kept (review 2); a group someone is in
        // is archived only once they leave it.
        await refused(as(member), archive, [board], "SGU13");
        await refused(
          as(member),
          "update public.people_sections set name = 'Renamed' where id = $1",
          [board],
          "SGU13",
        );
        const member_entry = await person(
          "full_name, section_id, position, show_on_public",
          ["Testname Volunteer", volunteers, 1, false],
        );
        await refused(as(member), archive, [volunteers], "SGU04");
        await run("owner", "delete from public.people where id = $1", [
          member_entry,
        ]);
        await run(as(member), archive, [volunteers]);
      },
    );

    await step(
      "Save order (review fixes PR-2): board members only, the whole list or nothing",
      async () => {
        const current = await rows(
          "owner",
          "select id, updated_at::text as version from public.people_sections where archived_at is null order by position, name",
        );
        const call =
          "select public.save_order('people_sections', $1::uuid[], $2::timestamptz[]) as result";
        const reversed = [...current].reverse();
        const params = [
          reversed.map((row) => row.id),
          reversed.map((row) => row.version),
        ];
        await refused("anon", call, params, "42501");
        // RLS hides every row from someone who is not on the board.
        assert.equal(await value(as(outsider), call, params), "conflict");
        assert.equal(await value(as(member), call, params), "ok");
        assert.deepEqual(
          (
            await rows(
              "owner",
              "select id from public.people_sections where archived_at is null order by position",
            )
          ).map((row) => row.id),
          reversed.map((row) => row.id),
        );
        // Back to the starting order, with the new versions.
        const again = await rows(
          "owner",
          "select id, updated_at::text as version from public.people_sections where archived_at is null order by position desc",
        );
        assert.equal(
          await value(as(member), call, [
            again.map((row) => row.id),
            again.map((row) => row.version),
          ]),
          "ok",
        );
      },
    );

    await step(
      "archived groups are read-only and any admin restores them, unless the name is taken (D-20, D-22)",
      async () => {
        const archive =
          "update public.people_sections set archived_at = now() where id = $1";
        const restore =
          "update public.people_sections set archived_at = null where id = $1";
        const rename =
          "update public.people_sections set name = 'Renamed' where id = $1";
        for (const actor of [as(member), "owner"] as Actor[])
          await refused(actor, rename, [volunteers], "SGU06");
        await refused(
          as(member),
          "update public.people_sections set archived_at = null, name = 'Renamed' where id = $1",
          [volunteers],
          "SGU06",
        );
        assert.equal(
          (await run(as(member), restore, [volunteers])).rowCount,
          1,
        );
        await run(as(member), archive, [volunteers]);
        const choir = String(
          await value(
            as(member),
            "insert into public.people_sections (name, position) values ('Choir', 6) returning id",
          ),
        );
        await run(as(member), archive, [choir]);
        await run(
          as(member),
          "insert into public.people_sections (name, position) values ('choir', 7)",
        );
        await refused(as(member), restore, [choir], "23505");
      },
    );

    const event = (title: string, extra = "", values: unknown[] = []) =>
      value(
        as(member),
        `insert into public.events (title, date${extra ? `, ${extra}` : ""}) values ($1, current_date${values.map((_, i) => `, $${i + 2}`).join("")}) returning id`,
        [title, ...values],
      ).then(String);
    const deleted = (actor: Actor, table: string, id: string) =>
      run(actor, `delete from public.${table} where id = $1`, [id]).then(
        (result) => result.rowCount,
      );

    await step(
      "permanent delete only of archived rows and only by managers (D-6)",
      async () => {
        assert.equal(await deleted(as(member), "people", newcomer), 0);
        assert.equal(await deleted(as(alpha), "people", hidden), 0);
        assert.equal(await deleted(as(alpha), "people", newcomer), 1);
        assert.equal(
          (
            await run(
              "owner",
              "select 1 from public.admins where user_id = $1",
              [invitee.id],
            )
          ).rowCount,
          0,
          "the person's access row goes with them",
        );
        assert.equal(await deleted(as(alpha), "people_sections", board), 0);
        assert.equal(
          await deleted(as(member), "people_sections", volunteers),
          0,
        );
        assert.equal(
          await deleted(as(alpha), "people_sections", volunteers),
          1,
        );
        for (const table of [
          "events",
          "announcements",
          "news_posts",
          "newsletters",
        ]) {
          const id = String(
            await value(
              as(member),
              `insert into public.${table} (title, date) values ('Delete check', current_date) returning id`,
            ),
          );
          assert.equal(await deleted(as(alpha), table, id), 0);
          await run(
            as(member),
            `update public.${table} set archived_at = now() where id = $1`,
            [id],
          );
          assert.equal(await deleted(as(member), table, id), 0);
          assert.equal(await deleted(as(alpha), table, id), 1);
        }
      },
    );

    const image = `${randomUUID()}.webp`;
    const pdf = `${randomUUID()}.pdf`;
    const unused = `${randomUUID()}.pdf`;
    const visibleObjects = async (actor: Actor, names: string[]) =>
      (
        await run(
          actor,
          "select name from storage.objects where bucket_id = 'community' and name = any($1)",
          [names],
        )
      ).rowCount;
    let published = "";

    await step(
      "archived items and their files are hidden from visitors",
      async () => {
        await run(
          "owner",
          "insert into storage.objects (bucket_id, name) select 'community', unnest($1::text[])",
          [[image, pdf, unused, photo]],
        );
        published = await event(
          "Published with files",
          "published, image_path, image_alt, file_path",
          [true, image, "Alt text", pdf],
        );
        for (const actor of ["anon", as(outsider)] as Actor[]) {
          assert.equal(
            (
              await run(actor, "select id from public.events where id = $1", [
                published,
              ])
            ).rowCount,
            1,
          );
          assert.equal(await visibleObjects(actor, [image, pdf]), 2);
        }
        await run(
          as(member),
          "update public.events set archived_at = now() where id = $1",
          [published],
        );
        for (const actor of ["anon", as(outsider)] as Actor[]) {
          assert.equal(
            (
              await run(actor, "select id from public.events where id = $1", [
                published,
              ])
            ).rowCount,
            0,
          );
          assert.equal(await visibleObjects(actor, [image, pdf]), 0);
        }
        assert.equal(await visibleObjects(as(member), [image, pdf]), 2);
        assert.equal(
          await visibleObjects("anon", [photo]),
          1,
          "a listed person's photo",
        );
        // The Executive board is always listed (review fixes P4): its photo
        // stays public while "Show" is off, and goes once archived.
        await run(
          as(member),
          "update public.people set show_on_public = false where id = $1",
          [pictured],
        );
        assert.equal(await visibleObjects("anon", [photo]), 1);
        await run(
          as(member),
          "update public.people set archived_at = now() where id = $1",
          [pictured],
        );
        assert.equal(await visibleObjects("anon", [photo]), 0);
        await run(
          as(member),
          "update public.people set archived_at = null where id = $1",
          [pictured],
        );
        await run(
          as(member),
          "update public.people set show_on_public = true where id = $1",
          [pictured],
        );
      },
    );

    await step(
      "stored files are deleted by any admin, and only when no row uses them (D-23)",
      async () => {
        // Like the Storage API, which switches on Supabase's guard against direct object deletes.
        const remove = (actor: Actor, name: string) =>
          within(db, actor, async () => {
            await db.query(
              "select set_config('storage.allow_delete_query', 'true', true)",
            );
            return db.query(
              "delete from storage.objects where bucket_id = 'community' and name = $1",
              [name],
            );
          }).then((result) => result.rowCount);
        assert.equal(await remove(as(outsider), unused), 0);
        assert.equal(await remove(as(firstAdmin), unused), 0, "deactivated");
        assert.equal(await remove("anon", unused), 0);
        assert.equal(
          await remove(as(member), image),
          0,
          "used by an archived item",
        );
        assert.equal(await remove(as(member), photo), 0, "used by a person");
        assert.equal(await remove(as(alpha), image), 0, "manage people");
        assert.equal(await remove(as(alpha), photo), 0, "manage people");
        assert.equal(
          await remove(as(member), unused),
          1,
          "an admin without manage people",
        );
      },
    );

    await step(
      "one visibility rule: every policy calls community_item_visible() (D-24)",
      async () => {
        // Community items only: prayer settings, the PR7 pin, the PR6 giving tables and (review fixes P3)
        // the Lists have their own rules.
        const policies = await rows(
          "owner",
          `select tablename, policyname, coalesce(qual, '') || coalesce(with_check, '') as rule
          from pg_policies where policyname in ('public_read', 'published_attachment')
            and tablename not in ('prayer_settings', 'seasons', 'payment_items', 'payment_item_links',
              'musallah_location', 'page_texts', 'quran_verses', 'merch_collections', 'merch_items',
              'list_options')`,
        );
        assert.equal(policies.length, 5);
        for (const policy of policies) {
          assert.match(policy.rule, /community_item_visible\(/);
          assert.doesNotMatch(policy.rule, /America\/Grenada/);
        }
      },
    );

    await step(
      "public_team() lists the Executive board and the people marked Yes, photos only for the Executive board, without account columns",
      async () => {
        const team = await run("anon", "select * from public.public_team()");
        assert.deepEqual(
          team.fields.map((field) => field.name),
          [
            "section_id",
            "section_name",
            "section_position",
            "person_id",
            "full_name",
            "role_title",
            "position",
            "photo_path",
          ],
        );
        // The Executive board always (review fixes P4), with its photos; the
        // others when marked Yes, never with a photo.
        const shown = team.rows.map((row) => [row.full_name, row.photo_path]);
        assert.deepEqual(
          shown.filter(([name]) =>
            ["Testname Listed", "Testname First", "Testname Hidden"].includes(
              String(name),
            ),
          ),
          [
            ["Testname First", photo],
            ["Testname Listed", null],
          ],
        );
        const executives = Number(
          await value(
            "owner",
            "select count(*) from public.people p join public.people_sections s on s.id = p.section_id where s.kind = 'executive' and p.archived_at is null",
          ),
        );
        assert.equal(
          (
            await run(
              "anon",
              "select * from public.public_team_list() where section_kind = 'executive'",
            )
          ).rowCount,
          executives,
        );
        await run(
          as(member),
          "update public.people set archived_at = now() where id = $1",
          [listed],
        );
        assert.equal(
          (await run("anon", "select * from public.public_team()")).rowCount,
          (team.rowCount ?? 0) - 1,
        );
        await run(
          as(member),
          "update public.people set archived_at = null where id = $1",
          [listed],
        );
      },
    );

    await step(
      "one log entry per change, with the actor; People entries keep no personal values (D-5)",
      async () => {
        let mark = await lastLogId();
        await run(
          as(member),
          "update public.people set role_title = 'Treasurer' where id = $1",
          [listed],
        );
        assert.deepEqual(await logSince(mark), [
          {
            actor: member.id,
            area: "people",
            record_id: listed,
            action: "updated",
            before: { role_title: "" },
            after: { role_title: "Treasurer" },
            highlight: false,
          },
        ]);
        mark = await lastLogId();
        await run(
          as(member),
          "update public.people set role_title = 'Treasurer' where id = $1",
          [listed],
        );
        assert.equal(
          (await logSince(mark)).length,
          0,
          "no-op saves are not logged",
        );
        await run(
          as(member),
          "update public.people set full_name = 'Testname Renamed', role_title = 'Secretary' where id = $1",
          [listed],
        );
        const [renamed] = await logSince(mark);
        assert.deepEqual(
          [renamed.before, renamed.after],
          [
            { full_name: "[private]", role_title: "Treasurer" },
            { full_name: "[private]", role_title: "Secretary" },
          ],
        );

        // D-27: a new person's empty personal fields are not listed as changed.
        mark = await lastLogId();
        const plain = await person(
          "full_name, section_id, position, show_on_public",
          ["Testname Plain", board, 7, false],
        );
        let pictured_entry = "";
        let plainEntry:
          Awaited<ReturnType<typeof logSince>>[number] | undefined;
        let picturedEntry: typeof plainEntry;
        await withPresidentFree(async () => {
          const before = await lastLogId();
          pictured_entry = await pictureExecutive(
            "Testname Logged",
            `${randomUUID()}.webp`,
          );
          [plainEntry] = await logSince(mark);
          [picturedEntry] = await logSince(before);
          // Archived at once: the President role is free again for `pictured`.
          await run(
            as(member),
            "update public.people set archived_at = now() where id = $1",
            [pictured_entry],
          );
        });
        assert.ok(plainEntry && picturedEntry);
        const personal = ["full_name", "photo_path"];
        assert.deepEqual(
          [plainEntry.action, plainEntry.record_id, plainEntry.before],
          ["created", plain, null],
        );
        assert.deepEqual(
          personal.filter((key) => key in plainEntry.after),
          ["full_name"],
        );
        assert.equal(plainEntry.after.full_name, "[private]");
        assert.equal(plainEntry.after.show_on_public, false, "not personal");
        assert.equal(picturedEntry.record_id, pictured_entry);
        for (const key of personal)
          assert.equal(picturedEntry.after[key], "[private]", key);
        assert.ok(!JSON.stringify(picturedEntry).includes("Testname"));

        // D-29: a deleted person's empty personal fields are not listed either.
        await run(
          as(member),
          "update public.people set archived_at = now() where id = $1",
          [plain],
        );
        mark = await lastLogId();
        assert.equal(await deleted(as(alpha), "people", plain), 1);
        assert.equal(await deleted(as(alpha), "people", pictured_entry), 1);
        const [plainGone, picturedGone] = await logSince(mark);
        assert.deepEqual(
          [plainGone.action, plainGone.record_id, plainGone.after],
          ["deleted", plain, null],
        );
        assert.deepEqual(
          personal.filter((key) => key in plainGone.before),
          ["full_name"],
        );
        assert.equal(plainGone.before.full_name, "[private]");
        assert.equal(plainGone.before.show_on_public, false, "not personal");
        assert.equal(picturedGone.record_id, pictured_entry);
        for (const key of personal)
          assert.equal(picturedGone.before[key], "[private]", key);
        assert.ok(!JSON.stringify(picturedGone).includes("Testname"));

        mark = await lastLogId();
        const created = await event("Original title");
        await run(
          as(member),
          "update public.events set title = 'Changed title' where id = $1",
          [created],
        );
        const [insert, update] = await logSince(mark);
        assert.equal(insert.action, "created");
        assert.equal(insert.after.title, "Original title");
        assert.deepEqual(
          [
            update.action,
            update.before.title,
            update.after.title,
            update.highlight,
          ],
          ["updated", "Original title", "Changed title", false],
        );

        mark = await lastLogId();
        await run(
          as(member),
          "update public.prayer_settings set notice = 'Prayer notice check' where id = 1",
        );
        const [prayer] = await logSince(mark);
        assert.deepEqual(
          [
            prayer.area,
            prayer.highlight,
            prayer.before.notice,
            prayer.after.notice,
          ],
          ["prayer_settings", true, "", "Prayer notice check"],
        );
        assert.ok(
          prayer.after.fajr !== undefined,
          "prayer entries keep full rows",
        );

        const history = async (area: string, id: string) =>
          (
            await rows(
              "owner",
              "select action, actor from public.activity_log where area = $1 and record_id = $2 order by id",
              [area, id],
            )
          ).map((row) => [row.action, row.actor]);
        assert.deepEqual(await history("admins", newcomer), [
          ["access_granted", alpha.id],
          ["access_changed", alpha.id],
          ["deleted", alpha.id],
        ]);
        assert.deepEqual(await history("people", newcomer), [
          ["created", alpha.id],
          ["archived", alpha.id],
          ["deleted", alpha.id],
        ]);
        const firstAdminPerson = String(
          await value(
            "owner",
            "select person_id from public.admins where user_id = $1",
            [firstAdmin.id],
          ),
        );
        assert.deepEqual(await history("admins", firstAdminPerson), [
          ["access_granted", null],
          ["access_changed", null],
        ]);
        assert.deepEqual(
          (await history("events", published)).map(([action]) => action),
          ["created", "archived"],
        );
        assert.equal(
          await value(
            "owner",
            `select count(*)::int from public.activity_log
            where concat(before::text, after::text) ilike any (array['%testname%', '%@example.invalid%'])`,
          ),
          0,
          "no names or emails in the log",
        );
      },
    );

    await step(
      "PR4: board members store the Hijri adjustment and Friday Jumu'ah changes; the log keeps them",
      async () => {
        const mark = await lastLogId();
        const exceptions = [
          {
            date: "2026-10-08",
            reason: "Old shape",
            adjustments: {
              fajr: 0,
              sunrise: 0,
              dhuhr: 0,
              asr: 0,
              maghrib: 0,
              isha: 0,
            },
            iqamah: {},
          },
          {
            date: "2026-10-09",
            reason: "Campus closed",
            iqamah: {},
            jumuah: { change: "cancelled" },
          },
        ];
        await run(
          as(member),
          "update public.prayer_settings set hijri_adjustment = 1, exceptions = $1::jsonb where id = 1",
          [JSON.stringify(exceptions)],
        );
        const [entry] = await logSince(mark);
        assert.deepEqual(
          [
            entry.area,
            entry.before.hijri_adjustment,
            entry.after.hijri_adjustment,
            entry.after.exceptions[1].jumuah,
          ],
          ["prayer_settings", 0, 1, { change: "cancelled" }],
        );
        await refused(
          as(member),
          "update public.prayer_settings set hijri_adjustment = 2 where id = 1",
          [],
          "23514",
        );
        await refused(
          as(member),
          "update public.prayer_settings set exceptions = $1::jsonb where id = 1",
          [JSON.stringify([{ ...exceptions[1], date: "2026-10-08" }])],
          "23514",
        );
        await run(
          as(member),
          "update public.prayer_settings set hijri_adjustment = 0, exceptions = '[]' where id = 1",
        );
      },
    );

    await step(
      "review fixes P2: board members store several Jumu'ah prayers in order and one Friday's own prayers; the log keeps them",
      async () => {
        const [before] = await rows(
          "owner",
          "select valid_from, valid_until from public.prayer_settings where id = 1",
        );
        const mark = await lastLogId();
        const sessions = [
          { khutbah: "13:45", iqamah: "14:00" },
          { khutbah: "12:45", iqamah: "13:00" },
        ];
        const friday = {
          date: "2026-10-16",
          reason: "Exams",
          iqamah: {},
          jumuah: { change: "changed", sessions: [sessions[0]] },
        };
        await run(
          as(member),
          `update public.prayer_settings set valid_from = '2026-10-01', valid_until = '2026-12-31',
             jumuah_sessions = $1::jsonb, exceptions = $2::jsonb where id = 1`,
          [JSON.stringify(sessions), JSON.stringify([friday])],
        );
        const [entry] = await logSince(mark);
        assert.deepEqual(
          [entry.area, entry.after.jumuah_sessions, entry.after.exceptions],
          ["prayer_settings", sessions, [friday]],
        );
        for (const [list, label] of [
          [[{ khutbah: "13:00", iqamah: "12:45" }], "iqamah before khutbah"],
          [Array(5).fill(sessions[0]), "five prayers"],
        ] as const)
          await refused(
            as(member),
            "update public.prayer_settings set jumuah_sessions = $1::jsonb where id = 1",
            [JSON.stringify(list)],
            "23514",
          ).catch((error) => {
            throw new Error(`${label}: ${error}`);
          });
        await refused(
          as(member),
          "update public.prayer_settings set exceptions = $1::jsonb where id = 1",
          [
            JSON.stringify([
              { ...friday, jumuah: { change: "changed", sessions: [] } },
            ]),
          ],
          "23514",
        );
        await run(
          as(member),
          `update public.prayer_settings set jumuah_sessions = '[]', exceptions = '[]',
             valid_from = $1, valid_until = $2 where id = 1`,
          [before.valid_from, before.valid_until],
        );
      },
    );

    await step(
      "PR5a: urgent notices end at their own time, event status rules, New board term tables are board-only",
      async () => {
        const grenadaToday = "(now() at time zone 'America/Grenada')::date";
        const urgent = (title: string, ends: string) =>
          value(
            as(member),
            `insert into public.announcements (title, date, published, urgent_until)
             values ($1, ${grenadaToday} - 1, true, ${ends}) returning id`,
            [title],
          ).then(String);
        const mark = await lastLogId();
        const first = await urgent("Urgent one", "now() + interval '1 hour'");
        const second = await urgent("Urgent two", "now() + interval '2 hours'");
        const shown = async () =>
          (
            await rows(
              "anon",
              "select id from public.announcements where urgent_until is not null order by title",
            )
          ).map((row) => row.id);
        assert.deepEqual(await shown(), [first, second]);
        await run(
          as(member),
          "update public.announcements set urgent_until = now() - interval '1 second' where id = $1",
          [first],
        );
        assert.deepEqual(await shown(), [second], "hidden at its own end");
        assert.ok(
          (await logSince(mark)).every(
            (entry) => entry.area === "announcements" && entry.highlight,
          ),
          "urgent changes are highlighted",
        );
        await refused(
          as(member),
          "update public.announcements set featured = true where id = $1",
          [second],
          "23514",
        );

        await refused(
          as(member),
          "insert into public.events (title, date, status) values ('No reason', current_date, 'cancelled')",
          [],
          "23514",
        );
        // Review 2: the end comes after the start; 10 PM to 3 AM needs an end date.
        await event("Next day", "start_time, end_date, end_time", [
          "22:00",
          "tomorrow",
          "03:00",
        ]);
        await refused(
          as(member),
          "insert into public.events (title, date, start_time, end_time) values ('Overnight', current_date, '22:00', '03:00')",
          [],
          "23514",
        );
        await refused(
          as(member),
          "insert into public.events (title, date, end_date) values ('Backwards', current_date, current_date - 1)",
          [],
          "23514",
        );

        for (const table of ["handover_steps", "shared_logins"]) {
          await refused("anon", `select * from public.${table}`, [], "42501");
          for (const who of [outsider, firstAdmin])
            assert.equal(
              (await run(as(who), `select * from public.${table}`)).rowCount,
              0,
            );
        }
        assert.equal(
          await value(
            as(member),
            "select count(*)::int from public.handover_steps",
          ),
          6,
          "starter steps",
        );
        const login = String(
          await value(
            as(member),
            "insert into public.shared_logins (service, holder_person_id) values ('MSA Gmail', $1) returning id",
            [member.person],
          ),
        );
        await refused(
          as(alpha),
          "delete from public.shared_logins where id = $1",
          [login],
          "42501",
        );
        await refused(
          as(alpha),
          "delete from public.handover_steps",
          [],
          "42501",
        );
        await run(
          as(member),
          "update public.shared_logins set archived_at = now() where id = $1",
          [login],
        );
        await refused(
          as(member),
          "update public.shared_logins set note = 'Changed' where id = $1",
          [login],
          "SGU06",
        );
      },
    );

    await step(
      "PR6: seasons, funds and Go2Pay links: visitors read current listed rows, any board member writes, links are add-only, SGU08–SGU10",
      async () => {
        for (const table of [
          "seasons",
          "payment_items",
          "payment_item_links",
          // PR5c: merch collections and items.
          "merch_collections",
          "merch_items",
        ])
          for (const text of [
            `insert into public.${table} default values`,
            `delete from public.${table}`,
          ])
            await refused("anon", text, [], "42501");
        assert.equal(
          Number(await value("anon", "select count(*) from public.seasons")),
          3,
          "starter seasons",
        );
        // Any board member, not only "manage money" holders (D-65).
        const fund = String(
          await value(
            as(member),
            `insert into public.payment_items (slug, name, kind, category, about, listed, position)
             values ('backend-zakat', 'Zakat al-Mal', 'fund', 'zakat_al_mal', 'Passed on.', true, 1) returning id`,
          ),
        );
        for (const who of [outsider, firstAdmin])
          await refused(
            as(who),
            "insert into public.payment_items (slug, name, kind, category, position) values ('x', 'X', 'fund', 'general', 1)",
            [],
            "42501",
          );
        await refused(
          as(member),
          "update public.payment_items set category = 'general' where id = $1",
          [fund],
          "SGU10",
        );
        await refused(
          as(member),
          "update public.payment_items set slug = 'renamed' where id = $1",
          [fund],
          "SGU10",
        );
        const mark = await lastLogId();
        await run(
          as(member),
          "insert into public.payment_item_links (go2pay_product_id, payment_item_id) values (987654, $1)",
          [fund],
        );
        assert.deepEqual(
          (await logSince(mark)).map((entry) => [entry.area, entry.highlight]),
          [["payment_item_links", true]],
        );
        for (const text of [
          "update public.payment_item_links set added_at = now()",
          "delete from public.payment_item_links",
          "delete from public.payment_items",
          "delete from public.seasons",
        ])
          await refused(as(alpha), text, [], "42501");
        assert.equal(
          (
            await run(
              "anon",
              "select go2pay_product_id from public.payment_item_links",
            )
          ).rowCount,
          1,
        );
        // An unlisted draft and its Go2Pay product id stay private.
        const draft = String(
          await value(
            as(member),
            `insert into public.payment_items (slug, name, kind, category, position)
             values ('backend-draft', 'Draft', 'fund', 'general', 2) returning id`,
          ),
        );
        await run(
          as(member),
          "insert into public.payment_item_links (go2pay_product_id, payment_item_id) values (987655, $1)",
          [draft],
        );
        assert.deepEqual(
          (
            await run(
              "anon",
              "select slug from public.payment_items where slug like 'backend-%'",
            )
          ).rows.map((row) => row.slug),
          ["backend-zakat"],
        );
        assert.equal(
          (
            await run(
              "anon",
              "select go2pay_product_id from public.payment_item_links",
            )
          ).rowCount,
          1,
        );
        const ramadan = String(
          await value(
            as(member),
            "select id from public.seasons where name = 'Ramadan'",
          ),
        );
        await run(
          as(member),
          "update public.payment_items set season_id = $1 where id = $2",
          [ramadan, fund],
        );
        await refused(
          as(member),
          "update public.seasons set archived_at = now() where id = $1",
          [ramadan],
          "SGU08",
        );
        // SGU09: nobody turns on their own "manage money"; another manager can.
        assert.equal(
          await setAccess(alpha, alpha, true, true, true),
          "self_money",
        );
        assert.equal(await setAccess(bravo, alpha, true, true, true), "ok");
        assert.equal(await setAccess(alpha, alpha, true, false, true), "ok");
        // Test rows only: the owner removes them (nobody else can delete).
        await run(
          "owner",
          "delete from public.payment_item_links where payment_item_id = any($1::uuid[])",
          [[fund, draft]],
        );
        await run(
          "owner",
          "delete from public.payment_items where id = any($1::uuid[])",
          [[fund, draft]],
        );
      },
    );

    await step(
      "the musallah pin (PR7): one row in Grenada, visitors read it, admins move it with a log entry, nobody deletes it",
      async () => {
        const pin = "select latitude, longitude from public.musallah_location";
        assert.deepEqual(await rows("anon", pin), [
          { latitude: 12.0025521, longitude: -61.7723834 },
        ]);
        const move =
          "update public.musallah_location set latitude = $1, longitude = $2 where id = 1";
        await refused("anon", move, [12.003, -61.772], "42501");
        assert.equal(
          (await run(as(outsider), move, [12.003, -61.772])).rowCount,
          0,
        );
        await refused(as(member), move, [12.536, -61.384], "23514");
        await refused(
          "owner",
          "insert into public.musallah_location (id, latitude, longitude) values (2, 12, -61.75)",
          [],
          "23514",
        );
        const before = await lastLogId();
        assert.equal(
          (await run(as(member), move, [12.003, -61.772])).rowCount,
          1,
        );
        const [entry] = await logSince(before);
        assert.deepEqual(
          [entry.area, entry.action, entry.highlight],
          ["musallah_location", "updated", false],
        );
        for (const actor of ["anon", as(member), as(alpha)] as Actor[])
          await refused(
            actor,
            "delete from public.musallah_location",
            [],
            "42501",
          );
        await run("owner", move, [12.0025521, -61.7723834]);
      },
    );

    await step(
      "the activity log is add-only for every role, the owner included",
      async () => {
        for (const actor of [as(alpha), "service_role", "anon"] as Actor[]) {
          for (const text of [
            "update public.activity_log set area = 'changed'",
            "delete from public.activity_log",
            "truncate public.activity_log",
            "insert into public.activity_log (area, record_id, action) values ('x', 'x', 'created')",
          ])
            await refused(actor, text, [], "42501");
        }
        for (const text of [
          "update public.activity_log set area = 'changed'",
          "delete from public.activity_log",
          "truncate public.activity_log",
        ])
          await refused("owner", text, [], "SGU05");
        assert.ok((await lastLogId()) > 0);
      },
    );

    await step(
      "daily check: only the secret key reads and adds what was emailed (ADR 0022)",
      async () => {
        const member = await admin("Ledger", true);
        const insert =
          "insert into public.warning_emails_sent (warning_key, step, emailed_on) values ($1, $2, $3)";
        for (const actor of ["anon", as(member)] as Actor[]) {
          await refused(
            actor,
            "select * from public.warning_emails_sent",
            [],
            "42501",
          );
          await refused(
            actor,
            insert,
            ["iqamah:2026-10-15", "first", "2026-10-08"],
            "42501",
          );
        }
        await run("service_role", insert, [
          "iqamah:2026-10-15",
          "first",
          "2026-10-08",
        ]);
        await refused(
          "service_role",
          insert,
          ["iqamah:2026-10-15", "first", "2026-10-09"],
          "23505",
        );
        await refused(
          "service_role",
          insert,
          ["iqamah:2026-10-15", "second", "2026-10-09"],
          "23514",
        );
        assert.equal(
          await value(
            "service_role",
            "select count(*)::int from public.warning_emails_sent",
          ),
          1,
        );
      },
    );

    // Last: it fills every Executive board role.
    await step(
      "owner_add_admin gives a new manager the first free role, or hands over the role it names (2026-10-06)",
      async () => {
        const executive = String(
          await value(
            "owner",
            "select id from public.people_sections where kind = 'executive'",
          ),
        );
        // Free one role: archive an executive without a login.
        await run(
          "owner",
          `update public.people set archived_at = now() where id = (
            select p.id from public.people p where p.section_id = $1 and p.archived_at is null
              and not exists (select 1 from public.admins a where a.person_id = p.id)
            order by public.executive_role_rank(p.role_title) desc limit 1)`,
          [executive],
        );
        const first = await account("first-free");
        const free = await value(
          "owner",
          "select public.first_free_executive_role()",
        );
        await run("owner", "select public.owner_add_admin($1, $2, true)", [
          first.email,
          "Testname First free",
        ]);
        assert.equal(
          await value(
            "owner",
            "select p.role_title from public.admins a join public.people p on p.id = a.person_id where a.user_id = $1",
            [first.id],
          ),
          free,
        );
        for (;;) {
          const role = await value(
            "owner",
            "select public.first_free_executive_role()",
          );
          if (!role) break;
          await run(
            "owner",
            "insert into public.people (full_name, role_title, section_id, position, show_on_public) values ('Testname Filler', $1, $2, 1, false)",
            [role, executive],
          );
        }
        const late = await account("late");
        await assert.rejects(
          run("owner", "select public.owner_add_admin($1, $2, true)", [
            late.email,
            "Testname Late",
          ]),
          /All five Executive board roles are held/,
        );
        // A lock-out: the owner names a role; its holder moves out.
        const secretary = String(
          await value(
            "owner",
            "select id from public.people where section_id = $1 and role_title = 'Secretary' and archived_at is null",
            [executive],
          ),
        );
        await run(
          "owner",
          "select public.owner_add_admin($1, $2, true, 'Secretary')",
          [late.email, "Testname Late"],
        );
        const [moved] = await rows(
          "owner",
          "select s.kind, p.role_title from public.people p join public.people_sections s on s.id = p.section_id where p.id = $1",
          [secretary],
        );
        assert.deepEqual(moved, { kind: "general", role_title: "" });
        const [added] = await rows(
          "owner",
          "select a.can_manage_people, p.role_title, p.section_id from public.admins a join public.people p on p.id = a.person_id where a.user_id = $1",
          [late.id],
        );
        assert.deepEqual(added, {
          can_manage_people: true,
          role_title: "Secretary",
          section_id: executive,
        });
      },
    );

    console.log("PASS: database suite");
  } finally {
    await db.end();
  }
}

async function stackSuite() {
  const url = process.env.SUPABASE_URL!;
  if (!/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(url))
    throw new Error(
      "Backend tests only run against the dedicated local Supabase instance.",
    );
  const owner = new pg.Client({ connectionString: localDatabaseUrl() });
  await owner.connect();
  try {
    await stackChecks(url, owner);
  } finally {
    await owner.end();
  }
}

async function stackChecks(url: string, owner: pg.Client) {
  const secret = createClient(url, process.env.SUPABASE_TEST_SECRET_KEY!, {
    auth: { persistSession: false },
  });
  const client = () =>
    createClient(url, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false },
    });
  const anon = client();
  const member = client();
  const outsider = client();
  const helper = client();
  // Transient accounts get a password that meets the D-16 rule (12+ characters, lower, upper, digit, symbol).
  const strongPassword = () => `Aa1!${randomUUID()}`;
  const ensureAdmin = async (
    userId: string,
    email: string,
    name: string,
    managePeople: boolean,
  ) => {
    const existing = await owner.query(
      "select 1 from public.admins where user_id = $1",
      [userId],
    );
    if (existing.rowCount === 0)
      await owner.query("select public.owner_add_admin($1, $2, $3)", [
        email,
        name,
        managePeople,
      ]);
  };
  const email = process.env.E2E_ADMIN_EMAIL!;
  const password = process.env.E2E_ADMIN_PASSWORD!;
  const existing = await secret.auth.admin.listUsers();
  let user = existing.data.users.find((user) => user.email === email);
  if (!user) {
    const created = await secret.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    assert.ifError(created.error);
    user = created.data.user!;
  }
  await ensureAdmin(user.id, email, "Backend Test Admin", true);
  assert.ifError(
    (await member.auth.signInWithPassword({ email, password })).error,
  );
  const outsiderEmail = `outsider-${randomUUID()}@example.invalid`;
  const outsiderPassword = strongPassword();
  const created = await secret.auth.admin.createUser({
    email: outsiderEmail,
    password: outsiderPassword,
    email_confirm: true,
  });
  assert.ifError(created.error);
  assert.ifError(
    (
      await outsider.auth.signInWithPassword({
        email: outsiderEmail,
        password: outsiderPassword,
      })
    ).error,
  );
  const helperEmail = `helper-${randomUUID()}@example.invalid`;
  const helperPassword = strongPassword();
  const helperUser = await secret.auth.admin.createUser({
    email: helperEmail,
    password: helperPassword,
    email_confirm: true,
  });
  assert.ifError(helperUser.error);
  const id = randomUUID();
  const attachment = `${randomUUID()}.pdf`;
  try {
    assert.ok(
      (await outsider.from("admins").insert({ user_id: created.data.user!.id }))
        .error,
      "outsider cannot self-promote",
    );
    assert.ok(
      (
        await anon
          .from("events")
          .insert({ id, title: "Denied", date: localDate(new Date()) })
      ).error,
    );
    assert.ok(
      (
        await outsider
          .from("events")
          .insert({ id, title: "Denied", date: localDate(new Date()) })
      ).error,
    );
    assert.ifError(
      (
        await member.storage
          .from("community")
          .upload(
            attachment,
            new Blob(["%PDF-1.4\nTest"], { type: "application/pdf" }),
          )
      ).error,
    );
    for (const table of [
      "events",
      "announcements",
      "news_posts",
      "newsletters",
    ]) {
      assert.ifError(
        (
          await member.from(table).insert({
            id,
            title: "Private draft",
            date: localDate(new Date()),
            file_path: attachment,
          })
        ).error,
      );
      assert.equal(
        (await anon.from(table).select("*").eq("id", id)).data?.length,
        0,
      );
      assert.equal(
        (await outsider.from(table).select("*").eq("id", id)).data?.length,
        0,
      );
      assert.ok(
        (await anon.storage.from("community").download(attachment)).error,
      );
      assert.ifError(
        (
          await member
            .from(table)
            .update({ title: "Published item", published: true })
            .eq("id", id)
        ).error,
      );
      assert.equal(
        (await anon.from(table).select("*").eq("id", id)).data?.length,
        1,
      );
      assert.ifError(
        (await anon.storage.from("community").download(attachment)).error,
      );
      const denied = await outsider
        .from(table)
        .update({ title: "Unauthorized edit" })
        .eq("id", id)
        .select("id");
      assert.equal(denied.data?.length ?? 0, 0);
      // Archive instead of delete: a current item cannot be deleted, an archived one is hidden and
      // can be deleted permanently by a "manage people" holder.
      const kept = await member.from(table).delete().eq("id", id).select("id");
      assert.equal(kept.data?.length ?? 0, 0);
      assert.ifError(
        (
          await member
            .from(table)
            .update({ archived_at: new Date().toISOString() })
            .eq("id", id)
        ).error,
      );
      assert.equal(
        (await anon.from(table).select("*").eq("id", id)).data?.length,
        0,
      );
      assert.ok(
        (await anon.storage.from("community").download(attachment)).error,
      );
      const removed = await member
        .from(table)
        .delete()
        .eq("id", id)
        .select("id");
      assert.equal(removed.data?.length, 1);
    }
    const unreferenced = await member.storage
      .from("community")
      .remove([attachment]);
    assert.equal(unreferenced.data?.length, 1, "unused file removed");
    const invalidPrayer = await member
      .from("prayer_settings")
      .update({ confirmed: true })
      .eq("id", 1);
    assert.ok(
      invalidPrayer.error,
      "database rejects incomplete calculation configuration",
    );
    assert.equal(
      (
        await outsider
          .from("prayer_settings")
          .update({ notice: "Unauthorized" })
          .eq("id", 1)
          .select("id")
      ).data?.length,
      0,
    );
    // PR7: visitors read the musallah pin; only an admin moves it; nobody deletes it.
    const pin = await anon
      .from("musallah_location")
      .select("latitude, longitude");
    assert.deepEqual(pin.data, [
      { latitude: 12.0025521, longitude: -61.7723834 },
    ]);
    assert.ok(
      (
        await anon
          .from("musallah_location")
          .update({ latitude: 12.003 })
          .eq("id", 1)
      ).error,
      "visitors cannot move the pin",
    );
    const moved = await member
      .from("musallah_location")
      .update({ latitude: 12.003 })
      .eq("id", 1)
      .select("id");
    assert.equal(moved.data?.length, 1, "an admin moves the pin");
    assert.equal(
      (await member.from("musallah_location").delete().eq("id", 1)).error?.code,
      "42501",
    );
    await owner.query(
      "update public.musallah_location set latitude = 12.0025521 where id = 1",
    );
    // PR5a: the New board term tables are board-only with no delete; an
    // urgent notice is gone from the API at its own end time.
    for (const table of ["handover_steps", "shared_logins"]) {
      assert.equal((await anon.from(table).select("id")).error?.code, "42501");
      assert.equal((await outsider.from(table).select("id")).data?.length, 0);
    }
    const step = await member
      .from("handover_steps")
      .insert({ title: "Backend test step", position: 99 })
      .select("id")
      .single();
    assert.ifError(step.error);
    assert.equal(
      (await member.from("handover_steps").delete().eq("id", step.data.id))
        .error?.code,
      "42501",
    );
    const ended = await member
      .from("announcements")
      .insert({
        title: "Backend urgent test",
        date: localDate(new Date(Date.now() - 2 * 86_400_000)),
        published: true,
        urgent_until: new Date(Date.now() - 60_000).toISOString(),
      })
      .select("id")
      .single();
    assert.ifError(ended.error);
    assert.equal(
      (await anon.from("announcements").select("id").eq("id", ended.data.id))
        .data?.length,
      0,
      "an ended urgent notice is hidden",
    );
    // PR6: visitors read current funds; any board member writes funds and
    // links; links are add-only; a shown fund's category is locked (SGU10).
    assert.equal((await anon.from("seasons").select("id")).data?.length, 3);
    const fund = await member
      .from("payment_items")
      .insert({
        slug: `backend-${randomUUID().slice(0, 8)}`,
        name: "Backend test fund",
        kind: "fund",
        category: "sadaqah",
        listed: true,
        position: 99,
      })
      .select("id, first_shown_at")
      .single();
    assert.ifError(fund.error);
    assert.ok(fund.data.first_shown_at, "listing stamps the lock");
    assert.equal(
      (
        await member
          .from("payment_items")
          .update({ category: "general" })
          .eq("id", fund.data.id)
      ).error?.code,
      "SGU10",
    );
    const product = 900_000_000 + Math.floor(Math.random() * 1_000_000);
    assert.ifError(
      (
        await member
          .from("payment_item_links")
          .insert({ go2pay_product_id: product, payment_item_id: fund.data.id })
      ).error,
    );
    assert.equal(
      (
        await anon
          .from("payment_item_links")
          .select("go2pay_product_id")
          .eq("go2pay_product_id", product)
      ).data?.length,
      1,
    );
    assert.equal(
      (
        await member
          .from("payment_item_links")
          .delete()
          .eq("go2pay_product_id", product)
      ).error?.code,
      "42501",
    );
    assert.equal(
      (
        await anon.from("payment_items").insert({
          slug: "anon",
          name: "Anon",
          kind: "fund",
          category: "general",
          position: 1,
        })
      ).error?.code,
      "42501",
    );
    // Test rows only: the owner removes them (nobody else can delete a step).
    await owner.query(
      "delete from public.payment_item_links where go2pay_product_id = $1",
      [product],
    );
    await owner.query("delete from public.payment_items where id = $1", [
      fund.data.id,
    ]);
    await owner.query("delete from public.handover_steps where id = $1", [
      step.data.id,
    ]);
    await owner.query("delete from public.announcements where id = $1", [
      ended.data.id,
    ]);
    // Deactivation ends the person's sessions on every device (D-15).
    await ensureAdmin(
      helperUser.data.user!.id,
      helperEmail,
      "Backend Test Helper",
      false,
    );
    assert.ifError(
      (
        await helper.auth.signInWithPassword({
          email: helperEmail,
          password: helperPassword,
        })
      ).error,
    );
    const accounts = await member.rpc("admin_accounts");
    assert.ifError(accounts.error);
    const helperAccess = (
      accounts.data as {
        user_id: string;
        person_id: string;
        updated_at: string;
      }[]
    ).find((account) => account.user_id === helperUser.data.user!.id)!;
    const deactivated = await member.rpc("set_access", {
      person: helperAccess.person_id,
      manage_people: false,
      manage_money: false,
      active: false,
      version: helperAccess.updated_at,
    });
    assert.equal(deactivated.data, "ok");
    assert.ok(
      (await helper.auth.refreshSession()).error,
      "a deactivated person's session cannot be refreshed",
    );
    console.log(
      "PASS: real authentication, admin membership, all four collections with archive and permanent delete, anonymous/draft isolation, protected attachments, prayer validation and session revocation.",
    );
    await emailLinkChecks(url, member, client, owner, strongPassword);
    await warningLedgerChecks(url, anon, owner);
  } finally {
    for (const table of [
      "events",
      "announcements",
      "news_posts",
      "newsletters",
    ])
      await secret.from(table).delete().eq("id", id);
    await secret.storage.from("community").remove([attachment]);
    await secret.auth.admin.deleteUser(created.data.user!.id);
    // The helper's People entry goes first (its access row goes with it), so no hidden entry is left.
    await owner.query(
      "delete from public.people where id = (select person_id from public.admins where user_id = $1)",
      [helperUser.data.user!.id],
    );
    await secret.auth.admin.deleteUser(helperUser.data.user!.id);
  }
}

// The local stack's mail catcher (Mailpit, `[inbucket]` in supabase/config.toml).
const mailbox = "http://127.0.0.1:54324";

/** The newest email to `to` with this subject, waiting up to 15 seconds for it to arrive. */
async function newestEmail(to: string, subject: string) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const search = await fetch(
      `${mailbox}/api/v1/search?query=${encodeURIComponent(`to:"${to}" subject:"${subject}"`)}`,
    );
    const found = (await search.json()) as { messages?: { ID: string }[] };
    const id = found.messages?.[0]?.ID;
    if (id) {
      const message = await fetch(`${mailbox}/api/v1/message/${id}`);
      return (await message.json()) as { HTML: string; Subject: string };
    }
    await delay(500);
  }
  throw new Error(`No "${subject}" email arrived for ${to}.`);
}

/** The dashboard link in an invite or reset email: a token hash for the confirm route (D-1). */
function confirmLink(html: string, type: "invite" | "recovery") {
  const href = html.match(/href="([^"]*token_hash=[^"]*)"/)?.[1];
  assert.ok(href, "the email has a token-hash link");
  const link = new URL(href.replaceAll("&amp;", "&"));
  assert.equal(
    `${link.origin}${link.pathname}`,
    "http://localhost:3000/admin/auth/confirm",
  );
  assert.equal(link.searchParams.get("type"), type);
  const tokenHash = link.searchParams.get("token_hash");
  assert.ok(tokenHash);
  return tokenHash;
}

/**
 * PR3 WP-D on the local stack: the invite email (through the app's inviter
 * adapter) and the reset email arrive with token-hash links; following them
 * signs the person in, a password that misses the D-16 rule is refused, a
 * strong one is saved, and a reset ends the person's other sessions (D-15).
 * Deactivation ending every session is checked above.
 */
async function emailLinkChecks(
  url: string,
  manager: SupabaseClient,
  client: () => SupabaseClient,
  owner: pg.Client,
  strongPassword: () => string,
) {
  const email = `invitee-${randomUUID()}@example.invalid`;
  const redirectTo = "http://localhost:3000/admin/auth/confirm";
  const personId = randomUUID();
  const inviter = createSupabaseAccountInviter({
    url,
    secretKey: process.env.SUPABASE_TEST_SECRET_KEY!,
  });
  try {
    assert.deepEqual(
      await inviter.invite(email, redirectTo, {
        fullName: "Backend Invitee",
        invitedBy: "Backend Test Admin",
      }),
      { ok: true, delivery: "email" },
    );
    const invite = await newestEmail(
      email,
      "You're invited to the SGU MSA website dashboard",
    );
    assert.match(invite.HTML, /Assalamu alaikum Backend Invitee\./);
    assert.match(invite.HTML, /Backend Test Admin added you/);
    const inviteToken = confirmLink(invite.HTML, "invite");

    // The grant follows the invite (Design → Invite, step 3).
    const sections = await manager
      .from("people_sections")
      .select("id")
      .is("archived_at", null)
      .limit(1);
    assert.ifError(sections.error);
    assert.ifError(
      (
        await manager.from("people").insert({
          id: personId,
          full_name: "Backend Invitee",
          section_id: (sections.data as { id: string }[])[0].id,
          position: 99,
          show_on_public: false,
        })
      ).error,
    );
    const granted = await manager.rpc("grant_access", {
      person: personId,
      email,
      manage_people: false,
      manage_money: false,
    });
    assert.equal(granted.data, "ok");

    // Following the invite link signs the person in; D-16 decides the password.
    const invitee = client();
    assert.ifError(
      (
        await invitee.auth.verifyOtp({
          token_hash: inviteToken,
          type: "invite",
        })
      ).error,
    );
    const weak = await invitee.auth.updateUser({
      password: "only-lower-case-letters",
    });
    assert.equal(weak.error?.code, "weak_password", "D-16 is enforced");
    const first = strongPassword();
    assert.ifError((await invitee.auth.updateUser({ password: first })).error);
    assert.ok(
      (
        await client().auth.verifyOtp({
          token_hash: inviteToken,
          type: "invite",
        })
      ).error,
      "an invite link works once",
    );
    const otherDevice = client();
    assert.ifError(
      (await otherDevice.auth.signInWithPassword({ email, password: first }))
        .error,
    );

    // Forgot password: the reset link, a new password, other sessions end.
    assert.ifError(
      (await client().auth.resetPasswordForEmail(email, { redirectTo })).error,
    );
    const reset = await newestEmail(
      email,
      "Reset your SGU MSA dashboard password",
    );
    const opener = client();
    assert.ifError(
      (
        await opener.auth.verifyOtp({
          token_hash: confirmLink(reset.HTML, "recovery"),
          type: "recovery",
        })
      ).error,
    );
    const second = strongPassword();
    assert.ifError((await opener.auth.updateUser({ password: second })).error);
    assert.ifError((await opener.auth.signOut({ scope: "others" })).error);
    assert.ok(
      (await otherDevice.auth.refreshSession()).error,
      "a reset signs out the other device",
    );
    assert.ok(
      (await invitee.auth.refreshSession()).error,
      "a reset signs out the invite session",
    );
    assert.ifError((await opener.auth.getUser()).error);
    assert.ok(
      (await client().auth.signInWithPassword({ email, password: first }))
        .error,
      "the old password no longer works",
    );
    assert.ifError(
      (await client().auth.signInWithPassword({ email, password: second }))
        .error,
    );
    console.log(
      "PASS: invite and reset emails with token-hash links, the D-16 password rule, and other sessions ending after a reset.",
    );
  } finally {
    // The People entry goes first (its access row goes with it), then the account.
    await owner.query("delete from public.people where id = $1", [personId]);
    const user = await owner.query(
      "select id from auth.users where email = $1",
      [email],
    );
    if (user.rows[0]) await inviter.deleteAccount(String(user.rows[0].id));
  }
}

/**
 * Daily check WP-4 on the local stack: the Supabase ledger adapter reads and
 * adds rows through the real API with the secret key, a doubled record keeps
 * the first date, and the publishable key sees nothing.
 */
async function warningLedgerChecks(
  url: string,
  anon: SupabaseClient,
  owner: pg.Client,
) {
  const ledger = createSupabaseWarningLedger({
    url,
    secretKey: process.env.SUPABASE_TEST_SECRET_KEY!,
  });
  const key = `iqamah:test-${randomUUID()}`;
  try {
    const empty = await ledger.alreadySent([key]);
    assert.ok("sent" in empty && empty.sent.size === 0);
    assert.deepEqual(
      await ledger.record([{ key, step: "first" }], "2026-10-08"),
      {
        ok: true,
      },
    );
    assert.deepEqual(
      await ledger.record(
        [
          { key, step: "first" },
          { key, step: "last_call" },
        ],
        "2026-10-14",
      ),
      { ok: true },
    );
    const read = await ledger.alreadySent([key, "missing"]);
    assert.ok("sent" in read);
    assert.deepEqual(
      [...read.sent],
      [[key, { first: "2026-10-08", last_call: "2026-10-14" }]],
    );
    const visible = await anon.from("warning_emails_sent").select("*");
    assert.ok(visible.error || visible.data?.length === 0);
    console.log("PASS: daily-check ledger through the API (secret key only).");
  } finally {
    await owner.query(
      "delete from public.warning_emails_sent where warning_key = $1",
      [key],
    );
  }
}

const suites: Record<string, () => Promise<void>> = {
  database: databaseSuite,
  stack: stackSuite,
};
const suite = suites[process.argv[2] ?? ""];
if (!suite) {
  console.error("Choose a suite: database or stack.");
  process.exitCode = 1;
} else {
  suite().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
