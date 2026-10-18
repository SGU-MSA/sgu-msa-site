import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createSampleOrderEditor } from "../src/lib/backend/providers/sample-order";
import { createSamplePeopleEditor } from "../src/lib/backend/providers/sample-people";
import { createSampleActivityLog } from "../src/lib/backend/providers/sample-people";
import {
  moveItem,
  nextPosition,
  orderedLists,
  savedOrderSchema,
} from "../src/lib/community/order";
import {
  roleTitleSuggestions,
  STARTER_ROLE_TITLES,
} from "../src/lib/community/people";
import { donateOrder, donateRank } from "../src/lib/community/payment-policy";
import { donateGroupName } from "../src/features/admin/payment-words";

// Review fixes PR-2: dragged lists saved with one "Save order", the team
// groups' role suggestions, and the Funds list's Donate groups.

test("moveItem moves one item and keeps the others in order", () => {
  assert.deepEqual(moveItem(["a", "b", "c", "d"], 3, 0), ["d", "a", "b", "c"]);
  assert.deepEqual(moveItem(["a", "b", "c"], 0, 1), ["b", "a", "c"]);
  assert.deepEqual(moveItem(["a", "b", "c"], 2, 9), ["a", "b", "c"]);
  assert.deepEqual(moveItem(["a", "b"], 5, 0), ["a", "b"]);
});

test("nextPosition puts a new row after every other, archived ones too", () => {
  assert.equal(nextPosition([]), 1);
  assert.equal(nextPosition([{ position: 4 }, { position: 9 }]), 10);
});

test("a saved order: every row once, with a version, at most 500", () => {
  const row = () => ({ id: randomUUID(), version: "v1" });
  const one = row();
  assert.ok(savedOrderSchema.safeParse([one, row()]).success);
  assert.equal(savedOrderSchema.safeParse([]).success, false);
  assert.equal(savedOrderSchema.safeParse([one, one]).success, false);
  assert.equal(
    savedOrderSchema.safeParse([{ id: one.id, version: "" }]).success,
    false,
  );
  assert.equal(
    savedOrderSchema.safeParse(Array.from({ length: 501 }, row)).success,
    false,
  );
});

test("the lists in code are the lists the database function accepts", () => {
  // The latest `save_order`: review fixes P3 added the Lists
  // (202610160002_lists.sql replaces the baseline's function).
  const sql = readFileSync(
    new URL("../supabase/migrations/202610160002_lists.sql", import.meta.url),
    "utf8",
  );
  const named = sql.match(/if list not in \(([^)]*)\)/);
  assert.ok(named);
  assert.deepEqual(
    named[1].split(",").map((name) => name.trim().replaceAll("'", "")),
    [...orderedLists],
  );
});

let fresh = Date.parse("2031-01-01T12:00:00Z");

test("sample Save order: the whole list or nothing; rows in place keep their version; moves are logged", async () => {
  const seed = new Date((fresh += 1000));
  const people = createSamplePeopleEditor(seed);
  const order = createSampleOrderEditor(seed);
  const { sections } = await people.listSections();
  const [executive, general, advisors] = sections;
  const version = (row: (typeof sections)[number]) => ({
    id: row.id,
    version: row.updated_at,
  });

  assert.deepEqual(
    await order.saveOrder("people_sections", [
      version(advisors),
      { id: general.id, version: "stale" },
      version(executive),
    ]),
    { ok: false, reason: "conflict" },
  );
  assert.deepEqual(
    (await people.listSections()).sections.map((row) => row.id),
    [executive.id, general.id, advisors.id],
  );

  assert.deepEqual(
    await order.saveOrder("people_sections", [
      version(general),
      version(executive),
      version(advisors),
    ]),
    { ok: true },
  );
  const after = (await people.listSections()).sections;
  assert.deepEqual(
    after.map((row) => [row.name, row.position]),
    [
      ["General board", 1],
      ["Executive board", 2],
      ["Advisors/Faculty", 3],
    ],
  );
  // Advisors/Faculty was already third: untouched, so open screens stay valid.
  assert.equal(after[2].updated_at, advisors.updated_at);
  const { entries } = await createSampleActivityLog(seed).list({
    limit: 10,
    area: "people_sections",
  });
  assert.equal(entries.length, 2);
});

test("role title suggestions: the founder's list first, then other titles in use, each once", () => {
  assert.deepEqual(
    roleTitleSuggestions([
      { role_title: "President" },
      { role_title: "zakat lead" },
      { role_title: "" },
      { role_title: "Events lead" },
      { role_title: "president " },
    ]),
    [...STARTER_ROLE_TITLES, "Events lead", "zakat lead"],
  );
  assert.ok(STARTER_ROLE_TITLES.includes("T3 rep"));
});

test("Funds list groups follow the Donate page's order; funds are ordered only within one", () => {
  const fund = (
    name: string,
    category: "zakat_al_fitr" | "zakat_al_mal" | "sadaqah" | "general",
    season_id = "",
  ) => ({ name, category, season_id, position: 1 });
  const funds = donateOrder([
    fund("General", "general"),
    fund("Iftar", "sadaqah", randomUUID()),
    fund("Sadaqah", "sadaqah"),
    fund("Fitr", "zakat_al_fitr", randomUUID()),
    fund("Mal", "zakat_al_mal"),
  ]);
  assert.deepEqual(
    funds.map((item) => [item.name, donateRank(item), donateGroupName(item)]),
    [
      ["Fitr", 0, "Zakat al-Fitr"],
      ["Mal", 1, "Zakat al-Mal"],
      ["Iftar", 2, "Funds with a season"],
      ["Sadaqah", 3, "Sadaqah"],
      ["General", 4, "General"],
    ],
  );
});
