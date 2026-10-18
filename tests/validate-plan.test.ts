import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type Validate = (text: string, options?: { light?: boolean }) => string[];
const script = new URL("../scripts/validate-plan.mjs", import.meta.url);
// A computed specifier keeps the untyped .mjs out of the TypeScript program.
const load = async (): Promise<Validate> =>
  (await import(script.href)).validatePlan;

const lightPlan = `---
status: draft
mode: light
---

# Event speaker field

## Capability

Board-managed speaker name on community events.

## Requested Behavior

Board members can add an optional speaker to an event; the public event page shows it.

## Existing System Evidence

- \`src/lib/community/schema.ts\` recordSchema owns the event shape.
- \`supabase/migrations/202610150001_schema.sql\` defines public.events and its RLS.

## Owner

The community records schema and the admin ContentEditor own this field.

## Source of Truth

The public.events column with a length check constraint; recordSchema mirrors it.

## Product Decisions Required

- [x] Should the speaker appear on the homepage week strip?
  Options: yes; no; only when featured
  Recommendation: no, to keep the strip short
  Decision: D-1

## Decisions

D-1: Speaker shows on the event page only (chosen by the user, 2026-10-02; rejected: homepage, featured only).

## Board Self-Sufficiency Check

Yes. Board members edit the speaker in the existing event editor at /admin/content/events without a developer.

## Implementation Constraints

- Do not add a second Supabase client or a new server action.
- Must not store speakers in content YAML.

## Test Strategy

Extend tests/community.test.ts for the schema length limit and run npm run check before review.

## Acceptance Criteria

- A board member saves a speaker and visitors see it on the event page within a minute.
`;

test("a complete lightweight contract passes", async () => {
  const validate = await load();
  assert.deepEqual(validate(lightPlan), []);
});

test("an empty plan fails", async () => {
  const validate = await load();
  assert.deepEqual(validate("   \n"), ["Plan is empty."]);
});

test("full mode requires every section", async () => {
  const validate = await load();
  const issues = validate(lightPlan.replace("mode: light", "mode: full"));
  assert.ok(issues.includes("Missing section: ## Work Packages"));
});

test("an unanswered product decision fails", async () => {
  const validate = await load();
  const issues = validate(
    lightPlan
      .replace("- [x] Should", "- [ ] Should")
      .replace("  Decision: D-1\n", ""),
  );
  assert.ok(issues.some((issue) => issue.includes("unanswered decision")));
});

test("a ticked decision without a Decision line fails", async () => {
  const validate = await load();
  const issues = validate(lightPlan.replace("  Decision: D-1\n", ""));
  assert.ok(issues.some((issue) => issue.includes('no "Decision:" line')));
});

test("placeholders and template slots fail", async () => {
  const validate = await load();
  const issues = validate(
    lightPlan.replace(
      "Board-managed speaker name on community events.",
      "TODO <The system capability that changes>",
    ),
  );
  assert.ok(issues.some((issue) => issue.includes("placeholder text")));
  assert.ok(issues.some((issue) => issue.includes("unfilled template slot")));
});

test("the CLI exits 0 for valid, 1 for invalid and 2 for usage errors", () => {
  const dir = mkdtempSync(join(tmpdir(), "validate-plan-"));
  const good = join(dir, "good.md");
  const bad = join(dir, "bad.md");
  writeFileSync(good, lightPlan);
  writeFileSync(
    bad,
    lightPlan.replace("Do not", "Avoid").replace("Must not", "Avoid"),
  );
  const run = (...args: string[]) =>
    spawnSync(process.execPath, [fileURLToPath(script), ...args], {
      encoding: "utf8",
    }).status;
  assert.equal(run(good), 0);
  assert.equal(run(bad), 1);
  assert.equal(run(), 2);
});
