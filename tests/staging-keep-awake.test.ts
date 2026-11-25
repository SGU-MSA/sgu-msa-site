// Guards the daily staging keep-awake job (docs/contracts/staging-keep-awake.md).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { load } from "js-yaml";

const WORKFLOW = ".github/workflows/staging-keep-awake.yml";
const raw = readFileSync(WORKFLOW, "utf8");
type Workflow = {
  on: { schedule?: { cron: string }[]; workflow_dispatch?: unknown };
  permissions: unknown;
  jobs: Record<
    string,
    {
      steps: {
        name?: string;
        run?: string;
        if?: string;
        env?: Record<string, string>;
        "continue-on-error"?: unknown;
      }[];
    }
  >;
};
const workflow = load(raw) as Workflow;
const script = Object.values(workflow.jobs)
  .flatMap((job) => job.steps)
  .map((step) => step.run ?? "")
  .join("\n");

const stagingRef = () => {
  const mcp = JSON.parse(readFileSync(".mcp.json", "utf8"));
  const url = new URL(mcp.mcpServers.supabase.url);
  const ref = url.searchParams.get("project_ref");
  assert.ok(ref, "supabase server in .mcp.json names a project_ref");
  return ref;
};

test("runs once a day and by hand", () => {
  assert.equal(workflow.on.schedule?.length, 1);
  assert.ok("workflow_dispatch" in workflow.on);
});

test("requests only the actions write permission", () => {
  assert.deepEqual(workflow.permissions, { actions: "write" });
});

const steps = () => Object.values(workflow.jobs).flatMap((job) => job.steps);

test("renews its own schedule with the run's own token", () => {
  const file = basename(WORKFLOW);
  const renew = steps().find((s) => s.run?.includes("gh api --method PUT"));
  assert.ok(renew, "a step calls gh api --method PUT");
  assert.equal(
    renew.run?.trim(),
    `gh api --method PUT "repos/\${{ github.repository }}/actions/workflows/${file}/enable"`,
  );
  assert.ok(!("continue-on-error" in renew));
  assert.deepEqual(renew.env, { GH_TOKEN: "${{ github.token }}" });
});

test("reads staging even when the renewal fails", () => {
  const read = steps().find((s) => s.run?.includes("curl"));
  assert.equal(read?.if, "always()");
  assert.ok(read?.run?.includes('[ "$status" = 200 ]'));
});

test("has exactly the schedule and manual triggers", () => {
  assert.deepEqual(Object.keys(workflow.on).sort(), [
    "schedule",
    "workflow_dispatch",
  ]);
});

test("uses only the staging key secret", () => {
  const all = [...raw.matchAll(/\bsecrets\b/g)];
  assert.ok(all.length > 0);
  for (const m of all) {
    assert.ok(
      raw
        .slice(m.index + m[0].length)
        .startsWith(".STAGING_SUPABASE_PUBLISHABLE_KEY"),
      "every use of secrets names STAGING_SUPABASE_PUBLISHABLE_KEY",
    );
  }
});

test("contacts only the staging project named in .mcp.json", () => {
  const hosts = [...raw.matchAll(/https?:\/\/([^/\s"']+)/g)].map((m) => m[1]);
  assert.ok(hosts.length > 0);
  for (const host of hosts) assert.equal(host, `${stagingRef()}.supabase.co`);
});

test("runs no third-party actions", () => {
  for (const job of Object.values(workflow.jobs)) {
    for (const step of job.steps) assert.ok(!("uses" in step));
  }
});

test("fails on a bad status and sends no Authorization header", () => {
  assert.ok(script.includes("--fail"));
  assert.ok(!/authorization|bearer/i.test(raw));
});
