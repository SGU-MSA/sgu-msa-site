import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
  categoryTone,
  groupLists,
  listWords,
  nameTaken,
  optionsWithItems,
  resourceCategoriesInUse,
  slugFor,
} from "../src/lib/community/lists";
import { eventEntry } from "../src/lib/community/event-entry";
import { recordSchema } from "../src/lib/community/schema";
import { createSampleContentEditor } from "../src/lib/backend/providers/sample";
import {
  filterResources,
  newsletterButton,
} from "../src/features/resources/library";

// Review fixes P3: the Lists (event categories, terms, resource categories).

test("a new option's slug comes from its name, once, and never repeats in its list", () => {
  assert.equal(slugFor("2026 Fall", []), "2026-fall");
  assert.equal(slugFor("Incoming students", []), "incoming-students");
  assert.equal(slugFor("Ramaḍān", []), "ramadan");
  assert.equal(slugFor("Guide", ["guide", "guide-2"]), "guide-3");
  assert.equal(slugFor("!!!", []), "option");
});

test("one name per list, whatever its case or spaces; the option itself may keep it", () => {
  const options = [{ id: "a", name: "Faith" }];
  assert.equal(nameTaken(options, " faith "), true);
  assert.equal(nameTaken(options, "Faith", "a"), false);
  assert.equal(nameTaken(options, "Social"), false);
});

test("the plan's words for an option in use", () => {
  assert.equal(
    listWords.usedBy(3, "event"),
    "Used by 3 events. Move them first.",
  );
  assert.equal(
    listWords.usedBy(1, "resource"),
    "Used by 1 resource. Move them first.",
  );
});

test("filters show only the options with items, in the board's order", () => {
  const lists = groupLists([
    { id: randomUUID(), list: "terms", name: "B", slug: "b", position: 2 },
    { id: randomUUID(), list: "terms", name: "A", slug: "a", position: 1 },
    { id: randomUUID(), list: "terms", name: "C", slug: "c", position: 3 },
  ]);
  assert.deepEqual(
    lists.terms.map((option) => option.slug),
    ["a", "b", "c"],
  );
  assert.deepEqual(
    optionsWithItems(lists.terms, new Set(["c", "a"])).map((o) => o.slug),
    ["a", "c"],
  );
  // The five colours, again after five.
  assert.equal(categoryTone(0), "msa");
  assert.equal(categoryTone(5), "msa");
  assert.equal(categoryTone(6), "academic");
});

test("an event shows its category and term by name; none shows nothing", () => {
  const category = {
    id: randomUUID(),
    list: "event_categories" as const,
    name: "Faith",
    slug: "faith",
    position: 1,
  };
  const term = {
    id: randomUUID(),
    list: "terms" as const,
    name: "2026 Fall",
    slug: "2026-fall",
    position: 1,
  };
  const lists = groupLists([category, term]);
  const record = recordSchema.parse({
    id: randomUUID(),
    title: "Qur'an night",
    date: "2026-10-20",
    category_id: category.id,
    term_id: term.id,
  });
  const entry = eventEntry(record, lists);
  assert.deepEqual(
    [
      entry.category,
      entry.category_name,
      entry.category_tone,
      entry.term,
      entry.term_name,
    ],
    ["faith", "Faith", "msa", "2026-fall", "2026 Fall"],
  );
  const none = eventEntry({ ...record, category_id: "", term_id: "" }, lists);
  assert.deepEqual([none.category_name, none.term_name], [null, null]);
});

test("resources: the categories in use, and search by the category's name", () => {
  assert.deepEqual(
    [
      ...resourceCategoriesInUse({
        items: [{ category: "guide" }, { category: "" }, {}],
      }),
    ],
    ["guide"],
  );
  const resources = [
    { id: "a", title: "Jumu’ah", category: "guide", description: "Times" },
    {
      id: "b",
      title: "Route",
      category: "incoming-students",
      description: "Walk",
    },
  ].map((item) => ({ ...item, archived: false }));
  const categories = [{ slug: "guide", name: "Guide" }];
  assert.deepEqual(
    filterResources(resources, "all", "guide", categories).map((r) => r.id),
    ["a"],
  );
});

test("a newsletter's button says what it opens", () => {
  assert.equal(newsletterButton("/media/1.pdf"), "Open PDF");
  assert.equal(newsletterButton("/media/1.webp"), "View image");
  assert.equal(
    newsletterButton("https://example.org/issue.PNG?x=1"),
    "View image",
  );
  assert.equal(newsletterButton("https://example.org/issue"), "Visit link");
});

test("sandbox: add, rename and delete options as the database does", async () => {
  const editor = createSampleContentEditor(new Date("2031-05-01T12:00:00Z"));
  const { options } = await editor.listOptions();
  const faith = options.find(
    (o) => o.list === "event_categories" && o.slug === "faith",
  )!;
  const id = randomUUID();
  assert.deepEqual(
    await editor.saveListOption(
      { id, list: "terms", name: "2028 Fall", slug: "2028-fall", position: 9 },
      null,
    ),
    { ok: true },
  );
  // The same name again in that list is refused.
  assert.deepEqual(
    await editor.saveListOption(
      {
        id: randomUUID(),
        list: "terms",
        name: "2028 fall",
        slug: "2028-fall-2",
        position: 10,
      },
      null,
    ),
    { ok: false, reason: "name_taken" },
  );
  const added = (await editor.listOptions()).options.find((o) => o.id === id)!;
  assert.deepEqual(
    await editor.saveListOption(
      { ...added, name: "Fall 2028" },
      added.updated_at,
    ),
    { ok: true },
  );
  const renamed = (await editor.listOptions()).options.find(
    (o) => o.id === id,
  )!;
  assert.equal(renamed.slug, "2028-fall", "the slug stays");
  assert.deepEqual(await editor.deleteListOption(id, renamed.updated_at), {
    ok: true,
  });
  // A sample event uses Faith.
  assert.deepEqual(await editor.deleteListOption(faith.id, faith.updated_at), {
    ok: false,
    reason: "in_use",
  });
});
