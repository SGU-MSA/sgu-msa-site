import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { dump, load } from "js-yaml";
import {
  editorialDocuments,
  editorialKeys,
  parseEditorialDocument,
  unreadableEditorialDocument,
  type EditorialKey,
} from "../src/lib/content/documents";
import type { EditorialSource } from "../src/lib/content/providers/contract";
import {
  contentDirectory,
  createYamlEditorialSource,
} from "../src/lib/content/providers/yaml";

type RawDocuments = Partial<Record<EditorialKey, unknown>>;

const temporary: string[] = [];
after(() => {
  for (const directory of temporary)
    fs.rmSync(directory, { recursive: true, force: true });
});

/** A YAML adapter over a fresh temporary `content/` folder. */
function yamlSourceWith(
  documents: RawDocuments,
  text: Record<string, string> = {},
) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "editorial-"));
  temporary.push(directory);
  for (const [key, value] of Object.entries(documents))
    fs.writeFileSync(path.join(directory, `${key}.yaml`), dump(value));
  for (const [file, value] of Object.entries(text))
    fs.writeFileSync(path.join(directory, file), value);
  return createYamlEditorialSource(directory);
}

/** Test-only memory adapter, validating through the same documents table. */
function memorySourceWith(documents: RawDocuments): EditorialSource {
  return {
    async get(key) {
      const source = `memory:${key}`;
      const read =
        key in documents
          ? parseEditorialDocument(key, documents[key], source)
          : unreadableEditorialDocument(key, source, "not stored");
      return { ...read, provenance: "live" };
    },
  };
}

/** The repository's documents as raw values, so any adapter can be seeded with them. */
function repositoryDocuments(): RawDocuments {
  return Object.fromEntries(
    editorialKeys.map((key) => [
      key,
      load(fs.readFileSync(path.join(contentDirectory, `${key}.yaml`), "utf8")),
    ]),
  );
}

/**
 * Conformance suite every non-network EditorialSource adapter must pass
 * (ADR 0012): valid documents come back parsed, and an invalid or missing
 * document falls back to its documented fallback with a warning.
 */
function editorialSourceConformance(
  name: string,
  make: (documents: RawDocuments) => EditorialSource,
) {
  test(`${name}: parses every repository document without warnings`, async (t) => {
    const warn = t.mock.method(console, "warn", () => {});
    const source = make(repositoryDocuments());
    for (const key of editorialKeys) {
      const result = await source.get(key);
      assert.equal(result.unavailable, false, key);
      assert.equal(result.provenance, "live", key);
      assert.notEqual(result.document, editorialDocuments[key].fallback, key);
    }
    assert.equal(warn.mock.callCount(), 0);
  });

  test(`${name}: an invalid document falls back with a warning`, async (t) => {
    const warn = t.mock.method(console, "warn", () => {});
    const result = await make({ site: { brand: 42 } }).get("site");
    assert.equal(result.document, editorialDocuments.site.fallback);
    assert.equal(result.unavailable, true);
    assert.equal(result.provenance, "live");
    assert.equal(warn.mock.callCount(), 1);
    assert.match(
      String(warn.mock.calls[0].arguments[0]),
      /site.*did not match its schema; using fallback/,
    );
  });

  test(`${name}: a missing document falls back with a warning`, async (t) => {
    const warn = t.mock.method(console, "warn", () => {});
    const result = await make({}).get("faq");
    assert.equal(result.document, editorialDocuments.faq.fallback);
    assert.equal(result.unavailable, true);
    assert.equal(warn.mock.callCount(), 1);
    assert.match(
      String(warn.mock.calls[0].arguments[0]),
      /faq.*could not be read; using fallback/,
    );
  });
}

editorialSourceConformance("YAML adapter", (documents) =>
  yamlSourceWith(documents),
);
editorialSourceConformance("memory adapter", memorySourceWith);

test("YAML adapter reads every document in the repository's content folder", async (t) => {
  const warn = t.mock.method(console, "warn", () => {});
  const source = createYamlEditorialSource(contentDirectory);
  for (const key of editorialKeys)
    assert.equal((await source.get(key)).unavailable, false, key);
  assert.equal(warn.mock.callCount(), 0);
});

test("YAML adapter falls back on a file that is not valid YAML", async (t) => {
  const warn = t.mock.method(console, "warn", () => {});
  const source = yamlSourceWith({}, { "home.yaml": "hero: [unclosed" });
  const result = await source.get("home");
  assert.equal(result.document, editorialDocuments.home.fallback);
  assert.equal(result.unavailable, true);
  assert.equal(warn.mock.callCount(), 1);
});

test("about.yaml has no team roster; the team list comes from People (D-10)", () => {
  const about = repositoryDocuments().about as Record<string, unknown>;
  assert.equal("advisor" in about, false);
  // No "to be confirmed" line either (review fixes P3).
  assert.deepEqual(Object.keys(about.board as object).sort(), [
    "heading",
    "note",
  ]);
  assert.equal(
    "members" in editorialDocuments.about.fallback.board,
    false,
    "the fallback names nobody",
  );
});
