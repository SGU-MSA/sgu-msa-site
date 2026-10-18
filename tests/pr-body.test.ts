import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-expect-error plain .mjs script without types
import { checkPrBody } from "../scripts/check-pr-body.mjs";

const template = readFileSync(".github/pull_request_template.md", "utf8");

const tick = (body: string, label: string) =>
  body.replace(`- [ ] ${label}\n`, `- [x] ${label}\n`);
const fill = (body: string, field: string, text: string) =>
  body.replace(new RegExp(`^${field}:$`, "m"), `${field}: ${text}`);

// A valid body: the simplest answer in every group.
let filled = template;
for (const label of [
  "Docs or process",
  "Developers only",
  "Low",
  "None", // database migration (first "None")
  "Vercel Instant Rollback is enough",
  "No visible change",
]) {
  filled = tick(filled, label);
}
// "None" appears twice (database, hosted settings); tick the second one too.
filled = filled.replace("- [ ] None\n", "- [x] None\n");

const check = (body: string | null) => checkPrBody(body, template) as string[];

test("untouched template fails in every group", () => {
  const problems = check(template);
  assert.equal(problems.length, 7);
});

test("simplest valid body passes", () => {
  assert.deepEqual(check(filled), []);
});

test("CRLF body passes", () => {
  assert.deepEqual(check(filled.replace(/\n/g, "\r\n")), []);
});

test("missing section and null body fail", () => {
  assert.match(check("## Summary\n\nhi")[0], /At a glance/);
  assert.match(check(null)[0], /At a glance/);
});

test("a missing group is reported", () => {
  const body = filled.replace(/### Preview[\s\S]*?(?=## What changed)/, "");
  const problems = check(body);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /Preview/);
});

test("single-choice groups need exactly one box", () => {
  const two = tick(filled, "Fix");
  assert.match(check(two).join("\n"), /Type: tick only one/);
  const none = filled.replace("- [x] Docs or process", "- [ ] Docs or process");
  assert.match(check(none).join("\n"), /Type: tick one option/);
});

test("Who notices accepts several but needs at least one", () => {
  assert.deepEqual(check(tick(filled, "Visitors")), []);
  const none = filled.replace("- [x] Developers only", "- [ ] Developers only");
  assert.match(check(none).join("\n"), /Who notices: tick at least one/);
});

test("Medium or High risk needs Why", () => {
  const medium = tick(filled, "Medium").replace("- [x] Low", "- [ ] Low");
  assert.match(check(medium).join("\n"), /"Medium" needs the "Why:"/);
  assert.deepEqual(check(fill(medium, "Why", "touches sign-in")), []);
  const high = tick(filled, "High").replace("- [x] Low", "- [ ] Low");
  assert.match(check(high).join("\n"), /"High" needs the "Why:"/);
});

test("database migration Yes needs file and both ticks", () => {
  // "Yes" appears in two groups; switch only the first (database) one.
  const body = filled.replace("- [x] None\n- [ ] Yes", "- [ ] None\n- [x] Yes");
  const text = check(body).join("\n");
  assert.match(text, /needs the "File:"/);
  assert.match(text, /"Applied to staging" ticked/);
  assert.match(text, /"Applied to production \(before merge\)" ticked/);
  const done = tick(
    tick(fill(body, "File", "x.sql"), "Applied to staging"),
    "Applied to production (before merge)",
  );
  assert.deepEqual(check(done), []);
});

test("hosted settings Yes needs What and Done", () => {
  const body = filled.replace(
    /(### Hosted settings[\s\S]*?)- \[x\] None\n- \[ \] Yes/,
    "$1- [ ] None\n- [x] Yes",
  );
  const text = check(body).join("\n");
  assert.match(text, /needs the "What:"/);
  assert.match(text, /"Done" ticked/);
  const done = tick(fill(body, "What", "Vercel env var"), "Done");
  assert.deepEqual(check(done), []);
});

test("rollback Needs more needs How", () => {
  const body = tick(filled, "Needs more").replace(
    "- [x] Vercel Instant Rollback is enough",
    "- [ ] Vercel Instant Rollback is enough",
  );
  assert.match(check(body).join("\n"), /needs the "How:"/);
  assert.deepEqual(check(fill(body, "How", "additive migration")), []);
});

test("preview Check these pages needs Pages", () => {
  const body = tick(filled, "Check these pages").replace(
    "- [x] No visible change",
    "- [ ] No visible change",
  );
  assert.match(check(body).join("\n"), /needs the "Pages:"/);
  assert.deepEqual(check(fill(body, "Pages", "/events")), []);
});

test("a broken template fails closed", () => {
  assert.match((checkPrBody(filled, "## Summary") as string[])[0], /template/);
  const noRisk = template.replace("- [ ] High\n", "");
  assert.match((checkPrBody(filled, noRisk) as string[])[0], /High/);
});

test("bot author is skipped, human with empty body fails", () => {
  const dir = mkdtempSync(join(tmpdir(), "prbody-"));
  const event = join(dir, "event.json");
  const run = (type: string) => {
    writeFileSync(
      event,
      JSON.stringify({ pull_request: { body: "", user: { type } } }),
    );
    return spawnSync("node", ["scripts/check-pr-body.mjs"], {
      env: { ...process.env, GITHUB_EVENT_PATH: event },
      encoding: "utf8",
    });
  };
  const bot = run("Bot");
  assert.equal(bot.status, 0);
  assert.match(bot.stdout, /bot/);
  assert.equal(run("User").status, 1);
});
