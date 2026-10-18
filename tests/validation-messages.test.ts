import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { z } from "../src/lib/validation/zod";
import { ruleMessage, ruleWords } from "../src/lib/validation/messages";
import { collections, recordFormSchema } from "../src/lib/community/schema";
import { contentFieldNames } from "../src/features/admin/fields";
import { personFormSchema } from "../src/lib/community/people";
import { photoListSchema } from "../src/lib/media/photo-list";
import { pageTextKeys } from "../src/lib/content/documents";
import { pageTextSaveSchema } from "../src/lib/content/page-fields";
import { pageSectionsSchema } from "../src/lib/content/schemas";
import { layoutIds, type LayoutKey } from "../src/lib/content/page-layouts";

/**
 * Review fixes P1, item 3: the board never reads a validation library's own
 * text. Every schema the dashboard, the public forms and the content check
 * run is walked with wrong values of every kind, and no message may show a
 * pattern, a field's key, a format name or zod's wording.
 */

/** Text that must never reach the board. */
const technical: readonly [string, RegExp][] = [
  ["a pattern", /\/\^|\$\/|\\d|\[a-z|\{\d+,?\d*\}/],
  [
    "zod's wording",
    /\b(invalid|expected|received|string must|unrecognized)\b/i,
  ],
  ["a format name", /\b(YYYY|uuid|guid|regex|pattern|iso|enum|schema|zod)\b/i],
  ["a JavaScript value", /\b(undefined|null|NaN|object|boolean)\b/],
  // A field's key: snake_case, as in `start_time` or `exception_2_date`.
  ["a field key", /\b[a-z]+(_[a-z0-9]+)+\b/],
];

function technicalPart(message: string): string | null {
  for (const [what, pattern] of technical)
    if (pattern.test(message)) return what;
  return null;
}

// --- Wrong values, built from each schema's own shape ----------------------

type Def = Record<string, unknown> & { type: string };
const defOf = (schema: z.ZodType) =>
  (schema as unknown as { _zod: { def: Def } })._zod.def;

/** Values no box should accept, of every kind. */
const plainWrong: readonly unknown[] = [
  undefined,
  null,
  "",
  " ",
  "x",
  "not a value",
  "x".repeat(30_000),
  "2026-13-45",
  "25:99",
  "javascript:alert(1)",
  "http://example.com",
  0,
  -1,
  1.5,
  1e12,
  Number.NaN,
  true,
  [],
  {},
];

/** Wrong values for `schema`, nested objects and lists included (a few levels deep). */
function wrongFor(schema: z.ZodType, depth = 0): unknown[] {
  if (depth > 5) return [...plainWrong];
  const def = defOf(schema);
  const child = (key: string) => def[key] as z.ZodType;
  switch (def.type) {
    case "optional":
    case "nullable":
    case "default":
    case "prefault":
    case "catch":
    case "readonly":
    case "nonoptional":
      return wrongFor(child("innerType"), depth + 1);
    case "pipe":
      return [
        ...wrongFor(child("in"), depth + 1),
        ...wrongFor(child("out"), depth + 1),
      ];
    case "lazy":
      return wrongFor((def.getter as () => z.ZodType)(), depth + 1);
    case "union":
      return (def.options as z.ZodType[]).flatMap((option) =>
        wrongFor(option, depth + 1).slice(0, plainWrong.length),
      );
    case "intersection":
      return [
        ...wrongFor(child("left"), depth + 1),
        ...wrongFor(child("right"), depth + 1),
      ];
    case "array": {
      const items = wrongFor(child("element"), depth + 1);
      return [
        ...plainWrong,
        ...items.slice(0, plainWrong.length).map((item) => [item]),
        Array.from({ length: 300 }, () => items[0]),
      ];
    }
    case "object": {
      const shape = def.shape as Record<string, z.ZodType>;
      const fields = Object.entries(shape).map(
        ([key, value]) => [key, wrongFor(value, depth + 1)] as const,
      );
      const longest = Math.max(1, ...fields.map(([, values]) => values.length));
      const objects = Array.from({ length: longest }, (_, index) =>
        Object.fromEntries(
          fields.map(([key, values]) => [key, values[index % values.length]]),
        ),
      );
      // An object with one extra key: a page loaded before an update.
      return [...plainWrong, ...objects, { unexpected_key: 1 }];
    }
    case "record":
      return [
        ...plainWrong,
        ...wrongFor(child("valueType"), depth + 1)
          .slice(0, plainWrong.length)
          .map((value) => ({ key: value })),
      ];
    default:
      return [...plainWrong];
  }
}

/** Every message `schema` gives for the wrong values. */
function messagesOf(schema: z.ZodType): Set<string> {
  const messages = new Set<string>();
  for (const value of wrongFor(schema)) {
    let result: ReturnType<z.ZodType["safeParse"]>;
    try {
      result = schema.safeParse(value);
    } catch {
      // A transform that assumes a checked value; not a message.
      continue;
    }
    if (!result.success)
      for (const issue of result.error.issues) messages.add(issue.message);
  }
  return messages;
}

// --- Which schemas -----------------------------------------------------------

/** The modules whose exported schemas the board's forms and content run. */
const schemaModules = [
  "../src/lib/community/schema",
  "../src/lib/community/people",
  "../src/lib/community/payments",
  "../src/lib/community/seasons",
  "../src/lib/community/merch",
  "../src/lib/community/handover",
  "../src/lib/community/order",
  "../src/lib/community/activity",
  "../src/lib/content/schemas",
  "../src/lib/media/photo-list",
  "../src/lib/prayer/adjustments",
  "../src/lib/validation/date-time",
  "../src/lib/backend/password",
  "../src/features/admin/term-export/term-form",
];

const isSchema = (value: unknown): value is z.ZodType =>
  typeof value === "object" && value !== null && "_zod" in value;

async function allSchemas(): Promise<[string, z.ZodType][]> {
  const found: [string, z.ZodType][] = [];
  for (const path of schemaModules) {
    const exports = (await import(path)) as Record<string, unknown>;
    for (const [name, value] of Object.entries(exports))
      if (isSchema(value)) found.push([`${path}#${name}`, value]);
  }
  for (const kind of collections) {
    const names = contentFieldNames(kind);
    for (const chosen of [
      { image: false, file: false },
      { image: true, file: true },
    ])
      found.push([
        `recordFormSchema(${kind})`,
        recordFormSchema(kind, chosen, names, new Date()),
      ]);
  }
  found.push(["personFormSchema(no executive)", personFormSchema(null)]);
  found.push([
    "personFormSchema(executive)",
    personFormSchema(crypto.randomUUID()),
  ]);
  found.push(["photoListSchema", photoListSchema(3)]);
  for (const key of Object.keys(layoutIds) as LayoutKey[])
    found.push([`pageSectionsSchema(${key})`, pageSectionsSchema(key)]);
  for (const key of pageTextKeys)
    found.push([`pageTextSaveSchema(${key})`, pageTextSaveSchema(key)]);
  return found;
}

// --- Tests -------------------------------------------------------------------

test("no schema can show a pattern, a key or zod's own words", async (t) => {
  // Lenient content lists report each dropped entry; not needed here.
  t.mock.method(console, "warn", () => {});
  const schemas = await allSchemas();
  assert.ok(schemas.length > 40, `only ${schemas.length} schemas found`);
  const problems: string[] = [];
  for (const [name, schema] of schemas)
    for (const message of messagesOf(schema)) {
      const what = technicalPart(message);
      if (what) problems.push(`${name}: “${message}” shows ${what}`);
    }
  assert.deepEqual(problems, []);
});

test("every rule zod words itself gets the board's words", () => {
  const issues: Parameters<typeof ruleMessage>[0][] = [
    { code: "invalid_type", expected: "string", input: undefined },
    { code: "invalid_type", expected: "number", input: "abc" },
    { code: "invalid_type", expected: "object", input: 3 },
    { code: "too_small", origin: "string", minimum: 1, input: "" },
    { code: "too_small", origin: "string", minimum: 12, input: "short" },
    { code: "too_small", origin: "array", minimum: 2, input: [] },
    { code: "too_small", origin: "number", minimum: 0, input: -1 },
    { code: "too_big", origin: "string", maximum: 1200, input: "" },
    { code: "too_big", origin: "array", maximum: 5, input: [] },
    { code: "too_big", origin: "number", maximum: 120, input: 500 },
    { code: "invalid_format", format: "regex", input: "x" },
    { code: "invalid_format", format: "email", input: "x" },
    { code: "invalid_format", format: "url", input: "x" },
    { code: "invalid_format", format: "uuid", input: "x" },
    { code: "invalid_format", format: "datetime", input: "x" },
    { code: "invalid_value", values: ["a"], input: "b" },
    { code: "unrecognized_keys", keys: ["b"], input: {} },
    { code: "not_multiple_of", divisor: 1, input: 1.5 },
    { code: "custom", input: 1 },
  ] as Parameters<typeof ruleMessage>[0][];
  for (const issue of issues) {
    const message = ruleMessage(issue);
    assert.equal(technicalPart(message), null, message);
    assert.match(message, /^[A-Z].*\.$/, `a sentence: ${message}`);
  }
  assert.equal(ruleMessage(issues[0]), ruleWords.fillIn);
  assert.equal(ruleMessage(issues[7]), "Use 1,200 characters or fewer.");
  assert.equal(ruleMessage(issues[16]), ruleWords.outOfDate);
});

test("the board's words are installed for every schema", () => {
  const result = z
    .string()
    .regex(/^\d{4}$/)
    .safeParse("abc");
  assert.equal(result.error?.issues[0].message, ruleWords.check);
  assert.equal(
    z.object({ a: z.string() }).safeParse({}).error?.issues[0].message,
    ruleWords.fillIn,
  );
});

test("every file builds its schemas from the project's zod", () => {
  const offenders: string[] = [];
  const walk = (directory: string) => {
    for (const name of readdirSync(directory)) {
      const path = join(directory, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.tsx?$/.test(name)) {
        const text = readFileSync(path, "utf8");
        // Type-only imports carry no rules.
        if (/^import (?!type )[^;]*from "zod";/m.test(text))
          offenders.push(relative(".", path));
      }
    }
  };
  walk("src");
  assert.deepEqual(
    offenders.filter((path) => !path.endsWith("validation/zod.ts")),
    [],
  );
});
