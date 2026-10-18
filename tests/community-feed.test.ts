import test from "node:test";
import assert from "node:assert/strict";

import { recordSchema } from "../src/lib/community/schema";
import {
  buildFeed,
  longDate,
  paragraphs,
  type RecordsResult,
} from "../src/features/community/feed";

const record = (id: string, date: string, extra: object = {}) =>
  recordSchema.parse({
    id,
    title: `Update ${id.slice(0, 4)}`,
    date,
    published: true,
    ...extra,
  });
const result = (
  records: ReturnType<typeof record>[],
  extra: Partial<RecordsResult> = {},
): RecordsResult => ({
  records,
  unavailable: false,
  provenance: "live",
  ...extra,
});

const older = record("11111111-1111-4111-8111-111111111111", "2026-09-01");
const newer = record("22222222-2222-4222-8222-222222222222", "2026-10-01");
const featured = record("33333333-3333-4333-8333-333333333333", "2026-08-01", {
  featured: true,
  summary: "Pinned notice",
});

test("the lead story is the featured update, then the newest", () => {
  const feed = buildFeed(result([older, featured]), result([newer]));
  assert.deepEqual(
    feed.items.map((item) => item.id),
    [featured.id, newer.id, older.id],
  );
  assert.equal(feed.items[0].kind, "Announcement");
  assert.equal(feed.items[0].href, `/community/announcements/${featured.id}`);
  assert.equal(feed.items[0].excerpt, "Pinned notice");
  assert.equal(feed.items[1].kind, "Community news");
  // Without a feature, the newest leads.
  assert.equal(
    buildFeed(result([older]), result([newer])).items[0].id,
    newer.id,
  );
});

test("empty only when both reads worked; one failed read keeps the rest", () => {
  assert.equal(buildFeed(result([]), result([])).empty, true);
  const partial = buildFeed(result([], { unavailable: true }), result([newer]));
  assert.equal(partial.unavailable, true);
  assert.equal(partial.empty, false);
  assert.deepEqual(
    partial.items.map((item) => item.id),
    [newer.id],
  );
  const down = buildFeed(
    result([], { unavailable: true }),
    result([], { unavailable: true }),
  );
  assert.equal(down.empty, false);
});

test("covers: uploaded photo, otherwise none, in the sandbox too", () => {
  const photo = record("44444444-4444-4444-8444-444444444444", "2026-10-02", {
    image_path: "55555555-5555-4555-8555-555555555555.webp",
    image_alt: "The hall",
  });
  const live = buildFeed(result([photo, older]), result([]));
  assert.deepEqual(live.items[0].cover, {
    src: "/media/55555555-5555-4555-8555-555555555555.webp",
    alt: "The hall",
  });
  assert.equal(live.items[1].cover, null);
  const sample = buildFeed(
    result([older], { provenance: "sample" }),
    result([]),
  );
  assert.equal(sample.items[0].cover, null);
});

test("dates and paragraphs print as the post pages show them", () => {
  assert.equal(longDate("2026-10-03"), "3 October 2026");
  assert.equal(longDate("soon"), "soon");
  assert.deepEqual(paragraphs("One\n\nTwo\nlines"), ["One", "Two\nlines"]);
});
