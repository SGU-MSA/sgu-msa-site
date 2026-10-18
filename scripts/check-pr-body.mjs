#!/usr/bin/env node
// Fails a pull request whose "At a glance" table was left at the template defaults.
// Usage: node scripts/check-pr-body.mjs [body-file]   (default: GITHUB_EVENT_PATH pull_request.body)
// The template (.github/pull_request_template.md) is the only source of the default values.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const TEMPLATE_PATH = ".github/pull_request_template.md";
const REQUIRED_ROWS = [
  "Type",
  "Who notices",
  "Risk",
  "Database migration",
  "Hosted settings",
  "Rollback",
  "Preview",
];

const clean = (text) => text.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();

/** Returns Map(lowercase label -> value) for the table under "## At a glance", or null if the section is missing. */
export function parseGlance(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const start = lines.findIndex((l) => /^##\s+At a glance\s*$/i.test(l));
  if (start === -1) return null;
  const rows = new Map();
  for (const line of lines.slice(start + 1)) {
    if (/^##\s/.test(line)) break;
    if (!line.trim().startsWith("|")) continue;
    const cells = line
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|");
    if (cells.length < 2) continue;
    const label = clean(cells[0]);
    if (!label || /^[-: ]+$/.test(label)) continue;
    rows.set(label.toLowerCase(), clean(cells.slice(1).join("|")));
  }
  return rows;
}

/** Returns a list of problem messages (empty when the body is acceptable). */
export function checkPrBody(body, template) {
  const rows = parseGlance(body ?? "");
  if (!rows) return ['The "## At a glance" section is missing.'];
  const defaults = parseGlance(template);
  if (!defaults) {
    return [
      'The pull request template has no "## At a glance" section, so the body cannot be checked.',
    ];
  }
  const problems = [];
  for (const name of REQUIRED_ROWS) {
    const key = name.toLowerCase();
    if (!rows.has(key)) {
      problems.push(`"At a glance" row "${name}" is missing.`);
    } else if (rows.get(key) === "") {
      problems.push(`"At a glance" row "${name}" is empty; write the answer.`);
    } else if (rows.get(key) === defaults.get(key)) {
      problems.push(
        `"At a glance" row "${name}" still has the template default; pick the answer that applies.`,
      );
    }
  }
  return problems;
}

function main() {
  const template = readFileSync(TEMPLATE_PATH, "utf8");
  const file = process.argv[2];
  let body;
  if (file) {
    body = readFileSync(file, "utf8");
  } else {
    const path = process.env.GITHUB_EVENT_PATH;
    if (!path) {
      console.error(
        "Usage: node scripts/check-pr-body.mjs <body-file> (or set GITHUB_EVENT_PATH)",
      );
      process.exit(2);
    }
    const pr = JSON.parse(readFileSync(path, "utf8")).pull_request;
    if (!pr) {
      console.log("Not a pull_request event; nothing to check.");
      return;
    }
    if (pr.user?.type === "Bot") {
      console.log("PR author is a bot; skipping the PR body check.");
      return;
    }
    body = pr.body ?? "";
  }
  const problems = checkPrBody(body, template);
  if (problems.length) {
    console.error(
      "PR body check failed:\n" + problems.map((p) => `- ${p}`).join("\n"),
    );
    console.error(
      "\nFill in the table in the PR description; see the pull request template.",
    );
    process.exit(1);
  }
  console.log("PR body check passed.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
