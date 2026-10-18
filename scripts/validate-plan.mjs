#!/usr/bin/env node
// Structural validator for implementation contracts (planning-engineering-changes skill).
// Usage: node scripts/validate-plan.mjs [--light] <plan.md>
// Exit codes: 0 valid, 1 invalid, 2 usage error.
// It checks structure only; it never replaces an architecture review.
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const FULL_SECTIONS = [
  "Capability",
  "Requested Behavior",
  "Existing System Evidence",
  "Owner",
  "Source of Truth",
  "Reuse and Duplication Analysis",
  "New Abstractions",
  "Product Decisions Required",
  "Decisions",
  "Board Self-Sufficiency Check",
  "Design",
  "Public Contract",
  "Private Implementation",
  "Data and State Flow",
  "Failure Modes",
  "Compatibility and Migration",
  "Parallel Work and Merge Order",
  "Work Packages",
  "Implementation Constraints",
  "Worker Escalation Conditions",
  "Test Strategy",
  "Acceptance Criteria",
  "Open Risks or Escalations",
];

export const LIGHT_SECTIONS = [
  "Capability",
  "Requested Behavior",
  "Existing System Evidence",
  "Owner",
  "Source of Truth",
  "Product Decisions Required",
  "Decisions",
  "Board Self-Sufficiency Check",
  "Implementation Constraints",
  "Test Strategy",
  "Acceptance Criteria",
];

const STATUSES = ["draft", "approved", "done"];

const PLACEHOLDERS = [
  /\bTODO\b/,
  /\bTBD\b/,
  /\bFIXME\b/,
  /<\s*fill[^>]*>/i,
  /<\s*insert[^>]*>/i,
  /\[\s*insert[^\]]*\]/i,
  /\[\s*todo[^\]]*\]/i,
];

const WEAK_PHRASES = [
  "use existing patterns",
  "implement as needed",
  "handle errors appropriately",
  "add tests as needed",
];

const EVIDENCE_TOKENS = [
  "/",
  ".ts",
  ".tsx",
  ".sql",
  ".mjs",
  "repository access",
  "inspection",
  "symbol",
];

const MIN_WORDS = {
  Owner: 4,
  "Source of Truth": 4,
  "Board Self-Sufficiency Check": 8,
  "Test Strategy": 8,
  "Acceptance Criteria": 8,
};

const wordCount = (text) => text.split(/\s+/).filter(Boolean).length;

function parseFrontMatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (!match) return {};
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = /^([A-Za-z_-]+):\s*(.*)$/.exec(line.trim());
    if (pair) fields[pair[1].toLowerCase()] = pair[2].trim();
  }
  return fields;
}

/** Splits the plan into `## Heading` sections (case-insensitive keys). */
function parseSections(text) {
  const sections = new Map();
  let current = null;
  let inFence = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    const heading = !inFence && /^##\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      current = heading[1].trim().toLowerCase();
      if (!sections.has(current)) sections.set(current, []);
      continue;
    }
    if (current) sections.get(current).push(line);
  }
  return new Map(
    [...sections].map(([key, lines]) => [key, lines.join("\n").trim()]),
  );
}

/**
 * Product decisions convention: each decision is a checkbox item.
 * "- [ ]" is unanswered (error). "- [x]" needs an indented "Decision:" line.
 */
function checkProductDecisions(body, issues) {
  if (/^none\b/i.test(body)) return 0;
  const items = [];
  for (const line of body.split(/\r?\n/)) {
    const box = /^\s*[-*]\s+\[( |x|X)\]\s*(.*)$/.exec(line);
    if (box) {
      items.push({ answered: box[1] !== " ", text: box[2], decision: false });
    } else if (items.length && /^\s*Decision:\s*\S/.test(line)) {
      items[items.length - 1].decision = true;
    }
  }
  if (!items.length) {
    issues.push(
      'Product Decisions Required: list each decision as "- [ ] question" (or write "None.").',
    );
    return 0;
  }
  for (const item of items) {
    if (!item.answered)
      issues.push(
        `Product Decisions Required: unanswered decision "${item.text}". Ask the user, then tick it and add a "Decision:" line.`,
      );
    else if (!item.decision)
      issues.push(
        `Product Decisions Required: "${item.text}" is ticked but has no "Decision:" line.`,
      );
  }
  return items.filter((item) => item.answered).length;
}

