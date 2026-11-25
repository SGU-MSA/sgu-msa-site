// Guards the daily staging keep-awake job (docs/contracts/staging-keep-awake.md).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { load } from "js-yaml";

const raw = readFileSync(".github/workflows/staging-keep-awake.yml", "utf8");
type Workflow = {
  on: { schedule?: { cron: string }[]; workflow_dispatch?: unknown };
  permissions: unknown;
  jobs: Record<string, { steps: { run?: string }[] }>;
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

test("requests no token permissions", () => {
  assert.deepEqual(workflow.permissions, {});
});

test("uses only the staging key secret", () => {
  const used = [...raw.matchAll(/secrets\.([A-Za-z0-9_]+)/g)].map((m) => m[1]);
  assert.ok(used.length > 0);
  assert.deepEqual([...new Set(used)], ["STAGING_SUPABASE_PUBLISHABLE_KEY"]);
});

test("reads the staging project named in .mcp.json", () => {
  const hosts = [...script.matchAll(/https:\/\/([^/\s"']+)/g)].map((m) => m[1]);
  assert.deepEqual(hosts, [`${stagingRef()}.supabase.co`]);
});

test("fails on a bad status and sends no Authorization header", () => {
  assert.ok(script.includes("--fail"));
  assert.ok(!script.includes("Authorization"));
});
