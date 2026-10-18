// Guards the agent setup (Claude Code + Codex): MCP config sync, skill
// format and size budgets, portability, and the shared skills symlink.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { load } from "js-yaml";

const SKILLS_DIR = ".agents/skills";
const lineCount = (file: string) =>
  readFileSync(file, "utf8").replace(/\n$/, "").split("\n").length;

const skillNames = () =>
  existsSync(SKILLS_DIR)
    ? readdirSync(SKILLS_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    : [];

type Frontmatter = {
  name?: unknown;
  description?: unknown;
  model?: unknown;
  "allowed-tools"?: unknown;
  metadata?: { vendored?: unknown };
};

const AGENT_ROLES = {
  planner: {
    codexModel: "gpt-6.1-sol",
    claudeModel: "opus",
    description:
      "Plans engineering work and resolves scope before implementation.",
  },
  implementer: {
    codexModel: "gpt-6-luna",
    claudeModel: "sonnet",
    description: "Implements an approved, precise engineering contract.",
  },
  reviewer: {
    codexModel: "gpt-6.1-sol",
    claudeModel: "opus",
    description:
      "Independently reviews implementation correctness, contract compliance, security, and edge cases.",
  },
} as const;

function parseAgentToml(file: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [index, line] of readFileSync(file, "utf8")
    .trim()
    .split(/\r?\n/)
    .entries()) {
    const match = /^([a-z_]+) = ("(?:[^"\\]|\\.)*")$/.exec(line);
    assert.ok(match, `${file}:${index + 1} must be a TOML string field`);
    assert.equal(values[match[1]], undefined, `${file}: duplicate ${match[1]}`);
    values[match[1]] = JSON.parse(match[2]) as string;
  }
  return values;
}

function frontmatter(file: string): Frontmatter {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(
    readFileSync(file, "utf8"),
  );
  assert.ok(match, `${file} must start with YAML frontmatter (--- ... ---)`);
  const data = load(match[1]);
  assert.ok(data && typeof data === "object", `${file} frontmatter is empty`);
  return data as Frontmatter;
}

const isVendored = (fm: Frontmatter) =>
  String(fm.metadata?.vendored ?? "") === "true";

test("Codex MCP config is in sync with .mcp.json", () => {
  const run = spawnSync(
    process.execPath,
    ["scripts/agents/sync-mcp.mjs", "--check"],
    {
      encoding: "utf8",
    },
  );
  assert.equal(run.status, 0, run.stderr || run.stdout);
});

test("native agent adapters route to the three shared roles without policy or permission overrides", () => {
  const codexDir = ".codex/agents";
  const claudeDir = ".claude/agents";
  assert.deepEqual(readdirSync(codexDir).sort(), [
    "implementer.toml",
    "planner.toml",
    "reviewer.toml",
  ]);
  assert.deepEqual(readdirSync(claudeDir).sort(), [
    "implementer.md",
    "planner.md",
    "reviewer.md",
  ]);

  for (const [role, config] of Object.entries(AGENT_ROLES)) {
    const sharedPath = `.agents/roles/${role}.md`;
    assert.ok(existsSync(sharedPath), `${sharedPath} is the canonical role`);

    const codexFile = join(codexDir, `${role}.toml`);
    const codex = parseAgentToml(codexFile);
    assert.deepEqual(Object.keys(codex).sort(), [
      "description",
      "developer_instructions",
      "model",
      "model_reasoning_effort",
      "name",
    ]);
    assert.equal(codex.name, role);
    assert.equal(codex.description, config.description);
    assert.equal(codex.model, config.codexModel);
    assert.equal(codex.model_reasoning_effort, "high");
    assert.equal(
      codex.developer_instructions,
      `Read and follow the shared role instructions in ${sharedPath}.`,
    );

    const claudeFile = join(claudeDir, `${role}.md`);
    const claudeText = readFileSync(claudeFile, "utf8");
    const claude = frontmatter(claudeFile);
    assert.deepEqual(Object.keys(claude).sort(), [
      "description",
      "model",
      "name",
    ]);
    assert.equal(claude.name, role);
    assert.equal(claude.description, config.description);
    assert.equal(claude.model, config.claudeModel);
    assert.equal(
      claudeText.slice(claudeText.indexOf("---", 3) + 3).trim(),
      `Read and follow the shared role instructions in \`${sharedPath}\`.`,
      `${claudeFile} must stay a thin reference to the canonical role`,
    );
  }
});

