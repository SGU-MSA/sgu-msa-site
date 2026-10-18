import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-expect-error plain .mjs script without types
import { checkPrBody } from "../scripts/check-pr-body.mjs";

const template = readFileSync(".github/pull_request_template.md", "utf8");

const filled = template
  .replace("Feature · Fix · Design · Docs/process", "Docs/process")
  .replace("Visitors · Board (dashboard) · Developers only", "Developers only")
  .replace("Low · Medium · High: one line why", "Low: template text only")
  .replace(/None · Yes: file\.sql[^|]*/, "None ")
  .replace("None · list (Vercel/Supabase), done ☐", "None")
  .replace(
    /Vercel Instant Rollback is enough · Needs more[^|]*/,
    "Vercel Instant Rollback is enough ",
  )
  .replace(
    "Vercel posts the link; pages to check: …",
    "Vercel posts the link; pages to check: none",
  );

test("template defaults fail", () => {
  const problems = checkPrBody(template, template) as string[];
  assert.equal(problems.length, 7);
});

test("filled body passes", () => {
  assert.deepEqual(checkPrBody(filled, template), []);
});

test("missing section fails", () => {
  const problems = checkPrBody("## Summary\n\nhi", template) as string[];
  assert.match(problems[0], /At a glance/);
});

test("missing row fails", () => {
  const body = filled.replace(/^\| \*\*Risk\*\*.*$/m, "");
  const problems = checkPrBody(body, template) as string[];
  assert.equal(problems.length, 1);
  assert.match(problems[0], /Risk/);
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

test("CRLF body passes", () => {
  assert.deepEqual(checkPrBody(filled.replace(/\n/g, "\r\n"), template), []);
});

test("null body fails", () => {
  const problems = checkPrBody(null, template) as string[];
  assert.match(problems[0], /At a glance/);
});

test("blank cell fails as empty", () => {
  const body = filled.replace(/^(\| \*\*Risk\*\*\s*\|).*$/m, "$1  |");
  const problems = checkPrBody(body, template) as string[];
  assert.equal(problems.length, 1);
  assert.match(problems[0], /empty/);
});

test("template without the section fails closed", () => {
  const problems = checkPrBody(filled, "## Summary") as string[];
  assert.match(problems[0], /template/);
});
