import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type {
  ActivityLog,
  HandoverEditor,
  PeopleEditor,
} from "../src/lib/backend/providers/contract";
import { createSampleHandoverEditor } from "../src/lib/backend/providers/sample-handover";
import {
  createSampleActivityLog,
  createSamplePeopleEditor,
} from "../src/lib/backend/providers/sample-people";
import { activityKinds } from "../src/lib/community/activity";
import { managerShortNotice } from "../src/features/admin/fields";
import { stepLinkLabel, stepPages } from "../src/features/admin/handover/pages";
import {
  lastChangedInFuture,
  loginFromForm,
} from "../src/features/admin/handover/handover-forms";
import {
  dashboardLink,
  handoverProgress,
  handoverStepSchema,
  loginFromRow,
  loginToRow,
  sharedLoginSchema,
  stepFromRow,
  stepToRow,
} from "../src/lib/community/handover";
import { nextPosition } from "../src/lib/community/order";
import {
  managerContinuity,
  MIN_MANAGERS,
  type Access,
} from "../src/lib/community/people";
import { localDate } from "../src/lib/community/schema";
import { demoAdmin } from "../src/lib/demo/fixtures";

// PR5a WP2 (docs/contracts/pr5a-notices-events-continuity.md): New board term
// rules, the manager count, and the HandoverEditor port.

test("progress counts current steps only; a new step goes last", () => {
  const steps = [
    { done_on: "2026-10-01", position: 1 },
    { done_on: "", position: 2 },
    { done_on: "2026-10-02", position: 7 },
    { done_on: "2026-10-02", position: 9, archived_at: "2026-10-03T00:00:00Z" },
  ];
  assert.deepEqual(handoverProgress(steps), { done: 2, total: 3 });
  assert.deepEqual(handoverProgress([]), { done: 0, total: 0 });
  assert.equal(nextPosition(steps), 10);
  assert.equal(nextPosition([]), 1);
});

test("steps and shared logins: the database's checks, and no field for a password or code (D-5)", () => {
  const step = { id: randomUUID(), title: "Hand over the key", position: 7 };
  assert.ok(handoverStepSchema.safeParse(step).success);
  for (const link of ["/admin", "/admin/people", "/admin/prayer-times"])
    assert.ok(handoverStepSchema.safeParse({ ...step, link }).success, link);
  for (const link of [
    "https://example.com",
    "/admin/",
    "/people",
    "/admin/People",
  ])
    assert.ok(!handoverStepSchema.safeParse({ ...step, link }).success, link);
  assert.deepEqual(
    handoverStepSchema
      .safeParse({ ...step, title: "  " })
      .error?.issues.map((issue) => issue.message),
    ["Step: fill in this box."],
  );
  assert.deepEqual(Object.keys(sharedLoginSchema.shape), [
    "id",
    "service",
    "holder_person_id",
    "second_factor_person_id",
    "last_changed_on",
    "note",
  ]);
  assert.deepEqual(
    sharedLoginSchema
      .safeParse({ id: randomUUID(), service: "x".repeat(81) })
      .error?.issues.map((issue) => issue.message),
    ["Account: use 80 characters or fewer."],
  );

  // Empty is "" here and null in the database.
  const stored = { ...step, details: "", link: "", done_on: null };
  assert.equal(stepFromRow(stored).done_on, "");
  assert.equal(stepToRow(stepFromRow(stored)).done_on, null);
  const login = loginFromRow({
    id: randomUUID(),
    service: "MSA Gmail",
    holder_person_id: null,
    second_factor_person_id: null,
    last_changed_on: null,
    note: "",
  });
  assert.deepEqual([login.holder_person_id, login.last_changed_on], ["", ""]);
  const row = loginToRow(login);
  assert.deepEqual(
    [row.holder_person_id, row.second_factor_person_id, row.last_changed_on],
    [null, null, null],
  );
});