/** Validates plan text. Returns a list of human-readable issues (empty when valid). */
export function validatePlan(text, options = {}) {
  const issues = [];
  if (typeof text !== "string" || !text.trim()) return ["Plan is empty."];
  const front = parseFrontMatter(text);
  const light = Boolean(options.light) || front.mode === "light";
  if (!front.status)
    issues.push(`Front matter must declare "status: ${STATUSES.join(" | ")}".`);
  else if (!STATUSES.includes(front.status))
    issues.push(
      `Unknown status "${front.status}"; use ${STATUSES.join(", ")}.`,
    );

  const sections = parseSections(text);
  const required = light ? LIGHT_SECTIONS : FULL_SECTIONS;
  const body = (name) => sections.get(name.toLowerCase());
  for (const name of required) {
    const content = body(name);
    if (content === undefined) issues.push(`Missing section: ## ${name}`);
    else if (content.length < 3) issues.push(`Section is empty: ## ${name}`);
  }

  let inFence = false;
  text.split(/\r?\n/).forEach((line, index) => {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    // Template slots such as "<Question for the user>" outside code are unfilled.
    const prose = inFence ? "" : line.replace(/`[^`]*`/g, "");
    const slot = /<(?!https?:|\/|!--)[A-Za-z][^<>]*>/.exec(prose);
    if (slot)
      issues.push(`Line ${index + 1}: unfilled template slot "${slot[0]}"`);
    for (const pattern of PLACEHOLDERS)
      if (pattern.test(line))
        issues.push(`Line ${index + 1}: placeholder text "${line.trim()}"`);
    for (const phrase of WEAK_PHRASES)
      if (line.toLowerCase().includes(phrase))
        issues.push(
          `Line ${index + 1}: vague phrase "${phrase}"; be specific.`,
        );
  });

  const evidence = body("Existing System Evidence");
  if (
    evidence &&
    !EVIDENCE_TOKENS.some((token) => evidence.toLowerCase().includes(token))
  )
    issues.push(
      "Existing System Evidence: cite concrete paths/symbols, or state that repository inspection was impossible.",
    );
  for (const [name, min] of Object.entries(MIN_WORDS)) {
    const content = body(name);
    if (content && content.length >= 3 && wordCount(content) < min)
      issues.push(`${name}: too short (needs at least ${min} words).`);
  }
  const constraints = body("Implementation Constraints");
  if (constraints && !/\b(do not|must not)\b/i.test(constraints))
    issues.push(
      'Implementation Constraints: include explicit "Do not" / "Must not" constraints.',
    );

  const decisions = body("Product Decisions Required");
  if (decisions && decisions.length >= 3) {
    const answered = checkProductDecisions(decisions, issues);
    const record = body("Decisions");
    if (answered && record && /^none\b/i.test(record))
      issues.push(
        'Decisions: answered product decisions must be recorded here, not "None."',
      );
  }
  return issues;
}

function main(argv) {
  const args = argv.filter((arg) => arg !== "--light");
  const light = args.length !== argv.length;
  if (args.length !== 1 || args[0].startsWith("-")) {
    console.error("Usage: node scripts/validate-plan.mjs [--light] <plan.md>");
    return 2;
  }
  const path = args[0];
  let text;
  try {
    if (!statSync(path).isFile()) throw new Error("not a file");
    text = new TextDecoder("utf-8", { fatal: true }).decode(readFileSync(path));
  } catch (error) {
    console.error(
      `PLAN INVALID: 1 issue(s)\n  1. Cannot read ${path} as a UTF-8 file (${error.message}).`,
    );
    return 1;
  }
  const issues = validatePlan(text, { light });
  if (issues.length) {
    console.error(`PLAN INVALID: ${issues.length} issue(s)`);
    issues.forEach((issue, index) => console.error(`  ${index + 1}. ${issue}`));
    return 1;
  }
  console.log(
    `PLAN VALID: ${path}${light ? " (lightweight mode)" : ""}. Structural validation does not replace architecture review.`,
  );
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv.slice(2));
}
