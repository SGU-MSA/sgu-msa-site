#!/usr/bin/env node
// Checks the "At a glance" choices of a pull request description.
// Usage: node scripts/check-pr-body.mjs [body-file]   (default: GITHUB_EVENT_PATH pull_request.body)
// The template (.github/pull_request_template.md) is the only source of the groups,
// options and field names; the rules below say which answers need more detail.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const TEMPLATE_PATH = ".github/pull_request_template.md";

// min/max: how many choices may be ticked. When `trigger` is ticked, its
// `fields` need text and its `boxes` need a tick.
const RULES = [
  {
    group: "Type",
    choices: ["Feature", "Fix", "Design", "Docs or process"],
    min: 1,
    max: 1,
  },
  {
    group: "Who notices",
    choices: ["Visitors", "Board (dashboard)", "Developers only"],
    min: 1,
    max: 3,
  },
  {
    group: "Risk",
    choices: ["Low", "Medium", "High"],
    min: 1,
    max: 1,
    needs: [{ triggers: ["Medium", "High"], fields: ["Why"], boxes: [] }],
  },
  {
    group: "Database migration",
    choices: ["None", "Yes"],
    min: 1,
    max: 1,
    needs: [
      {
        triggers: ["Yes"],
        fields: ["File"],
        boxes: ["Applied to staging", "Applied to production (before merge)"],
      },
    ],
  },
  {
    group: "Hosted settings",
    choices: ["None", "Before merge", "After merge"],
    min: 1,
    max: 1,
    needs: [
      {
        triggers: ["Before merge"],
        fields: ["What"],
        boxes: ["Done (before merge only)"],
      },
      { triggers: ["After merge"], fields: ["What"], boxes: [] },
    ],
  },
  {
    group: "Rollback",
    choices: ["Vercel Instant Rollback is enough", "Needs more"],
    min: 1,
    max: 1,
    needs: [{ triggers: ["Needs more"], fields: ["How"], boxes: [] }],
  },
  {
    group: "Preview",
    choices: ["No visible change", "Check these pages"],
    min: 1,
    max: 1,
    needs: [{ triggers: ["Check these pages"], fields: ["Pages"], boxes: [] }],
  },
];

const norm = (text) =>
  text.replace(/\*\*/g, "").replace(/\s+/g, " ").trim().toLowerCase();

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
      current = { boxes: new Map(), fields: new Map() };
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

/** Problems with the template itself (it must contain every group, option and field the rules use). */
function templateProblems(template) {
  if (!template)
    return [
      'The pull request template has no "## At a glance" section, so the body cannot be checked.',
    ];
  const problems = [];
  for (const rule of RULES) {
    const group = template.get(norm(rule.group));
    if (!group) {
      problems.push(`The pull request template has no "${rule.group}" group.`);
      continue;
    }
    const wanted = [
      ...rule.choices,
      ...(rule.needs ?? []).flatMap((n) => n.boxes),
    ];
    for (const label of wanted) {
      if (!group.boxes.has(norm(label)))
        problems.push(
          `The template's "${rule.group}" group lacks the option "${label}".`,
        );
    }
    for (const field of (rule.needs ?? []).flatMap((n) => n.fields)) {
      if (!group.fields.has(norm(field)))
        problems.push(
          `The template's "${rule.group}" group lacks the "${field}:" line.`,
        );
    }
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
  for (const rule of RULES) {
    const group = parsed.get(norm(rule.group));
    if (!group) {
      problems.push(`"${rule.group}" is missing from "At a glance".`);
      continue;
    }
    const ticked = rule.choices.filter((c) => group.boxes.get(norm(c)));
    if (ticked.length < rule.min) {
      problems.push(
        `${rule.group}: tick ${rule.max === 1 ? "one option" : "at least one option"}.`,
      );
      continue;
    }
    if (ticked.length > rule.max) {
      problems.push(
        `${rule.group}: tick only one option (found ${ticked.length}).`,
      );
      continue;
    }
    for (const need of rule.needs ?? []) {
      const hit = ticked.find((t) => need.triggers.includes(t));
      if (!hit) continue;
      for (const field of need.fields) {
        if (!group.fields.get(norm(field)))
          problems.push(
            `${rule.group}: "${hit}" needs the "${field}:" line filled in.`,
          );
      }
      for (const label of need.boxes) {
        if (!group.boxes.get(norm(label)))
          problems.push(`${rule.group}: "${hit}" needs "${label}" ticked.`);
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