test("manager continuity: active manage-people holders, warning below two (D-27)", () => {
  const login = (state: Access["state"], canManagePeople = true): Access =>
    state === "none"
      ? { state }
      : {
          state,
          userId: randomUUID(),
          email: null,
          canManagePeople,
          canManageMoney: false,
          version: "v",
        };
  const person = (access: Access, archived_at: string | null = null) => ({
    archived_at,
    access,
  });
  assert.equal(MIN_MANAGERS, 2);
  assert.deepEqual(managerContinuity([person(login("active"))]), {
    active: 1,
    short: true,
  });
  assert.deepEqual(
    managerContinuity([
      person(login("active")),
      // An invited login counts, as the database guard counts it.
      person(login("invited")),
      person(login("deactivated")),
      person(login("active", false)),
      person(login("none")),
      person(login("active"), "2026-10-01T00:00:00Z"),
    ]),
    { active: 2, short: false },
  );
  assert.deepEqual(managerContinuity([]), { active: 0, short: true });
});

/**
 * Conformance suite for the HandoverEditor port on every non-network adapter
 * set (the Supabase adapter's rules run in `npm run test:db`). Each `make()`
 * returns adapters over a fresh store seeded with the sample steps and logins.
 */
function handoverEditorConformance(
  name: string,
  make: () => {
    handover: HandoverEditor;
    people: PeopleEditor;
    log: ActivityLog;
    today: string;
  },
) {
  test(`${name}: steps in order, edits with the version check, archive and restore, nothing deleted`, async () => {
    const { handover, log } = make();
    const { steps, unavailable } = await handover.listSteps();
    assert.equal(unavailable, false);
    assert.deepEqual(
      steps.map((step) => step.position),
      [1, 2, 3, 4, 5, 6],
    );
    assert.deepEqual(handoverProgress(steps), { done: 2, total: 6 });

    const added = {
      id: randomUUID(),
      title: "Hand over the Musallah key",
      details: "",
      link: "",
      position: nextPosition(steps),
      done_on: "",
    };
    assert.deepEqual(await handover.saveStep(added, null), { ok: true });
    assert.deepEqual(await handover.saveStep(added, null), {
      ok: false,
      reason: "conflict",
    });
    let [last] = (await handover.listSteps()).steps.slice(-1);
    assert.equal(last.title, added.title);
    assert.deepEqual(
      await handover.saveStep({ ...added, done_on: "2026-10-05" }, "stale"),
      { ok: false, reason: "conflict" },
    );
    assert.deepEqual(
      await handover.saveStep(
        { ...added, done_on: "2026-10-05" },
        last.updated_at,
      ),
      { ok: true },
    );
    [last] = (await handover.listSteps()).steps.slice(-1);
    assert.equal(last.done_on, "2026-10-05");

    // Archived steps are read-only until restored.
    assert.deepEqual(await handover.archiveStep(added.id, last.updated_at), {
      ok: true,
    });
    const archived = (await handover.listSteps("archived")).steps;
    assert.deepEqual(
      archived.map((step) => step.id),
      [added.id],
    );
    assert.deepEqual(
      await handover.saveStep(
        { ...added, title: "Changed" },
        archived[0].updated_at,
      ),
      { ok: false, reason: "conflict" },
    );
    assert.deepEqual(
      await handover.restoreStep(added.id, archived[0].updated_at),
      { ok: true },
    );
    assert.equal((await handover.listSteps()).steps.length, 7);
    const { entries } = await log.list({
      limit: 10,
      areas: [...activityKinds.handover.areas],
    });
    assert.deepEqual(
      entries.map((entry) => entry.action),
      ["restored", "archived", "updated", "created"],
    );
  });

  test(`${name}: start a new term clears every current tick, one logged change per ticked step`, async () => {
    const { handover, log } = make();
    const before = (await handover.listSteps()).steps;
    const ticked = before.filter((step) => step.done_on);
    assert.equal(ticked.length, 2);
    const mark = (await log.list({ limit: 1 })).entries[0]?.id ?? 0;
    assert.deepEqual(await handover.startNewTerm(), { ok: true });
    const after = (await handover.listSteps()).steps;
    assert.ok(after.every((step) => step.done_on === ""));
    const logged = (await log.list({ limit: 50 })).entries.filter(
      (entry) => entry.id > mark,
    );
    assert.deepEqual(
      logged.map((entry) => [entry.area, entry.record_id]).sort(),
      ticked.map((step) => ["handover_steps", step.id]).sort(),
    );
    // Nothing ticked: still fine, nothing logged.
    assert.deepEqual(await handover.startNewTerm(), { ok: true });
    assert.equal(
      (await log.list({ limit: 50 })).entries.filter((entry) => entry.id > mark)
        .length,
      2,
    );
  });

  test(`${name}: shared logins name holders from People; a purged holder leaves the box empty`, async () => {
    const { handover, people, today } = make();
    const { logins } = await handover.listLogins();
    assert.equal(logins.length, 2);
    const { sections } = await people.listSections();
    const holder = {
      id: randomUUID(),
      full_name: "Testname Holder",
      role_title: "",
      section_id: sections.find((section) => section.kind === "general")!.id,
      position: 9,
      show_on_public: false,
      photo_path: "",
    } as const;
    assert.deepEqual(await people.savePerson(holder, null), { ok: true });
    const login = {
      id: randomUUID(),
      service: "Go2Pay",
      holder_person_id: holder.id,
      second_factor_person_id: demoAdmin.personId,
      last_changed_on: today,
      note: "",
    };
    assert.deepEqual(
      await handover.saveLogin(
        { ...login, holder_person_id: randomUUID() },
        null,
      ),
      { ok: false, reason: "conflict" },
      "a holder must be in People",
    );
    assert.deepEqual(await handover.saveLogin(login, null), { ok: true });

    // Archived logins are read-only, and still lose a purged holder.
    let saved = (await handover.listLogins()).logins.find(
      (row) => row.id === login.id,
    )!;
    assert.deepEqual(await handover.archiveLogin(login.id, saved.updated_at), {
      ok: true,
    });
    saved = (await handover.listLogins("archived")).logins[0];
    assert.deepEqual(
      await handover.saveLogin({ ...login, note: "Changed" }, saved.updated_at),
      { ok: false, reason: "conflict" },
    );
    let person = (await people.readPerson(holder.id)).person!;
    await people.archivePerson(holder.id, person.updated_at);
    person = (await people.readPerson(holder.id)).person!;
    assert.deepEqual(await people.purgePerson(holder.id, person.updated_at), {
      ok: true,
    });
    saved = (await handover.listLogins("archived")).logins[0];
    assert.deepEqual(
      [saved.holder_person_id, saved.second_factor_person_id],
      ["", demoAdmin.personId],
    );
    assert.deepEqual(await handover.restoreLogin(login.id, saved.updated_at), {
      ok: true,
    });
  });
}