test("local MCP files stay outside Git", () => {
  for (const file of [".mcp.local.json", ".codex/config.toml"]) {
    const tracked = spawnSync("git", [
      "ls-files",
      "--error-unmatch",
      "--",
      file,
    ]);
    assert.equal(tracked.status, 1, `${file} must not be tracked`);
    const ignored = spawnSync("git", ["check-ignore", "--quiet", "--", file]);
    assert.equal(ignored.status, 0, `${file} must be ignored`);
  }
});

test("local MCP additions cannot weaken shared server definitions", async () => {
  const { mergeServerSources } = await import(syncScript.href);
  const shared = {
    mcpServers: {
      staging: { type: "http", url: "https://example.test?read_only=true" },
    },
  };
  const local = {
    mcpServers: {
      private: { type: "http", url: "https://private.example.test" },
    },
  };
  const merged = mergeServerSources(shared, local);
  assert.deepEqual(Object.keys(merged.mcpServers), ["staging", "private"]);
  assert.deepEqual(Object.keys(shared.mcpServers), ["staging"]);
  assert.throws(
    () =>
      mergeServerSources(shared, {
        mcpServers: { staging: local.mcpServers.private },
      }),
    /must not replace/,
  );
  for (const invalid of [
    null,
    {},
    { mcpServers: [] },
    { mcpServers: { private: null } },
  ])
    assert.throws(() => mergeServerSources(shared, invalid));
});

test("Claude local sync is project-scoped, idempotent and restores failed replacements", async () => {
  const { syncClaudeLocal } = await import(syncScript.href);
  const old = { type: "http", url: "https://old.example.test" };
  const next = { type: "http", url: "https://new.example.test" };
  const calls: string[][] = [];
  const run = (args: string[]) => {
    calls.push(args);
    return { status: 0 };
  };
  syncClaudeLocal({ private: old }, { private: old }, run);
  assert.equal(calls.length, 0, "matching registrations are preserved");
  syncClaudeLocal({ private: next }, {}, run);
  assert.deepEqual(calls[0], [
    "mcp",
    "add-json",
    "--scope",
    "local",
    "private",
    JSON.stringify(next),
  ]);
  calls.length = 0;
  assert.throws(
    () =>
      syncClaudeLocal({ private: next }, { private: old }, (args: string[]) => {
        calls.push(args);
        return { status: args.at(-1) === JSON.stringify(next) ? 1 : 0 };
      }),
    /previous settings preserved/,
  );
  assert.deepEqual(calls[0], ["mcp", "remove", "private", "--scope", "local"]);
  assert.equal(calls.at(-1)?.at(-1), JSON.stringify(old));
  assert.ok(
    calls.every((args) => args.includes("local") && !args.includes("user")),
  );
});

