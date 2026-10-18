import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { accessRefusals, removeLoginWords } from "../src/features/admin/fields";
import type { Access } from "../src/lib/community/people";

/**
 * "Remove login" (PR5a D-27 e): only for a deactivated login, and only shown
 * to a board member who can manage people; `removeLoginAction` checks both
 * again on the server. The panel imports the server actions, which read the
 * site configuration when loaded, so it is drawn in a fresh Node process
 * with sample settings (as tests/places.test.ts does).
 */
const sample = {
  NODE_ENV: "development" as const,
  SITE_URL: "http://localhost:3000",
  SITE_DEMO_MODE: "true",
  SITE_DEMO_DATE: "2026-10-08T14:00:00Z",
  CRON_SECRET: "off",
};

const login = (state: "invited" | "active" | "deactivated"): Access => ({
  state,
  userId: "00000000-0000-4000-8000-0000000000aa",
  email: "member@example.invalid",
  canManagePeople: false,
  canManageMoney: false,
  version: "2026-10-05T12:00:00.000Z",
});

/** The access panel's HTML for each case, drawn in one Node process. */
function panels(
  cases: readonly { access: Access; canManage: boolean; archived: boolean }[],
): string[] {
  const script = `
    const { createElement } = require("react");
    const { renderToStaticMarkup } = require("react-dom/server");
    const { AccessPanel } = require("./src/features/admin/AccessPanel.tsx");
    const cases = JSON.parse(process.env.PANEL_CASES);
    process.stdout.write(JSON.stringify(cases.map((props) =>
      renderToStaticMarkup(createElement(AccessPanel, {
        personId: "00000000-0000-4000-8000-00000000a002",
        personName: "Maryam Siddiqui",
        locks: { managePeople: null, deactivate: null },
        ...props,
      })))));`;
  const run = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--import",
      "./tests/support/register.mjs",
      "--eval",
      script,
    ],
    {
      env: {
        PATH: process.env.PATH ?? "",
        ...sample,
        PANEL_CASES: JSON.stringify(cases),
      },
      encoding: "utf8",
    },
  );
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout) as string[];
}

test("Remove login shows for a deactivated login, to a manager only (D-27 e)", () => {
  const summary = `<summary>${removeLoginWords.summary}</summary>`;
  const [manager, archived, notManager, invited, active, none] = panels([
    { access: login("deactivated"), canManage: true, archived: false },
    // An archived person's login is off too: it can be removed as well.
    { access: login("deactivated"), canManage: true, archived: true },
    { access: login("deactivated"), canManage: false, archived: false },
    { access: login("invited"), canManage: true, archived: false },
    { access: login("active"), canManage: true, archived: false },
    { access: { state: "none" }, canManage: true, archived: false },
  ]);
  assert.ok(manager.includes(summary));
  assert.ok(manager.includes(removeLoginWords.confirm("Maryam Siddiqui")));
  assert.ok(archived.includes(summary));
  // Someone who cannot manage people never sees it.
  assert.ok(!notManager.includes(removeLoginWords.summary));
  // A login that is still on must be deactivated first.
  for (const html of [invited, active, none])
    assert.ok(!html.includes(removeLoginWords.summary));
});

/**
 * `removeLoginAction` in the sandbox, signed in through a stand-in for
 * `next/headers` (no request outside Next). Returns each result's message
 * and whether the login was still there afterwards.
 */
function removeAttempts(
  attempts: readonly { canManage: boolean; confirmation: string }[],
): { error: string | null; kept: boolean }[] {
  const script = `
    const headers = require.resolve("next/headers");
    const { sandboxStore } = require("./src/lib/demo/store.ts");
    const { demoAdmin } = require("./src/lib/demo/fixtures.ts");
    const store = sandboxStore(new Date(process.env.SITE_DEMO_DATE));
    const session = { get: () => ({ value: store.session }) };
    require.cache[headers] = {
      id: headers, filename: headers, loaded: true,
      exports: { cookies: async () => session, headers: async () => new Headers() },
    };
    const { removeLoginAction } = require("./src/features/admin/access-actions.ts");
    const member = "00000000-0000-4000-8000-0000000000aa";
    const personId = "00000000-0000-4000-8000-00000000a002";
    (async () => {
      const results = [];
      for (const attempt of JSON.parse(process.env.ATTEMPTS)) {
        store.accounts.set(member, { email: "member@example.invalid", last_sign_in_at: null });
        store.admins.set(member, {
          user_id: member, person_id: personId, can_manage_people: false,
          can_manage_money: false, deactivated_at: "2026-10-01T12:00:00.000Z",
          updated_at: "2026-10-01T12:00:00.000Z",
        });
        store.admins.get(demoAdmin.userId).can_manage_people = attempt.canManage;
        const form = new FormData();
        form.set("personId", personId);
        form.set("version", "2026-10-01T12:00:00.000Z");
        form.set("confirmation", attempt.confirmation);
        const result = await removeLoginAction({ error: null, notice: null }, form);
        results.push({ error: result.error, kept: store.admins.has(member) });
      }
      process.stdout.write(JSON.stringify(results));
    })();`;
  const run = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--import",
      "./tests/support/register.mjs",
      "--eval",
      script,
    ],
    {
      env: {
        PATH: process.env.PATH ?? "",
        ...sample,
        ATTEMPTS: JSON.stringify(attempts),
      },
      encoding: "utf8",
    },
  );
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout) as { error: string | null; kept: boolean }[];
}

test("Remove login: the server refuses someone who cannot manage people, and a wrong name (D-27 e)", () => {
  const [notManager, wrongName] = removeAttempts([
    { canManage: false, confirmation: "Maryam Siddiqui" },
    { canManage: true, confirmation: "Someone Else" },
  ]);
  assert.deepEqual(notManager, {
    error: removeLoginWords.forbidden,
    kept: true,
  });
  assert.deepEqual(wrongName, {
    error: removeLoginWords.wrongName,
    kept: true,
  });
});

test("an invite with a permission for someone outside the Executive board is refused before any email is sent (SGU14)", () => {
  const script = `
    const headers = require.resolve("next/headers");
    const { sandboxStore } = require("./src/lib/demo/store.ts");
    const store = sandboxStore(new Date(process.env.SITE_DEMO_DATE));
    const session = { get: () => ({ value: store.session }) };
    require.cache[headers] = {
      id: headers, filename: headers, loaded: true,
      exports: { cookies: async () => session, headers: async () => new Headers() },
    };
    const { inviteAction } = require("./src/features/admin/access-actions.ts");
    (async () => {
      const accounts = store.accounts.size;
      const form = new FormData();
      form.set("personId", "00000000-0000-4000-8000-00000000a004");
      form.set("email", "general@example.invalid");
      form.set("canManageMoney", "on");
      const result = await inviteAction({ error: null, notice: null }, form);
      process.stdout.write(JSON.stringify({
        error: result.error,
        emailed: store.accounts.size !== accounts,
      }));
    })();`;
  const run = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--import",
      "./tests/support/register.mjs",
      "--eval",
      script,
    ],
    { env: { PATH: process.env.PATH ?? "", ...sample }, encoding: "utf8" },
  );
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout), {
    error: accessRefusals.not_executive,
    emailed: false,
  });
});
