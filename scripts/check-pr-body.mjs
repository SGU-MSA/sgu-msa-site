#!/usr/bin/env node
// Checks the "At a glance" choices of a pull request description.
// Usage: node scripts/check-pr-body.mjs [body-file]   (default: GITHUB_EVENT_PATH pull_request.body)
// The template (.github/pull_request_template.md) is the only source of the groups,
// options and field names; the rules below say which answers need more detail.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const TEMPLATE_PATH = ".github/pull_request_template.md";

// Rule metadata only. The groups' options come from the template: every
// checkbox in a group is a choice, except the follow-up boxes named in `needs`.
// `many`: more than one choice may be ticked (otherwise exactly one).
// When a choice in `triggers` is ticked, its `fields` need text and its `boxes` a tick.
const RULES = {
  Type: {},
  "Who notices": { many: true },
  Risk: { needs: [{ triggers: ["Medium", "High"], fields: ["Why"] }] },
  "Database migration": {
    needs: [
      {
        triggers: ["Yes"],
        fields: ["File"],
        boxes: ["Applied to staging", "Applied to production (before merge)"],
      },
    ],
  },
  "Hosted settings": {
    needs: [
      {
        triggers: ["Before merge"],
        fields: ["What"],
        boxes: ["Done (before merge only)"],
      },
      { triggers: ["After merge"], fields: ["What"] },
    ],
  },
  Rollback: { needs: [{ triggers: ["Needs more"], fields: ["How"] }] },
  Preview: { needs: [{ triggers: ["Check these pages"], fields: ["Pages"] }] },
};

const norm = (text) =>
  text.replace(/\*\*/g, "").replace(/\s+/g, " ").trim().toLowerCase();

const needsOf = (group) => RULES[group].needs ?? [];
const followUpBoxes = (group) => needsOf(group).flatMap((n) => n.boxes ?? []);
const followUpFields = (group) => needsOf(group).flatMap((n) => n.fields ?? []);

/** Returns Map(group -> { boxes: Map(label -> ticked), fields: Map(name -> text) }), or null if the section is missing. */
export function parseGlance(markdown) {
  const text = markdown.replace(/\r\n/g, "\n").replace(/<!--[\s\S]*?-->/g, "");
  const lines = text.split("\n");
  const start = lines.findIndex((l) => /^##\s+At a glance\s*$/i.test(l));
  if (start === -1) return null;
  const groups = new Map();
  let current = null;
  for (const line of lines.slice(start + 1)) {
    if (/^##\s/.test(line)) break;
    const heading = line.match(/^###\s+(.+?)\s*$/);
    if (heading) {
      current = { name: heading[1], boxes: new Map(), fields: new Map() };
      groups.set(norm(heading[1]), current);
      continue;
    }
    if (!current) continue;
    const box = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.+?)\s*$/);
    if (box) {
      current.boxes.set(norm(box[2]), box[1] !== " ");
      continue;
    }
    const field = line.match(/^\s*([A-Za-z][A-Za-z ]*?):\s*(.*?)\s*$/);
    if (field) current.fields.set(norm(field[1]), field[2]);
  }
  return groups;
}

/** Choices of a template group: its checkboxes except the follow-up ones. */
const choicesOf = (group, templateGroup) => {
  const follow = followUpBoxes(group).map(norm);
  return [...templateGroup.boxes.keys()].filter((l) => !follow.includes(l));
};

/** Problems with the template itself: it and the rules must describe the same groups. */
function templateProblems(template) {
  if (!template)
    return [
      'The pull request template has no "## At a glance" section, so the body cannot be checked.',
    ];
  const out = "The template and the PR body check are out of sync";
  const problems = [];
  for (const group of Object.keys(RULES)) {
    const t = template.get(norm(group));
    if (!t) {
      problems.push(`${out}: the template has no "${group}" group.`);
      continue;
    }
    const choices = choicesOf(group, t);
    if (choices.length === 0)
      problems.push(`${out}: "${group}" has no options in the template.`);
    const labels = [
      ...needsOf(group).flatMap((n) => n.triggers),
      ...followUpBoxes(group),
    ];
    for (const label of labels) {
      if (!t.boxes.has(norm(label)))
        problems.push(
          `${out}: the template's "${group}" group lacks the option "${label}".`,
        );
    }
    const known = followUpFields(group).map(norm);
    for (const field of known) {
      if (!t.fields.has(field))
        problems.push(
          `${out}: the template's "${group}" group lacks its "${field}:" line.`,
        );
    }
    for (const field of t.fields.keys()) {
      if (!known.includes(field))
        problems.push(
          `${out}: the template's "${group}" group has an unknown "${field}:" line.`,
        );
    }
  }
  const ruleNames = Object.keys(RULES).map(norm);
  for (const [key, t] of template) {
    if (!ruleNames.includes(key))
      problems.push(
        `${out}: the template has a group "${t.name}" that the check does not know.`,
      );
  }
  return problems;
}

/** Returns a list of problem messages (empty when the body is acceptable). */
export function checkPrBody(body, templateText) {
  const template = parseGlance(templateText ?? "");
  const broken = templateProblems(template);
  if (broken.length) return broken;
  const parsed = parseGlance(body ?? "");
  if (!parsed) return ['The "## At a glance" section is missing.'];

  const problems = [];
  for (const [name, rule] of Object.entries(RULES)) {
    const group = parsed.get(norm(name));
    if (!group) {
      problems.push(`"${name}" is missing from "At a glance".`);
      continue;
    }
    const choices = choicesOf(name, template.get(norm(name)));
    const ticked = choices.filter((c) => group.boxes.get(c));
    if (ticked.length === 0) {
      problems.push(
        `${name}: tick ${rule.many ? "at least one option" : "one option"}.`,
      );
      continue;
    }
    if (!rule.many && ticked.length > 1) {
      problems.push(`${name}: tick only one option (found ${ticked.length}).`);
      continue;
    }
    for (const need of needsOf(name)) {
      const hit = need.triggers.find((t) => ticked.includes(norm(t)));
      if (!hit) continue;
      for (const field of need.fields ?? []) {
        if (!group.fields.get(norm(field)))
          problems.push(
            `${name}: "${hit}" needs the "${field}:" line filled in.`,
          );
      }
      for (const label of need.boxes ?? []) {
        if (!group.boxes.get(norm(label)))
          problems.push(`${name}: "${hit}" needs "${label}" ticked.`);
      }
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
      '\nFix the "At a glance" choices in the PR description; see the pull request template.',
    );
    process.exit(1);
  }
  console.log("PR body check passed.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
