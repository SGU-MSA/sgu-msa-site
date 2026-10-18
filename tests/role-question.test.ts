import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { roleTakenWords } from "../src/features/admin/fields";
import type { RoleHolder } from "../src/lib/community/people";

/**
 * "Omar Haddad is President. Make <name> President instead?" (user,
 * 2026-10-06: one current person per Executive board role). The person form
 * asks under Role when the chosen role is taken; the sandbox end-to-end test
 * answers it. The form imports the server actions, which read the site
 * configuration when loaded, so it is drawn in a fresh Node process with
 * sample settings (as tests/remove-login.test.ts does).
 */
const sample = {
  NODE_ENV: "development" as const,
  SITE_URL: "http://localhost:3000",
  SITE_DEMO_MODE: "true",
  SITE_DEMO_DATE: "2026-10-08T14:00:00Z",
  CRON_SECRET: "off",
};

const executive = "00000000-0000-4000-8000-00000000c001";
const general = "00000000-0000-4000-8000-00000000c002";
const yusuf = "00000000-0000-4000-8000-00000000a004";
const maryam: RoleHolder = {
  id: "00000000-0000-4000-8000-00000000a011",
  name: "Maryam Siddiqui",
  role: "Treasurer",
  version: "2026-10-05T12:00:00.000Z",
  stays: null,
};

type Case = {
  role: string;
  section: string;
  holders: RoleHolder[];
  canManagePeople: boolean;
};

/** The person form's HTML for each case, drawn in one Node process. */
function forms(cases: readonly Case[]): string[] {
  const script = `
    const { createElement } = require("react");
    const { renderToStaticMarkup } = require("react-dom/server");
    const { PersonEditor } = require("./src/features/admin/PersonEditor.tsx");
    const cases = JSON.parse(process.env.FORM_CASES);
    process.stdout.write(JSON.stringify(cases.map((props) =>
      renderToStaticMarkup(createElement(PersonEditor, {
        id: ${JSON.stringify(yusuf)},
        person: {
          id: ${JSON.stringify(yusuf)},
          full_name: "Yusuf Ibrahim",
          role_title: props.role,
          section_id: props.section,
          position: 1,
          show_on_public: false,
          photo_path: "",
        },
        version: "2026-10-05T12:00:00.000Z",
        groups: [
          { id: ${JSON.stringify(executive)}, name: "Executive board", shownByDefault: true, kind: "executive" },
          { id: ${JSON.stringify(general)}, name: "General board", shownByDefault: false, kind: "general" },
        ],
        roleTitles: [],
        roleHolders: props.holders,
        canManagePeople: props.canManagePeople,
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
        FORM_CASES: JSON.stringify(cases),
      },
      encoding: "utf8",
    },
  );
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout) as string[];
}

/** React escapes apostrophes and quotes in text. */
const html = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("'", "&#x27;");

test("the person form asks before taking an Executive board role from its holder, and says when it cannot", () => {
  const taken = {
    role: "Treasurer",
    section: executive,
    canManagePeople: true,
  };
  const [asked, free, otherGroup, self, last, notManager] = forms([
    { ...taken, holders: [maryam] },
    { ...taken, role: "Secretary", holders: [maryam] },
    { ...taken, section: general, holders: [maryam] },
    { ...taken, holders: [{ ...maryam, stays: "self" }] },
    { ...taken, holders: [{ ...maryam, stays: "last_manager" }] },
    { ...taken, canManagePeople: false, holders: [maryam] },
  ]);
  const question = roleTakenWords.question(
    "Maryam Siddiqui",
    "Treasurer",
    "Yusuf Ibrahim",
  );
  assert.equal(
    question,
    "Maryam Siddiqui is Treasurer. Make Yusuf Ibrahim Treasurer instead?",
  );
  const yes = `>${roleTakenWords.yes}</button>`;
  const cancel = `>${roleTakenWords.cancel}</button>`;
  assert.ok(asked.includes(question));
  assert.ok(asked.includes(roleTakenWords.explain("Maryam Siddiqui")));
  assert.ok(asked.includes(yes) && asked.includes(cancel));
  // Nothing is handed over until Yes.
  assert.ok(!asked.includes('name="replace_holder"'));
  assert.ok(asked.includes('name="role_question" value="open"'));
  // A free role, or a role title in another group, asks nothing.
  for (const quiet of [free, otherGroup]) {
    assert.ok(!quiet.includes("role-question"));
    assert.ok(!quiet.includes(yes));
  }
  // The holder stays: only the reason and Cancel.
  for (const [form, reason] of [
    [self, roleTakenWords.self],
    [last, roleTakenWords.last_manager("Maryam Siddiqui")],
    [notManager, roleTakenWords.forbidden],
  ] as const) {
    assert.ok(
      form.includes(roleTakenWords.taken("Maryam Siddiqui", "Treasurer")),
    );
    assert.ok(form.includes(html(reason)), reason);
    assert.ok(!form.includes(yes) && form.includes(cancel));
    assert.ok(form.includes('name="role_question" value="blocked"'));
  }
});

test("a new person's question names them as typed, or 'this person'", () => {
  assert.equal(
    roleTakenWords.question("Omar Haddad", "President", ""),
    "Omar Haddad is President. Make this person President instead?",
  );
  assert.equal(
    roleTakenWords.question("Omar Haddad", "President", "Sara Malik"),
    "Omar Haddad is President. Make Sara Malik President instead?",
  );
});
