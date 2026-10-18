import test from "node:test";
import assert from "node:assert/strict";
import type {
  ContentProvider,
  Provenance,
} from "../src/lib/community/providers/contract";
import { createMockContentProvider } from "../src/lib/community/providers/mock";
import {
  collections,
  prayerSettingsSchema,
  recordFromRow,
  recordSchema,
} from "../src/lib/community/schema";

/**
 * Conformance suite every non-network ContentProvider adapter must pass
 * (ADR 0012): each result says whether the source was unavailable and where it
 * came from, and every record and prayer setting is a valid domain value.
 */
function contentProviderConformance(
  name: string,
  make: () => ContentProvider,
  provenance: Provenance,
) {
  test(`${name}: every collection carries unavailable, provenance and valid records`, async () => {
    const provider = make();
    for (const kind of collections) {
      const result = await provider.getRecords(kind);
      assert.equal(typeof result.unavailable, "boolean", kind);
      assert.equal(result.provenance, provenance, kind);
      result.records.forEach((row) => recordSchema.parse(row));
    }
  });
  test(`${name}: prayer settings carry unavailable, provenance and valid settings`, async () => {
    const result = await make().getPrayerSettings();
    assert.equal(typeof result.unavailable, "boolean");
    assert.equal(result.provenance, provenance);
    prayerSettingsSchema.parse(result.settings);
  });
  test(`${name}: the team list carries unavailable, provenance and named people`, async () => {
    const result = await make().getTeam();
    assert.equal(typeof result.unavailable, "boolean");
    assert.equal(result.provenance, provenance);
    for (const section of result.sections) {
      assert.ok(section.id && section.name);
      for (const person of section.people) {
        assert.ok(person.id && person.fullName);
        assert.ok(
          person.photoPath === null || /\.webp$/.test(person.photoPath),
        );
      }
    }
  });
  test(`${name}: an unknown upload is not found, with unavailable and provenance`, async () => {
    const result = await make().getMedia(
      "00000000-0000-4000-8000-000000000000.webp",
    );
    assert.equal(result.file, null);
    assert.equal(result.unavailable, false);
    assert.equal(result.provenance, provenance);
  });
}

const seed = new Date("2026-09-11T12:00:00Z");
contentProviderConformance(
  "sample adapter",
  () => createMockContentProvider(seed),
  "sample",
);

test("sample adapter has deterministic, shared content for the same seed clock", async () => {
  const clock = new Date(seed);
  const a = createMockContentProvider(clock);
  const b = createMockContentProvider(clock);
  clock.setUTCFullYear(2040); // Provider owns its snapshot, not the caller's mutable Date.
  for (const kind of collections) {
    const result = await a.getRecords(kind);
    assert.deepEqual(result, await b.getRecords(kind));
    assert.equal(result.unavailable, false);
    assert.ok(result.records.length);
  }
  assert.deepEqual(await a.getPrayerSettings(), await b.getPrayerSettings());
});

test("recordFromRow reads a null expiry date as never expiring", () => {
  const row = {
    id: "9ccbe714-55b4-438a-af30-a1d6ad511910",
    title: "Community gathering",
    date: "2026-09-09",
    expires_on: null,
    published: true,
    updated_at: "2026-09-01T10:00:00Z",
  };
  const record = recordFromRow(row);
  assert.equal(record.expires_on, "");
  assert.equal(
    recordFromRow({ ...row, expires_on: "2026-09-30" }).expires_on,
    "2026-09-30",
  );
  assert.throws(() => recordFromRow({ ...row, date: null }));
});
