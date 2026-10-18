import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const markdownIn = (dir: string) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((name) => name.endsWith(".md"))
        .map((name) => dir + "/" + name)
    : [];

// Every Markdown file in the repository: tracked plus new, not ignored.
function repositoryMarkdown() {
  const listed = spawnSync(
    "git",
    ["ls-files", "-co", "--exclude-standard", "--", "*.md"],
    { encoding: "utf8" },
  );
  assert.equal(listed.status, 0, listed.stderr);
  return listed.stdout
    .split("\n")
    .filter((file) => file && !file.split("/").includes("node_modules"))
    .filter((file) => existsSync(file));
}

function brokenLocalLinks(file: string) {
  // Ignore fenced and inline code: link-like text there is not a link.
  const text = readFileSync(file, "utf8")
    .replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, "")
    .replace(/`[^`\n]*`/g, "");
  const broken: string[] = [];
  for (const match of text.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const target = match[1].replace(/^<|>$/g, "");
    if (/^(?:[a-z][a-z0-9+.-]*:|#|\/)/i.test(target)) continue;
    const path = resolve(dirname(file), decodeURI(target.split("#")[0]));
    if (!existsSync(path)) broken.push(file + " -> " + target);
  }
  return broken;
}

test("guides stay capped at five distinct audiences", () => {
  assert.equal(
    markdownIn("docs/guides").length,
    5,
    "Extend an existing guide instead of adding competing handoff documents.",
  );
});

test("every Markdown file in the repository has working local links", () => {
  const files = repositoryMarkdown();
  for (const required of ["AGENTS.md", "README.md", "docs/adr/README.md"])
    assert.ok(files.includes(required), "expected " + required + " listed");
  assert.deepEqual(files.flatMap(brokenLocalLinks), [], "broken local links");
});

test("every ADR is indexed, has a valid status and resolvable supersession", () => {
  const adrs = readdirSync("docs/adr").filter((name) =>
    /^\d{4}-[a-z0-9-]+\.md$/.test(name),
  );
  assert.ok(adrs.length > 0, "Expected at least one ADR in docs/adr.");
  const index = readFileSync("docs/adr/README.md", "utf8");
  for (const name of adrs) {
    assert.ok(
      index.includes("(" + name + ")"),
      "docs/adr/README.md must link " + name,
    );
    const text = readFileSync("docs/adr/" + name, "utf8");
    const status = text.match(/^(?:- )?Status: (.+)$/m)?.[1].trim();
    assert.ok(status, name + " needs a Status line");
    const superseded = status.match(/^Superseded by \[?(\d{4})/);
    assert.ok(
      ["Proposed", "Accepted", "Deprecated"].includes(status) || superseded,
      name +
        " has status '" +
        status +
        "'; use Proposed, Accepted, Deprecated or Superseded by NNNN",
    );
    if (superseded) {
      assert.ok(
        adrs.some((other) => other.startsWith(superseded[1] + "-")),
        name + " is superseded by missing ADR " + superseded[1],
      );
    }
  }
});

test("raw reference media is not scattered in the repository root", () => {
  const loose = readdirSync(".").filter((name) =>
    /\.(?:pdf|png|jpe?g|webp|mp4)$/i.test(name),
  );
  assert.deepEqual(
    loose,
    [],
    "Put reference media in docs/archive/assets or approved web assets in public.",
  );
});