test("sync isolates local additions from shared metadata and rejects tracked local files", () => {
  const root = mkdtempSync(join(tmpdir(), "msa-mcp-"));
  const script = join(root, "scripts/agents/sync-mcp.mjs");
  const skill = join(root, ".agents/skills/example/agents/openai.yaml");
  try {
    mkdirSync(join(root, "scripts/agents"), { recursive: true });
    mkdirSync(join(root, ".agents/skills/example/agents"), { recursive: true });
    copyFileSync("scripts/agents/sync-mcp.mjs", script);
    writeFileSync(
      join(root, ".gitignore"),
      ".mcp.local.json\n.codex/config.toml\n",
    );
    writeFileSync(
      join(root, ".mcp.json"),
      JSON.stringify({
        mcpServers: {
          docs: { type: "http", url: "https://shared.example.test" },
        },
      }),
    );
    writeFileSync(
      join(root, ".mcp.local.json"),
      JSON.stringify({
        mcpServers: {
          private: { type: "http", url: "https://private.example.test" },
        },
      }),
    );
    writeFileSync(
      skill,
      'dependencies:\n  tools:\n    - type: "mcp"\n      value: "docs"\n',
    );
    assert.equal(
      spawnSync("git", ["init", "--quiet"], { cwd: root }).status,
      0,
    );
    const run = () =>
      spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8" });
    assert.equal(run().status, 0);
    const active = readFileSync(join(root, ".codex/config.toml"), "utf8");
    assert.match(active, /private\.example\.test/);
    assert.doesNotMatch(readFileSync(skill, "utf8"), /private/);
    if (process.platform !== "win32")
      assert.equal(
        statSync(join(root, ".codex/config.toml")).mode & 0o777,
        0o600,
      );
    writeFileSync(join(root, ".mcp.local.json"), '{"sensitive-test-marker":');
    const malformed = run();
    assert.equal(malformed.status, 2);
    assert.doesNotMatch(
      malformed.stdout + malformed.stderr,
      /sensitive-test-marker/,
    );
    if (process.platform !== "win32") {
      const activeFile = join(root, ".codex/config.toml");
      const sharedFile = join(root, ".mcp.json");
      const before = readFileSync(sharedFile, "utf8");
      rmSync(activeFile);
      symlinkSync(sharedFile, activeFile);
      const symlinked = run();
      assert.equal(symlinked.status, 2);
      assert.match(symlinked.stderr, /not a symlink/);
      assert.equal(readFileSync(sharedFile, "utf8"), before);
      rmSync(activeFile);
    }
    assert.equal(
      spawnSync("git", ["add", "--force", ".mcp.local.json"], { cwd: root })
        .status,
      0,
    );
    const tracked = run();
    assert.equal(tracked.status, 2);
    assert.match(tracked.stderr, /must be untracked and Git-ignored/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

type RenderDeps = (
  text: string,
  servers: Record<string, unknown>,
) => string | null;
const syncScript = new URL("../scripts/agents/sync-mcp.mjs", import.meta.url);
// A computed specifier keeps the untyped .mjs out of the TypeScript program.
const loadRender = async (): Promise<RenderDeps> =>
  (await import(syncScript.href)).renderSkillDependencies;

test("skill openai.yaml dependency blocks are generated from .mcp.json", async () => {
  const render = await loadRender();
  const servers = {
    web: { type: "http", url: "https://example.test/mcp" },
    tool: { type: "stdio", command: "npx", args: ["-y", "tool@1"] },
  };
  const handWritten = [
    "interface:",
    '  display_name: "Example"',
    "dependencies:",
    "  tools:",
    '    - type: "mcp"',
    '      value: "web"',
    '      description: "Kept as written"',
    '      transport: "streamable_http"',
    '      url: "https://old.test/mcp"',
    "",
  ].join("\n");
  const converted = render(handWritten, servers);
  assert.ok(converted, "a dependencies block is converted");
  assert.match(converted, /^interface:\n {2}display_name: "Example"\n/);
  assert.match(
    converted,
    /# BEGIN generated by npm run agents:sync\n# servers: web\n/,
  );
  assert.match(converted, /description: "Kept as written"/);
  assert.match(converted, /url: "https:\/\/example.test\/mcp"/);
  assert.doesNotMatch(converted, /old\.test/);
  assert.equal(render(converted, servers), converted, "sync is idempotent");

  const added = converted.replace("# servers: web", "# servers: web, tool");
  const regenerated = render(added, servers);
  assert.match(regenerated ?? "", /command: "npx -y tool@1"/);
  assert.notEqual(regenerated, added, "--check reports drift");
  assert.equal(render("interface: {}\n", servers), null);
  for (const dir of skillNames()) {
    const file = join(SKILLS_DIR, dir, "agents", "openai.yaml");
    if (!existsSync(file)) continue;
    const text = readFileSync(file, "utf8");
    if (/^dependencies:/m.test(text))
      assert.match(text, /# BEGIN generated by npm run agents:sync/, file);
    assert.ok(load(text), `${file} must stay valid YAML`);
  }
});

test(".mcp.json keeps safe server settings", () => {
  const servers = JSON.parse(readFileSync(".mcp.json", "utf8")).mcpServers;
  assert.deepEqual(Object.keys(servers).sort(), [
    "chrome-devtools",
    "context7",
    "maestro",
    "magicui",
    "motion",
    "next-devtools",
    "shadcn",
    "supabase",
    "vercel",
  ]);
  // project_ref holds the STAGING project ref, never production.
  const supabase = new URL(servers.supabase.url);
  assert.ok(
    (supabase.searchParams.get("project_ref") ?? "").trim().length > 0,
    "supabase MCP url needs a non-empty project_ref (staging only)",
  );
  assert.equal(supabase.searchParams.has("read_only"), false);
  assert.ok(
    (supabase.searchParams.get("features") ?? "")
      .split(",")
      .includes("database"),
  );
  assert.doesNotMatch(JSON.stringify(servers), /CLAUDE_PROJECT_DIR/);
  assert.equal(new URL(servers.motion.url).pathname.includes("plus"), false);
});

test("agent instruction and skill files stay within size budgets", () => {
  assert.ok(lineCount("AGENTS.md") <= 150, "AGENTS.md must be <= 150 lines");
  for (const name of skillNames()) {
    const skill = join(SKILLS_DIR, name, "SKILL.md");
    if (!existsSync(skill)) continue; // reported by the format test
    const budget = isVendored(frontmatter(skill)) ? 500 : 200;
    assert.ok(
      lineCount(skill) <= budget,
      `${skill} must be <= ${budget} lines`,
    );
    const refs = join(SKILLS_DIR, name, "references");
    if (!existsSync(refs)) continue;
    for (const ref of readdirSync(refs).filter((f) => f.endsWith(".md"))) {
      const file = join(refs, ref);
      const lines = lineCount(file);
      assert.ok(lines <= 150, `${file} must be <= 150 lines (has ${lines})`);
      if (lines > 100)
        assert.match(
          readFileSync(file, "utf8"),
          /^#+\s*(table of )?contents\b/im,
          `${file} is over 100 lines and needs a table of contents`,
        );
    }
  }
});

test("every skill has portable frontmatter", () => {
  for (const name of skillNames()) {
    const skill = join(SKILLS_DIR, name, "SKILL.md");
    assert.ok(existsSync(skill), `${SKILLS_DIR}/${name} has no SKILL.md`);
    const fm = frontmatter(skill);
    assert.equal(fm.name, name, `${skill}: name must equal the folder name`);
    assert.match(name, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${skill}: invalid name`);
    assert.ok(name.length <= 64, `${skill}: name longer than 64 characters`);
    assert.doesNotMatch(name, /claude|anthropic/, `${skill}: reserved word`);
    const description = fm.description;
    assert.ok(
      typeof description === "string" && description.trim().length > 0,
      `${skill}: description is required`,
    );
    assert.ok(description.length <= 1024, `${skill}: description > 1024`);
    assert.doesNotMatch(description, /[<>]/, `${skill}: description has < >`);
    // One format everywhere: a YAML list, one tool (or pattern) per item.
    const tools = fm["allowed-tools"];
    if (tools !== undefined) {
      assert.ok(
        Array.isArray(tools) && tools.length > 0,
        `${skill}: allowed-tools must be a YAML list`,
      );
      for (const tool of tools)
        assert.ok(
          typeof tool === "string" && /^\S(.*\S)?$/.test(tool),
          `${skill}: allowed-tools item ${JSON.stringify(tool)} is invalid`,
        );
    }
  }
});

test("every vendored skill ships a NOTICE", () => {
  for (const name of skillNames()) {
    const skill = join(SKILLS_DIR, name, "SKILL.md");
    if (!existsSync(skill) || !isVendored(frontmatter(skill))) continue;
    assert.ok(
      existsSync(join(SKILLS_DIR, name, "NOTICE")),
      `${SKILLS_DIR}/${name} is vendored and needs a NOTICE file`,
    );
  }
});

test("agent files contain no personal or machine-specific paths", () => {
  const listed = spawnSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "--",
      ".mcp.json",
      ".codex/config.toml",
      "AGENTS.md",
      "CLAUDE.md",
      "README.md",
      ".agents",
      ".claude",
      ".github",
      "docs", // archive included
      "scripts/agents",
      "scripts/emulator",
      "scripts/validate-plan.mjs",
    ],
    { encoding: "utf8" },
  );
  assert.equal(listed.status, 0, listed.stderr);
  const files = listed.stdout.split("\n").filter(Boolean);
  assert.ok(files.includes(".mcp.json"), "expected .mcp.json to be listed");
  const forbidden: [RegExp, string][] = [
    // An absolute /home/<user> path, not a relative one like features/home/.
    [/(^|[\s`'"(=])\/home\//m, "a /home/ path"],
    [/(^|[\s`'"(=])\/Users\/[^/\s]+/m, "a macOS user path"],
    [/(?<![A-Za-z0-9])[A-Za-z]:\\/, "a Windows drive path"],
    [/envolv/i, "another project's name"],
  ];
  const binary = /\.(?:pdf|png|jpe?g|webp|gif|mp4|ico|woff2?)$/i;
  for (const file of files) {
    if (binary.test(file)) continue;
    if (!existsSync(file) || lstatSync(file).isSymbolicLink()) continue;
    const text = readFileSync(file, "utf8");
    for (const [pattern, what] of forbidden)
      assert.doesNotMatch(text, pattern, `${file} contains ${what}`);
  }
});

test("both client skill paths resolve to the neutral canonical directory", () => {
  assert.ok(lstatSync(SKILLS_DIR).isDirectory());
  for (const link of [".claude/skills", ".codex/skills"]) {
    assert.ok(lstatSync(link).isSymbolicLink(), `${link} must be a symlink`);
    assert.equal(readlinkSync(link), "../.agents/skills");
    assert.equal(realpathSync(link), realpathSync(SKILLS_DIR));
  }
});

test("project browser retains only approved cookie domains and disables password saving", async () => {
  const browserScript = new URL(
    "../scripts/agents/browser-mcp.mjs",
    import.meta.url,
  );
  const { browserPreferences } = await import(browserScript.href);
  const prefs = browserPreferences({
    unrelated: "preserved",
    profile: {
      content_settings: {
        exceptions: { cookies: { "[*.]other.test,*": { setting: 1 } } },
      },
    },
  });
  assert.equal(prefs.unrelated, "preserved");
  assert.equal(prefs.credentials_enable_service, false);
  assert.equal(prefs.profile.password_manager_enabled, false);
  assert.equal(prefs.profile.default_content_setting_values.cookies, 4);
  assert.deepEqual(prefs.profile.content_settings.exceptions.cookies, {
    "[*.]github.com,*": { setting: 1 },
    "[*.]supabase.com,*": { setting: 1 },
    "[*.]vercel.com,*": { setting: 1 },
  });
  assert.deepEqual(browserPreferences(prefs), prefs);
  const ignored = spawnSync("git", [
    "check-ignore",
    "--quiet",
    "--",
    ".agents/local/browser-profile",
  ]);
  assert.equal(ignored.status, 0);
  const tracked = spawnSync("git", ["ls-files", "--", ".agents/local"], {
    encoding: "utf8",
  });
  assert.equal(tracked.status, 0);
  assert.equal(tracked.stdout, "");
});