let fresh = Date.parse("2033-01-01T12:00:00Z");
handoverEditorConformance("sample adapters", () => {
  // A new seed is a new sandbox store, so each test starts from the fixtures.
  const seed = new Date((fresh += 1000));
  return {
    handover: createSampleHandoverEditor(seed),
    people: createSamplePeopleEditor(seed),
    log: createSampleActivityLog(seed),
    today: localDate(seed),
  };
});

test("New board term: a step's link reads as its page, and the page list matches the database check", () => {
  for (const [href] of stepPages)
    assert.match(href, dashboardLink, `${href} is a page the database accepts`);
  assert.equal(stepLinkLabel("/admin/people"), "Open People →");
  assert.equal(stepLinkLabel("/admin/prayer-times"), "Open Prayer & iqamah →");
  assert.equal(stepLinkLabel("/admin/something-else"), "Open the page →");
  assert.equal(stepLinkLabel(""), null);
  assert.equal(stepLinkLabel("https://example.com"), null);
});

test("the manager warning names how many people can manage people (D-27)", () => {
  assert.equal(
    managerShortNotice(1),
    "Only 1 active person can manage people. Give a second person Manage people.",
  );
  assert.match(managerShortNotice(0), /^No active person can manage people\./);
});

test("a shared login's Last changed day is today or earlier (review follow-ups, 2026-10-07)", () => {
  const values = { id: randomUUID(), service: "MSA Gmail" };
  const on = (day: string) =>
    loginFromForm({ ...values, last_changed_on: day }, "2026-10-07");
  assert.equal(on("").ok, true);
  assert.equal(on("2026-10-07").ok, true);
  assert.equal(on("2025-01-31").ok, true);
  assert.deepEqual(on("2026-10-08"), {
    ok: false,
    fields: { last_changed_on: lastChangedInFuture },
  });
  // Said as soon as it is typed, even while another box is still empty.
  const unnamed = loginFromForm(
    { id: values.id, service: "", last_changed_on: "2026-10-08" },
    "2026-10-07",
  );
  assert.equal(
    !unnamed.ok && unnamed.fields.last_changed_on,
    lastChangedInFuture,
  );
});
