import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type {
  AccountInviter,
  PeopleEditor,
  VersionedPerson,
} from "../src/lib/backend/providers/contract";
import { offAccountInviter } from "../src/lib/backend/providers/off-inviter";
import {
  createSampleAccountInviter,
  createSamplePeopleEditor,
} from "../src/lib/backend/providers/sample-people";
import type { ContentProvider } from "../src/lib/community/providers/contract";
import { createMockContentProvider } from "../src/lib/community/providers/mock";
import {
  accessChangeProblem,
  accessFrom,
  accessLocks,
  clearsOnlyPhoto,
  EXECUTIVE_ROLES,
  EXECUTIVE_TIERS,
  executiveTiers,
  executivesWithoutPhoto,
  groupTeam,
  listedPublicly,
  photoAllowed,
  shownPhoto,
  inGroupOrder,
  leavesExecutive,
  permissionsProblem,
  personFormSchema,
  personSchema,
  publicTeamRows,
  roleHolder,
  roleHolders,
  touchesExecutive,
  STARTER_ROLE_TITLES,
  type Access,
  type AccessHolder,
  type Person,
} from "../src/lib/community/people";
import { demoAdmin } from "../src/lib/demo/fixtures";

const sectionId = randomUUID();
const base = {
  id: randomUUID(),
  full_name: "Test Person",
  section_id: sectionId,
  position: 1,
};

test("personSchema: “Show on public page?” must be answered, with no default", () => {
  assert.equal(personSchema.safeParse(base).success, false);
  const answered = personSchema.parse({ ...base, show_on_public: false });
  assert.equal(answered.show_on_public, false);
  assert.equal(answered.role_title, "");
  assert.equal(answered.photo_path, "");
});

test("personSchema: listing and a photo need no consent record (review 2)", () => {
  const listed = personSchema.parse({
    ...base,
    show_on_public: true,
    photo_path: `${randomUUID()}.webp`,
    // Old consent columns are gone: anything posted is dropped.
    listing_consent_on: "2026-09-01",
  });
  assert.equal(listed.show_on_public, true);
  assert.ok(!("listing_consent_on" in listed));
});

test("personFormSchema: the Executive board takes only its five roles, in other groups any title", () => {
  const executive = randomUUID();
  const row = (section_id: string, role_title: string) => ({
    ...base,
    section_id,
    role_title,
    show_on_public: true,
  });
  for (const role of EXECUTIVE_ROLES)
    assert.equal(
      personFormSchema(executive).safeParse(row(executive, role)).success,
      true,
      role,
    );
  const refused = personFormSchema(executive).safeParse(
    row(executive, "Musallah coordinator"),
  );
  assert.equal(refused.success, false);
  assert.equal(refused.error!.issues[0].path.join("."), "role_title");
  assert.match(refused.error!.issues[0].message, /Executive board roles/);
  assert.equal(
    personFormSchema(executive).safeParse(row(executive, "")).success,
    false,
    "no role",
  );
  assert.equal(
    personFormSchema(executive).safeParse(row(sectionId, "Anything")).success,
    true,
  );
  // Groups unknown: the database still decides.
  assert.equal(
    personFormSchema(null).safeParse(row(executive, "Anything")).success,
    true,
  );
});

test("EXECUTIVE_ROLES lead the role suggestions and match the database list", async () => {
  assert.deepEqual(STARTER_ROLE_TITLES.slice(0, 5), [...EXECUTIVE_ROLES]);
  const { readFile } = await import("node:fs/promises");
  const sql = await readFile(
    "supabase/migrations/202610150001_schema.sql",
    "utf8",
  );
  const listed =
    /executive_roles\(\)[^$]*\$\$\s*select array\[([^\]]*)\]/.exec(sql)?.[1] ??
    "";
  assert.deepEqual(
    [...listed.matchAll(/'([^']*)'/g)].map((match) => match[1]),
    [...EXECUTIVE_ROLES],
  );
});

test("inGroupOrder: the Executive board by role, other groups by the dragged order", () => {
  const person = (full_name: string, role_title: string, position: number) => ({
    full_name,
    role_title,
    position,
  });
  const people = [
    person("Zed", "Secretary", 1),
    person("Amy", "Treasurer", 2),
    person("Bob", "President", 3),
    person("Cat", "Vice President (Sisters)", 4),
    person("Dan", "Vice President (Brothers)", 5),
  ];
  assert.deepEqual(
    inGroupOrder("executive", people).map((entry) => entry.role_title),
    [...EXECUTIVE_ROLES],
  );
  assert.deepEqual(
    inGroupOrder("general", people).map((entry) => entry.full_name),
    ["Zed", "Amy", "Bob", "Cat", "Dan"],
  );
  assert.deepEqual(
    inGroupOrder(null, [person("B", "", 1), person("A", "", 1)]).map(
      (entry) => entry.full_name,
    ),
    ["A", "B"],
    "same place: by name",
  );
});

test("clearsOnlyPhoto mirrors archived_read_only's one allowed edit (D-26)", () => {
  const pictured = personSchema.parse({
    ...base,
    show_on_public: false,
    photo_path: `${randomUUID()}.webp`,
  });
  const cleared = { ...pictured, photo_path: "" } as const;
  assert.equal(clearsOnlyPhoto(pictured, cleared), true);
  assert.equal(clearsOnlyPhoto(cleared, cleared), true, "already cleared");
  assert.equal(
    clearsOnlyPhoto(pictured, { ...cleared, role_title: "Edited" }),
    false,
    "another change",
  );
  assert.equal(
    clearsOnlyPhoto(pictured, {
      ...pictured,
      photo_path: `${randomUUID()}.webp`,
    }),
    false,
    "a different photo",
  );
  assert.equal(clearsOnlyPhoto(pictured, pictured), false, "nothing cleared");
});

test("accessFrom: none, invited, active, deactivated", () => {
  const account = {
    person_id: randomUUID(),
    user_id: randomUUID(),
    email: "member@example.invalid",
    can_manage_people: true,
    can_manage_money: false,
    deactivated_at: null,
    last_sign_in_at: null,
    updated_at: "2026-09-01T00:00:00.123456+00:00",
  };
  assert.deepEqual(accessFrom(undefined), { state: "none" });
  assert.equal(accessFrom(account).state, "invited");
  assert.equal(
    accessFrom({ ...account, last_sign_in_at: "2026-09-02T00:00:00Z" }).state,
    "active",
  );
  const off = accessFrom({
    ...account,
    deactivated_at: "2026-09-03T00:00:00Z",
  });
  assert.ok(off.state === "deactivated" && off.version === account.updated_at);
});

// The same cases the database tests prove against `admins_guard`.
test("accessChangeProblem mirrors the access guard", () => {
  const a: AccessHolder = {
    personId: "pa",
    userId: "ua",
    canManagePeople: true,
    canManageMoney: false,
    active: true,
  };
  const b: AccessHolder = { ...a, personId: "pb", userId: "ub" };
  const c: AccessHolder = {
    personId: "pc",
    userId: "uc",
    canManagePeople: false,
    canManageMoney: false,
    active: true,
  };
  const change = (
    personId: string,
    canManagePeople: boolean,
    active = true,
  ) => ({
    personId,
    canManagePeople,
    active,
  });
  // No self-removal of access or of "manage people".
  assert.equal(accessChangeProblem([a, b], change("pa", false), "ua"), "self");
  assert.equal(
    accessChangeProblem([a, b], change("pa", true, false), "ua"),
    "self",
  );
  // Changing someone else is fine while another manager remains.
  assert.equal(accessChangeProblem([a, b], change("pb", false), "ua"), null);
  // The last active manager keeps it.
  assert.equal(
    accessChangeProblem([a, c], change("pa", false), "uc"),
    "last_manager",
  );
  assert.equal(
    accessChangeProblem([a, c], change("pa", true, false), "uc"),
    "last_manager",
  );
  // A deactivated manager does not count.
  assert.equal(
    accessChangeProblem(
      [a, { ...b, active: false }],
      change("pa", false),
      "uc",
    ),
    "last_manager",
  );
  // Adding a permission, or changing a non-manager, is never refused.
  assert.equal(accessChangeProblem([a, c], change("pc", true), "ua"), null);
  assert.equal(
    accessChangeProblem([a, c], change("pc", false, false), "ua"),
    null,
  );
  // An unknown person has nothing to guard (the database answers conflict).
  assert.equal(accessChangeProblem([a], change("px", false), "ua"), null);
  // PR6 D-18 (SGU09): nobody turns on their own "manage money"; others can.
  const money = { ...change("pa", true), canManageMoney: true };
  assert.equal(accessChangeProblem([a, b], money, "ua"), "self_money");
  assert.equal(accessChangeProblem([a, b], money, "ub"), null);
  assert.equal(
    accessChangeProblem([{ ...a, canManageMoney: true }, b], money, "ua"),
    null,
    "keeping it on",
  );
});

test("accessLocks: own login and the last manager are locked, others are not", () => {
  const login = (
    userId: string,
    canManagePeople: boolean,
    state: "invited" | "active" | "deactivated" = "active",
  ) => ({
    state,
    userId,
    email: `${userId}@example.com`,
    canManagePeople,
    canManageMoney: false,
    version: "v1",
  });
  const me = { id: "pa", access: login("ua", true) };
  const other = { id: "pb", access: login("ub", true) };
  const helper = { id: "pc", access: login("uc", false) };
  const none = { id: "pd", access: { state: "none" as const } };
  const unlocked = { managePeople: null, manageMoney: null, deactivate: null };
  // Your own "manage people", login and (PR6 D-18) "manage money" are locked.
  assert.deepEqual(accessLocks(me, [me, other, helper], "ua", true), {
    managePeople: "self",
    manageMoney: "self_money",
    deactivate: "self",
  });
  // Another manager can be changed while you keep "manage people".
  assert.deepEqual(
    accessLocks(other, [me, other, helper], "ua", true),
    unlocked,
  );
  // The last active manager stays locked for everyone else.
  const deactivated = { ...other, access: login("ub", true, "deactivated") };
  assert.deepEqual(accessLocks(me, [me, deactivated, helper], "uc", true), {
    managePeople: "last_manager",
    manageMoney: null,
    deactivate: "last_manager",
  });
  // A non-manager's "manage people" box has nothing to lock; a deactivated
  // login has no deactivate button; no login, no locks.
  assert.deepEqual(accessLocks(helper, [me, helper], "ua", true), unlocked);
  assert.deepEqual(
    accessLocks(deactivated, [me, deactivated], "ua", true),
    unlocked,
  );
  assert.deepEqual(accessLocks(none, [me, none], "ua", true), unlocked);
  // Outside the Executive board both permissions are locked (2026-10-06),
  // also when inviting; deactivating stays possible.
  assert.deepEqual(accessLocks(helper, [me, helper], "ua", false), {
    managePeople: "not_executive",
    manageMoney: "not_executive",
    deactivate: null,
  });
  assert.deepEqual(accessLocks(none, [me, none], "ua", false), {
    managePeople: "not_executive",
    manageMoney: "not_executive",
    deactivate: null,
  });
});

test("the two permissions and the Executive board moves (2026-10-06): declared mirrors", () => {
  const off = { canManagePeople: false, canManageMoney: false };
  assert.equal(permissionsProblem(false, off), null);
  assert.equal(
    permissionsProblem(false, { ...off, canManagePeople: true }),
    "not_executive",
  );
  assert.equal(
    permissionsProblem(false, { ...off, canManageMoney: true }),
    "not_executive",
  );
  assert.equal(
    permissionsProblem(true, { canManagePeople: true, canManageMoney: true }),
    null,
  );
  const exec = "ex";
  const at = (section_id: string, role_title = "") => ({
    section_id,
    role_title,
  });
  // Into, out of, and a role change inside the Executive board.
  assert.equal(touchesExecutive(null, at(exec, "President"), exec), true);
  assert.equal(touchesExecutive(at("gb"), at(exec, "Treasurer"), exec), true);
  assert.equal(touchesExecutive(at(exec, "Treasurer"), at("gb"), exec), true);
  assert.equal(
    touchesExecutive(at(exec, "Treasurer"), at(exec, "Secretary"), exec),
    true,
  );
  // Everything else is any board member's.
  assert.equal(
    touchesExecutive(at(exec, "Treasurer"), at(exec, "Treasurer"), exec),
    false,
  );
  assert.equal(touchesExecutive(null, at("gb", "T1 rep"), exec), false);
  assert.equal(touchesExecutive(at("gb", "a"), at("ad", "b"), exec), false);
  assert.equal(touchesExecutive(null, at(exec), null), false);
  assert.equal(leavesExecutive(at(exec), at("gb"), exec), true);
  assert.equal(leavesExecutive(at("gb"), at(exec), exec), false);
  assert.equal(leavesExecutive(at(exec), at(exec), exec), false);
});

test("roleHolder and roleHolders mirror people_one_role_holder: one current person per Executive board role (2026-10-06)", () => {
  const login = (userId: string, canManagePeople: boolean) => ({
    state: "active" as const,
    userId,
    email: null,
    canManagePeople,
    canManageMoney: false,
    version: "v1",
  });
  const entry = (
    id: string,
    role_title: string,
    section_id = "exec",
    extra: { archived_at?: string | null; access?: Access } = {},
  ) => ({
    id,
    full_name: `Testname ${id}`,
    role_title,
    section_id,
    archived_at: null,
    updated_at: `v-${id}`,
    access: { state: "none" } as Access,
    ...extra,
  });
  const president = entry("pa", "President", "exec", {
    access: login("ua", true),
  });
  const treasurer = entry("pb", "Treasurer", "exec", {
    access: login("ub", true),
  });
  const people = [
    president,
    treasurer,
    entry("pc", "Secretary"),
    // An archived Secretary and a General board "Treasurer" hold nothing.
    entry("pd", "Secretary", "exec", { archived_at: "2026-10-01" }),
    entry("pe", "Treasurer", "general"),
  ];
  const as = (role: string, id = "new", section_id = "exec") => ({
    id,
    role_title: role,
    section_id,
  });
  assert.equal(roleHolder(people, as("President"), "exec"), president);
  assert.equal(roleHolder(people, as("Treasurer"), "exec"), treasurer);
  // Your own role is not taken from you; other groups and free roles ask nothing.
  assert.equal(roleHolder(people, as("President", "pa"), "exec"), undefined);
  assert.equal(
    roleHolder(people, as("Treasurer", "new", "general"), "exec"),
    undefined,
  );
  assert.equal(
    roleHolder(people, as("Vice President (Sisters)"), "exec"),
    undefined,
  );
  assert.equal(roleHolder(people, as("President"), null), undefined);

  // Who may be moved out: not yourself while you manage people (self), and
  // not the last person who can (last_manager).
  const holders = (actor: string, list = people) =>
    Object.fromEntries(
      roleHolders(list, "exec", actor).map((held) => [held.role, held.stays]),
    );
  assert.deepEqual(holders("ua"), {
    President: "self",
    Treasurer: null,
    Secretary: null,
  });
  const alone = [president, entry("pc", "Secretary")];
  assert.deepEqual(holders("uz", alone), {
    President: "last_manager",
    Secretary: null,
  });
  assert.deepEqual(roleHolders(people, "exec", "ua")[1], {
    id: "pb",
    name: "Testname pb",
    role: "Treasurer",
    version: "v-pb",
    stays: null,
  });
});

test("publicTeamRows mirrors public_team_list(): the Executive board always, listed others, archive, order, photos only for the Executive board", () => {
  const [board, advisors, old, executive] = [
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
  ];
  const group = (
    id: string,
    name: string,
    position: number,
    kind: "executive" | null = null,
    archived_at: string | null = null,
  ) => ({ id, name, position, shown_by_default: false, kind, archived_at });
  const sections = [
    group(advisors, "Advisors", 2),
    group(board, "Board", 1),
    group(old, "Old", 0, null, "2026-01-01T00:00:00Z"),
    group(executive, "Executive board", 3, "executive"),
  ];
  const consent = { show_on_public: true };
  const photo = `${randomUUID()}.webp`;
  const person = (
    full_name: string,
    changes: object = consent,
    archived_at: string | null = null,
  ) => ({
    ...personSchema.parse({
      id: randomUUID(),
      full_name,
      section_id: board,
      position: 1,
      show_on_public: false,
      ...changes,
    }),
    archived_at,
  });
  const people = [
    person("Zed"),
    person("Amy"),
    person("First", { ...consent, position: 0 }),
    person("Hidden", {}),
    person("Archived", consent, "2026-01-01T00:00:00Z"),
    person("Advisor", { ...consent, section_id: advisors, photo_path: photo }),
    person("Old section", { ...consent, section_id: old }),
    // The Executive board by role, whatever the dragged order says.
    person("Treasurer", {
      ...consent,
      section_id: executive,
      role_title: "Treasurer",
      position: 1,
    }),
    person("President", {
      ...consent,
      section_id: executive,
      role_title: "President",
      position: 2,
      photo_path: photo,
    }),
    // The Executive board is always listed (review fixes P4), "Show" or not.
    person("Secretary", {
      section_id: executive,
      role_title: "Secretary",
      position: 3,
    }),
  ];
  const team = groupTeam(publicTeamRows(sections, people));
  assert.deepEqual(
    team.map((section) => [
      section.name,
      section.people.map((entry) => entry.fullName),
    ]),
    [
      ["Board", ["First", "Amy", "Zed"]],
      ["Advisors", ["Advisor"]],
      ["Executive board", ["President", "Treasurer", "Secretary"]],
    ],
  );
  assert.deepEqual(
    team.map((section) => section.kind),
    [null, null, "executive"],
  );
  // Photos are for the Executive board only (an advisor's never shows).
  assert.equal(team[2].people[0].photoPath, photo);
  assert.equal(team[1].people[0].photoPath, null);
  assert.equal(team[0].people[0].photoPath, null);
  // Tiers: the President; the Vice Presidents; the Treasurer and the Secretary.
  assert.deepEqual(
    executiveTiers(team[2].people).map((tier) =>
      tier.map((entry) => entry.fullName),
    ),
    [["President"], ["Treasurer", "Secretary"]],
  );
});

/**
 * Conformance suite for the People port and the invite port on every
 * non-network adapter set. Each `make()` returns adapters over a fresh
 * store, whose acting account is a "manage people" holder linked to the
 * People entry `actorPersonId`.
 */
function peopleEditorConformance(
  name: string,
  make: () => {
    people: PeopleEditor;
    inviter: AccountInviter;
    reader: ContentProvider;
    actorPersonId: string;
  },
) {
  const newPerson = async (
    people: PeopleEditor,
    changes: Partial<Person> = {},
  ) => {
    const { sections } = await people.listSections();
    const row = personSchema.parse({
      id: randomUUID(),
      full_name: "Conformance Person",
      // The General board takes any role title.
      section_id: sections.find((section) => section.kind === "general")!.id,
      position: 5,
      show_on_public: false,
      ...changes,
    });
    assert.deepEqual(await people.savePerson(row, null), { ok: true });
    return (await people.readPerson(row.id)).person!;
  };
  /** A new Executive board member: the only people who may hold the two permissions. */
  const newExecutive = async (people: PeopleEditor, role = "Secretary") => {
    const { sections } = await people.listSections();
    const executive = sections.find((section) => section.kind === "executive")!;
    const row = personSchema.parse({
      id: randomUUID(),
      full_name: "Conformance Executive",
      section_id: executive.id,
      role_title: role,
      position: 5,
      show_on_public: false,
    });
    // One current person per role (2026-10-06): its holder hands it over.
    const held = (await people.listPeople()).people.find(
      (entry) => entry.section_id === executive.id && entry.role_title === role,
    );
    assert.deepEqual(
      held
        ? await people.savePersonTakingRole(row, null, {
            id: held.id,
            version: held.updated_at,
          })
        : await people.savePerson(row, null),
      { ok: true },
    );
    return (await people.readPerson(row.id)).person!;
  };

  test(`${name}: the three team groups, in order; new people start shown in each (review fixes P4)`, async () => {
    const { people } = make();
    const { sections, unavailable } = await people.listSections();
    assert.equal(unavailable, false);
    assert.deepEqual(
      sections.map((section) => section.name),
      ["Executive board", "General board", "Advisors/Faculty"],
    );
    assert.ok(sections.every((section) => section.updated_at));
    assert.deepEqual(
      sections.map((section) => section.shown_by_default),
      [true, true, true],
    );
    assert.deepEqual(
      sections.map((section) => section.kind),
      ["executive", "general", null],
    );
  });

  test(`${name}: save with the loaded version; stale versions and refused rows`, async () => {
    const { people } = make();
    const person = await newPerson(people);
    assert.equal(person.access.state, "none");
    assert.equal(person.archived_at, null);
    assert.deepEqual(await people.savePerson(person, null), {
      ok: false,
      reason: "conflict",
    });
    const renamed = { ...person, full_name: "Renamed Person" };
    assert.deepEqual(await people.savePerson(renamed, person.updated_at), {
      ok: true,
    });
    assert.deepEqual(await people.savePerson(person, person.updated_at), {
      ok: false,
      reason: "conflict",
    });
    const after = (await people.readPerson(person.id)).person!;
    assert.equal(after.full_name, "Renamed Person");
    // The database checks refuse what the form should have caught: in the
    // Executive board only its five roles (review 2).
    const executive = (await people.listSections()).sections.find(
      (section) => section.kind === "executive",
    )!;
    assert.deepEqual(
      await people.savePerson(
        { ...after, section_id: executive.id, role_title: "Events lead" },
        after.updated_at,
      ),
      { ok: false, reason: "invalid" },
    );
    assert.deepEqual(
      await people.savePerson(
        { ...after, show_on_public: true },
        after.updated_at,
      ),
      { ok: true },
      "listed without any consent record",
    );
    const listed = (await people.readPerson(person.id)).person!;
    // One current person per Executive board role (2026-10-06): the sample
    // team's Treasurer holds it.
    assert.deepEqual(
      await people.savePerson(
        { ...listed, section_id: executive.id, role_title: "Treasurer" },
        listed.updated_at,
      ),
      { ok: false, reason: "role_taken" },
    );
    assert.deepEqual(
      await people.savePerson(
        { ...listed, section_id: randomUUID() },
        listed.updated_at,
      ),
      { ok: false, reason: "invalid" },
    );
  });

  test(`${name}: one current person per Executive board role; "instead?" hands it over in one step`, async () => {
    const { people } = make();
    const { sections } = await people.listSections();
    const executive = sections.find((section) => section.kind === "executive")!;
    const general = sections.find((section) => section.kind === "general")!;
    const current = async () => (await people.listPeople()).people;
    const holderOf = async (role: string) =>
      (await current()).find(
        (entry) =>
          entry.section_id === executive.id && entry.role_title === role,
      )!;
    const treasurer = await holderOf("Treasurer");
    const secretary = await holderOf("Secretary");
    const newcomer = await newPerson(people, { full_name: "Testname New" });
    const asTreasurer = {
      ...newcomer,
      section_id: executive.id,
      role_title: "Treasurer",
    };
    const holder = { id: treasurer.id, version: treasurer.updated_at };
    // A new person in a taken role is refused too.
    assert.deepEqual(
      await people.savePerson({ ...asTreasurer, id: randomUUID() }, null),
      { ok: false, reason: "role_taken" },
    );
    // Stale screens change nothing: the holder's version, another holder,
    // or the entry's own version.
    for (const [version, other] of [
      [newcomer.updated_at, { ...holder, version: "stale" }],
      [
        newcomer.updated_at,
        { id: secretary.id, version: secretary.updated_at },
      ],
      ["stale", holder],
    ] as const)
      assert.deepEqual(
        await people.savePersonTakingRole(asTreasurer, version, other),
        { ok: false, reason: "conflict" },
      );
    assert.equal((await holderOf("Treasurer")).id, treasurer.id);
    assert.equal(
      (await people.readPerson(treasurer.id)).person!.updated_at,
      treasurer.updated_at,
      "the refused handover changed nothing",
    );
    assert.deepEqual(
      await people.savePersonTakingRole(
        asTreasurer,
        newcomer.updated_at,
        holder,
      ),
      { ok: true },
    );
    const moved = (await people.readPerson(treasurer.id)).person!;
    assert.equal(moved.section_id, general.id);
    assert.equal(moved.role_title, "");
    assert.equal(moved.archived_at, null, "nobody is deleted or archived");
    assert.equal(moved.show_on_public, treasurer.show_on_public);
    assert.equal(
      moved.position,
      Math.max(
        ...(await current())
          .filter((entry) => entry.section_id === general.id)
          .map((entry) => entry.position),
      ),
      "last in the General board",
    );
    assert.equal((await holderOf("Treasurer")).id, newcomer.id);

    // Restore does not bring back a second holder.
    const now = (await people.readPerson(newcomer.id)).person!;
    assert.deepEqual(await people.archivePerson(now.id, now.updated_at), {
      ok: true,
    });
    assert.deepEqual(
      await people.savePerson(
        { ...moved, section_id: executive.id, role_title: "Treasurer" },
        moved.updated_at,
      ),
      { ok: true },
      "the role is free once its holder is archived",
    );
    const archived = (await people.readPerson(newcomer.id)).person!;
    assert.deepEqual(
      await people.restorePerson(archived.id, archived.updated_at),
      { ok: false, reason: "role_taken" },
    );
  });

  test(`${name}: archive, restore and permanent delete only from Archived`, async () => {
    const { people } = make();
    const person = await newPerson(people);
    assert.deepEqual(await people.purgePerson(person.id, person.updated_at), {
      ok: false,
      reason: "conflict",
    });
    assert.deepEqual(await people.archivePerson(person.id, "stale"), {
      ok: false,
      reason: "conflict",
    });
    assert.deepEqual(await people.archivePerson(person.id, person.updated_at), {
      ok: true,
    });
    const ids = async (view: "current" | "archived") =>
      (await people.listPeople(view)).people.map((entry) => entry.id);
    assert.ok(!(await ids("current")).includes(person.id));
    assert.ok((await ids("archived")).includes(person.id));
    const archived = (await people.readPerson(person.id)).person!;
    assert.ok(archived.archived_at);
    assert.deepEqual(
      await people.restorePerson(person.id, archived.updated_at),
      { ok: true },
    );
    assert.ok((await ids("current")).includes(person.id));
    const restored = (await people.readPerson(person.id)).person!;
    await people.archivePerson(person.id, restored.updated_at);
    const again = (await people.readPerson(person.id)).person!;
    assert.deepEqual(await people.purgePerson(person.id, again.updated_at), {
      ok: true,
    });
    assert.equal((await people.readPerson(person.id)).person, null);
  });

  test(`${name}: groups: unique current names, archived only when empty, deleted only when nobody is in them`, async () => {
    const { people } = make();
    const id = randomUUID();
    const group = { id, position: 9, shown_by_default: false, kind: null };
    assert.deepEqual(
      await people.saveSection({ ...group, name: "executive BOARD" }, null),
      { ok: false, reason: "name_taken" },
    );
    assert.deepEqual(
      await people.saveSection({ ...group, name: "Volunteers" }, null),
      { ok: true },
    );
    const section = (await people.listSections()).sections.find(
      (entry) => entry.id === id,
    )!;
    const person = await newPerson(people, { section_id: id });
    assert.deepEqual(await people.archiveSection(id, section.updated_at), {
      ok: false,
      reason: "section_in_use",
    });
    await people.archivePerson(person.id, person.updated_at);
    assert.deepEqual(await people.archiveSection(id, section.updated_at), {
      ok: true,
    });
    const archived = (await people.listSections("archived")).sections.find(
      (entry) => entry.id === id,
    )!;
    assert.ok(archived);
    // An archived person is still in it: not empty yet.
    assert.deepEqual(await people.deleteSection(id, archived.updated_at), {
      ok: false,
      reason: "in_use",
    });
    const gone = (await people.readPerson(person.id)).person!;
    assert.deepEqual(await people.purgePerson(person.id, gone.updated_at), {
      ok: true,
    });
    assert.deepEqual(await people.deleteSection(id, "stale"), {
      ok: false,
      reason: "conflict",
    });
    assert.deepEqual(await people.deleteSection(id, archived.updated_at), {
      ok: true,
    });
    assert.equal(
      [
        ...(await people.listSections()).sections,
        ...(await people.listSections("archived")).sections,
      ].some((entry) => entry.id === id),
      false,
    );
  });

  test(`${name}: the Executive board and the General board are always kept (review 2)`, async () => {
    const { people } = make();
    const { sections } = await people.listSections();
    for (const group of sections.filter((section) => section.kind)) {
      assert.deepEqual(
        await people.saveSection(
          { ...group, name: `${group.name} renamed` },
          group.updated_at,
        ),
        { ok: false, reason: "permanent" },
      );
      // Its start answer still changes, and its permanence stays.
      assert.deepEqual(
        await people.saveSection(
          { ...group, shown_by_default: !group.shown_by_default, kind: null },
          group.updated_at,
        ),
        { ok: true },
      );
      const saved = (await people.listSections()).sections.find(
        (entry) => entry.id === group.id,
      )!;
      assert.equal(saved.kind, group.kind);
      assert.equal(saved.shown_by_default, !group.shown_by_default);
    }
    for (const group of (await people.listSections()).sections.filter(
      (section) => section.kind,
    ))
      assert.deepEqual(
        await people.archiveSection(group.id, group.updated_at),
        { ok: false, reason: "permanent" },
      );
  });

  test(`${name}: invite, then grant: retry-safe, one login per person and account`, async () => {
    const { people, inviter } = make();
    const person = await newExecutive(people);
    const other = await newPerson(people);
    const email = `member-${randomUUID()}@example.invalid`;
    const perms = { canManagePeople: false, canManageMoney: true };
    assert.deepEqual(await people.grantAccess(person.id, email, perms), {
      ok: false,
      reason: "no_account",
    });
    const sent = await inviter.invite(email, "http://localhost:3000/x", {
      fullName: person.full_name,
      invitedBy: "Tester",
    });
    assert.equal(sent.ok, true);
    assert.deepEqual(
      await inviter.invite(email.toUpperCase(), "http://localhost:3000/x", {
        fullName: person.full_name,
        invitedBy: "Tester",
      }),
      { ok: false, reason: "already-registered" },
    );
    assert.deepEqual(await people.grantAccess(person.id, email, perms), {
      ok: true,
    });
    assert.deepEqual(await people.grantAccess(person.id, email, perms), {
      ok: true,
    });
    const invited = (await people.readPerson(person.id)).person!;
    assert.equal(invited.access.state, "invited");
    assert.equal(invited.access.canManageMoney, true);
    assert.equal(invited.access.canManagePeople, false);
    assert.deepEqual(await people.grantAccess(other.id, email, perms), {
      ok: false,
      reason: "already_linked",
    });
    const second = `second-${randomUUID()}@example.invalid`;
    await inviter.invite(second, "http://localhost:3000/x", {
      fullName: "Other",
      invitedBy: "Tester",
    });
    assert.deepEqual(await people.grantAccess(person.id, second, perms), {
      ok: false,
      reason: "person_has_login",
    });
    await people.archivePerson(other.id, other.updated_at);
    assert.deepEqual(await people.grantAccess(other.id, second, perms), {
      ok: false,
      reason: "person_archived",
    });
  });

  test(`${name}: Change email: the login signs in with the new address; a taken one is refused (review fixes P4)`, async () => {
    const { people, inviter } = make();
    const person = await newExecutive(people);
    const email = `before-${randomUUID()}@example.invalid`;
    await inviter.invite(email, "http://localhost:3000/x", {
      fullName: person.full_name,
      invitedBy: "Tester",
    });
    await people.grantAccess(person.id, email, {
      canManagePeople: false,
      canManageMoney: false,
    });
    const login = (await people.readPerson(person.id)).person!.access;
    assert.ok(login.state === "invited");
    const taken = `taken-${randomUUID()}@example.invalid`;
    await inviter.invite(taken, "http://localhost:3000/x", {
      fullName: "Other",
      invitedBy: "Tester",
    });
    assert.deepEqual(await inviter.changeEmail(login.userId, taken), {
      ok: false,
      reason: "taken",
    });
    const after = `after-${randomUUID()}@example.invalid`;
    assert.deepEqual(await inviter.changeEmail(login.userId, after), {
      ok: true,
    });
    const changed = (await people.readPerson(person.id)).person!.access;
    assert.ok(changed.state === "invited");
    assert.equal(changed.email, after);
    // The invite again at the new address links the same login (retry-safe).
    assert.deepEqual(
      await inviter.invite(after, "http://localhost:3000/x", {
        fullName: person.full_name,
        invitedBy: "Tester",
      }),
      { ok: false, reason: "already-registered" },
    );
    assert.deepEqual(
      await people.grantAccess(person.id, after, {
        canManagePeople: false,
        canManageMoney: false,
      }),
      { ok: true },
    );
  });

  test(`${name}: access changes: versions, self-protection, deactivate and reactivate`, async () => {
    const { people, inviter, actorPersonId } = make();
    const person = await newExecutive(people);
    const email = `access-${randomUUID()}@example.invalid`;
    await inviter.invite(email, "http://localhost:3000/x", {
      fullName: person.full_name,
      invitedBy: "Tester",
    });
    await people.grantAccess(person.id, email, {
      canManagePeople: true,
      canManageMoney: false,
    });
    const access = async (id: string) => {
      const entry = (await people.readPerson(id)).person!.access;
      assert.ok(entry.state !== "none");
      return entry;
    };
    const mine = await access(actorPersonId);
    for (const change of [
      { canManagePeople: false, canManageMoney: true, active: true },
      { canManagePeople: true, canManageMoney: true, active: false },
    ])
      assert.deepEqual(
        await people.setAccess({
          personId: actorPersonId,
          version: mine.version,
          ...change,
        }),
        { ok: false, reason: "self" },
      );
    const theirs = await access(person.id);
    const off = {
      personId: person.id,
      canManagePeople: true,
      canManageMoney: false,
      active: false,
    };
    assert.deepEqual(await people.setAccess({ ...off, version: "stale" }), {
      ok: false,
      reason: "conflict",
    });
    assert.deepEqual(
      await people.setAccess({ ...off, version: theirs.version }),
      { ok: true },
    );
    const deactivated = await access(person.id);
    assert.equal(deactivated.state, "deactivated");
    assert.deepEqual(
      await people.setAccess({ ...off, version: theirs.version }),
      { ok: false, reason: "conflict" },
    );
    assert.deepEqual(
      await people.setAccess({
        ...off,
        active: true,
        version: deactivated.version,
      }),
      { ok: true },
    );
    assert.equal((await access(person.id)).state, "invited");
  });

  test(`${name}: the two permissions only in the Executive board; its moves turn them off (2026-10-06)`, async () => {
    const { people, inviter, actorPersonId } = make();
    const invite = async (person: VersionedPerson, perms: object) => {
      const email = `exec-${randomUUID()}@example.invalid`;
      await inviter.invite(email, "http://localhost:3000/x", {
        fullName: person.full_name,
        invitedBy: "Tester",
      });
      return people.grantAccess(person.id, email, {
        canManagePeople: false,
        canManageMoney: false,
        ...perms,
      });
    };
    const access = async (id: string) => {
      const entry = (await people.readPerson(id)).person!.access;
      assert.ok(entry.state !== "none");
      return entry;
    };
    // Outside the Executive board: no invite with either permission, and
    // none turned on later.
    const helper = await newPerson(people);
    for (const perms of [{ canManagePeople: true }, { canManageMoney: true }])
      assert.deepEqual(await invite(helper, perms), {
        ok: false,
        reason: "not_executive",
      });
    assert.deepEqual(await invite(helper, {}), { ok: true });
    assert.deepEqual(
      await people.setAccess({
        personId: helper.id,
        canManagePeople: false,
        canManageMoney: true,
        active: true,
        version: (await access(helper.id)).version,
      }),
      { ok: false, reason: "not_executive" },
    );
    // In the Executive board both can be given.
    const treasurer = await newExecutive(people, "Treasurer");
    assert.deepEqual(
      await invite(treasurer, { canManagePeople: true, canManageMoney: true }),
      { ok: true },
    );
    // Moving them out turns both off in the same step.
    const { sections } = await people.listSections();
    const general = sections.find((section) => section.kind === "general")!;
    const stored = (await people.readPerson(treasurer.id)).person!;
    const moved = personSchema.parse({
      ...stored,
      section_id: general.id,
      role_title: "Musallah coordinator",
    });
    assert.deepEqual(await people.savePerson(moved, stored.updated_at), {
      ok: true,
    });
    const after = await access(treasurer.id);
    assert.equal(after.canManagePeople, false);
    assert.equal(after.canManageMoney, false);
    // Nobody moves themselves out while they can manage people.
    const me = (await people.readPerson(actorPersonId)).person!;
    assert.deepEqual(
      await people.savePerson(
        personSchema.parse({
          ...me,
          section_id: general.id,
          role_title: "",
        }),
        me.updated_at,
      ),
      { ok: false, reason: "self" },
    );
    // Changing their own role in the Executive board is fine for a manager.
    assert.equal((await access(actorPersonId)).canManagePeople, true);
  });

  test(`${name}: archiving a person turns their login off; nobody archives themselves`, async () => {
    const { people, inviter, actorPersonId } = make();
    const person = await newPerson(people);
    const email = `archive-${randomUUID()}@example.invalid`;
    await inviter.invite(email, "http://localhost:3000/x", {
      fullName: person.full_name,
      invitedBy: "Tester",
    });
    await people.grantAccess(person.id, email, {
      canManagePeople: false,
      canManageMoney: false,
    });
    const linked = (await people.readPerson(person.id)).person!;
    assert.deepEqual(await people.archivePerson(person.id, linked.updated_at), {
      ok: true,
    });
    assert.equal(
      (await people.readPerson(person.id)).person!.access.state,
      "deactivated",
    );
    const me = (await people.readPerson(actorPersonId)).person!;
    assert.deepEqual(await people.archivePerson(me.id, me.updated_at), {
      ok: false,
      reason: "self",
    });
  });

  test(`${name}: the public team list follows “Show on public page?”`, async () => {
    const { people, reader } = make();
    const names = async () =>
      (await reader.getTeam()).sections.flatMap((section) =>
        section.people.map((entry) => entry.fullName),
      );
    const team = await reader.getTeam();
    assert.equal(team.unavailable, false);
    const listed = await newPerson(people, {
      full_name: "Listed Conformance Person",
      show_on_public: true,
    });
    const hidden = await newPerson(people, { full_name: "Hidden One" });
    assert.ok((await names()).includes(listed.full_name));
    assert.ok(!(await names()).includes(hidden.full_name));
    // "No" removes them at once.
    await people.savePerson(
      { ...listed, show_on_public: false },
      listed.updated_at,
    );
    assert.ok(!(await names()).includes(listed.full_name));
  });

  test(`${name}: an archived person's login cannot be turned on until restored (D-19)`, async () => {
    const { people, inviter } = make();
    const person = await newPerson(people);
    const email = `archived-${randomUUID()}@example.invalid`;
    await inviter.invite(email, "http://localhost:3000/x", {
      fullName: person.full_name,
      invitedBy: "Tester",
    });
    await people.grantAccess(person.id, email, {
      canManagePeople: false,
      canManageMoney: false,
    });
    const linked = (await people.readPerson(person.id)).person!;
    await people.archivePerson(person.id, linked.updated_at);
    const archived = (await people.readPerson(person.id)).person!;
    assert.ok(archived.access.state === "deactivated");
    const on = {
      personId: person.id,
      canManagePeople: false,
      canManageMoney: false,
      active: true,
      version: archived.access.version,
    };
    assert.deepEqual(await people.setAccess(on), {
      ok: false,
      reason: "person_archived",
    });
    await people.restorePerson(person.id, archived.updated_at);
    assert.deepEqual(await people.setAccess(on), { ok: true });
  });

  test(`${name}: archived entries and sections are read-only until restored (D-20)`, async () => {
    const { people } = make();
    const person = await newPerson(people);
    await people.archivePerson(person.id, person.updated_at);
    const archived = (await people.readPerson(person.id)).person!;
    assert.deepEqual(
      await people.savePerson(
        { ...archived, role_title: "Edited" },
        archived.updated_at,
      ),
      { ok: false, reason: "conflict" },
    );
    const id = randomUUID();
    await people.saveSection(
      {
        id,
        name: "Read-only check",
        position: 9,
        shown_by_default: false,
        kind: null,
      },
      null,
    );
    const section = (await people.listSections()).sections.find(
      (entry) => entry.id === id,
    )!;
    await people.archiveSection(id, section.updated_at);
    const stored = (await people.listSections("archived")).sections.find(
      (entry) => entry.id === id,
    )!;
    assert.deepEqual(
      await people.saveSection(
        {
          id,
          name: "Renamed",
          position: 9,
          shown_by_default: false,
          kind: null,
        },
        stored.updated_at,
      ),
      { ok: false, reason: "conflict" },
    );
  });

  test(`${name}: an archived person's photo can be cleared, nothing else (D-26)`, async () => {
    const { people } = make();
    // Photos are for the Executive board only (review fixes P4).
    const seated = await newExecutive(people);
    assert.deepEqual(
      await people.savePerson(
        { ...seated, photo_path: `${randomUUID()}.webp` },
        seated.updated_at,
      ),
      { ok: true },
    );
    const person = (await people.readPerson(seated.id)).person!;
    await people.archivePerson(person.id, person.updated_at);
    const archived = (await people.readPerson(person.id)).person!;
    const withdrawn = { ...archived, photo_path: "" } as const;
    assert.deepEqual(
      await people.savePerson(
        { ...withdrawn, role_title: "Edited" },
        archived.updated_at,
      ),
      { ok: false, reason: "conflict" },
    );
    assert.deepEqual(await people.savePerson(withdrawn, archived.updated_at), {
      ok: true,
    });
    const after = (await people.readPerson(person.id)).person!;
    assert.ok(after.archived_at, "still archived");
    assert.equal(after.archived_at, archived.archived_at);
    assert.equal(after.photo_path, "");
    assert.equal(after.role_title, archived.role_title);
    assert.deepEqual(
      await people.savePerson(
        { ...after, role_title: "Edited" },
        after.updated_at,
      ),
      { ok: false, reason: "conflict" },
      "still read-only otherwise",
    );
  });

  test(`${name}: photos only in the Executive board; moving out keeps it hidden (review fixes P4; user, 2026-10-07)`, async () => {
    const { people } = make();
    const { sections } = await people.listSections();
    const general = sections.find((section) => section.kind === "general")!;
    const photo = `${randomUUID()}.webp`;
    // A new photo outside the Executive board is refused.
    const outside = await newPerson(people);
    assert.deepEqual(
      await people.savePerson(
        { ...outside, photo_path: photo },
        outside.updated_at,
      ),
      { ok: false, reason: "invalid" },
    );
    // In the Executive board it is shown; moved out, it is kept but hidden.
    const seated = await newExecutive(people);
    assert.deepEqual(
      await people.savePerson(
        { ...seated, photo_path: photo },
        seated.updated_at,
      ),
      { ok: true },
    );
    const pictured = (await people.readPerson(seated.id)).person!;
    assert.equal(pictured.photo_path, photo);
    assert.deepEqual(
      await people.savePerson(
        { ...pictured, section_id: general.id, role_title: "" },
        pictured.updated_at,
      ),
      { ok: true },
    );
    const moved = (await people.readPerson(seated.id)).person!;
    assert.equal(moved.photo_path, photo);
    assert.equal(shownPhoto(moved, pictured.section_id), "");
  });

  test(`${name}: archived sections come back with Restore unless the name is taken (D-22)`, async () => {
    const { people } = make();
    const id = randomUUID();
    await people.saveSection(
      { id, name: "Choir", position: 9, shown_by_default: false, kind: null },
      null,
    );
    const current = (await people.listSections()).sections.find(
      (entry) => entry.id === id,
    )!;
    assert.deepEqual(await people.restoreSection(id, current.updated_at), {
      ok: false,
      reason: "conflict",
    });
    await people.archiveSection(id, current.updated_at);
    const archived = (await people.listSections("archived")).sections.find(
      (entry) => entry.id === id,
    )!;
    assert.deepEqual(await people.restoreSection(id, "stale"), {
      ok: false,
      reason: "conflict",
    });
    const other = randomUUID();
    await people.saveSection(
      {
        id: other,
        name: "choir",
        position: 10,
        shown_by_default: false,
        kind: null,
      },
      null,
    );
    assert.deepEqual(await people.restoreSection(id, archived.updated_at), {
      ok: false,
      reason: "name_taken",
    });
    const taken = (await people.listSections()).sections.find(
      (entry) => entry.id === other,
    )!;
    await people.archiveSection(other, taken.updated_at);
    assert.deepEqual(await people.restoreSection(id, archived.updated_at), {
      ok: true,
    });
    const restored = (await people.listSections()).sections.find(
      (entry) => entry.id === id,
    );
    assert.equal(restored?.name, "Choir");
    assert.equal(restored?.archived_at, null);
  });

  test(`${name}: a permanently deleted person's account is deleted too (D-21)`, async () => {
    const { people, inviter, actorPersonId } = make();
    const person = await newPerson(people);
    const email = `deleted-${randomUUID()}@example.invalid`;
    const details = { fullName: person.full_name, invitedBy: "Tester" };
    await inviter.invite(email, "http://localhost:3000/x", details);
    await people.grantAccess(person.id, email, {
      canManagePeople: false,
      canManageMoney: false,
    });
    const linked = (await people.readPerson(person.id)).person!;
    assert.ok(linked.access.state !== "none");
    const { userId } = linked.access;
    await people.archivePerson(person.id, linked.updated_at);
    const archived = (await people.readPerson(person.id)).person!;
    assert.deepEqual(await people.purgePerson(person.id, archived.updated_at), {
      ok: true,
    });
    assert.deepEqual(await inviter.deleteAccount(userId), { ok: true });
    assert.deepEqual(
      await inviter.deleteAccount(userId),
      { ok: true },
      "an account already gone counts as deleted",
    );
    // The email is free again: a new invite creates a new account.
    assert.deepEqual(
      await inviter.invite(email, "http://localhost:3000/x", details),
      { ok: true, delivery: "sandbox" },
    );
    // The guard still protects the last active manager.
    const me = (await people.readPerson(actorPersonId)).person!;
    assert.ok(me.access.state !== "none");
    assert.deepEqual(await inviter.deleteAccount(me.access.userId), {
      ok: false,
      reason: "unavailable",
    });
    assert.equal(
      (await people.readPerson(actorPersonId)).person!.access.state,
      "active",
    );
  });

  test(`${name}: off inviter changes nothing`, async () => {
    assert.deepEqual(
      await offAccountInviter.invite("x@example.invalid", "http://x", {
        fullName: "X",
        invitedBy: "Y",
      }),
      { ok: false, reason: "off" },
    );
    assert.deepEqual(await offAccountInviter.deleteAccount(randomUUID()), {
      ok: false,
      reason: "off",
    });
    assert.deepEqual(
      await offAccountInviter.changeEmail(randomUUID(), "x@example.invalid"),
      { ok: false, reason: "off" },
    );
  });
}

let fresh = Date.parse("2030-01-01T12:00:00Z");
peopleEditorConformance("sample adapters", () => {
  // A new seed is a new sandbox store, so each test starts from the fixtures.
  const seed = new Date((fresh += 1000));
  return {
    people: createSamplePeopleEditor(seed),
    inviter: createSampleAccountInviter(seed),
    reader: createMockContentProvider(seed),
    actorPersonId: demoAdmin.personId,
  };
});

test("sandbox seeds: the founder's roles; the Executive board and most of the General board listed (review fixes P4)", async () => {
  const seed = new Date((fresh += 1000));
  const { people } = await createSamplePeopleEditor(seed).listPeople();
  assert.equal(people.length, 12);
  const admin = people.find((person) => person.id === demoAdmin.personId)!;
  assert.equal(admin.full_name, "Omar Haddad");
  assert.equal(admin.role_title, "President");
  assert.ok(admin.access.state === "active");
  assert.equal(admin.access.canManagePeople, true);
  assert.equal(admin.access.canManageMoney, true);
  const team = await createMockContentProvider(seed).getTeam();
  assert.deepEqual(
    team.sections.map((section) => [
      section.name,
      section.kind,
      section.people.map((entry) => entry.fullName),
    ]),
    [
      [
        "Executive board",
        "executive",
        [
          "Omar Haddad",
          "Bilal Ahmed",
          "Aisha Rahman",
          "Maryam Siddiqui",
          "Hamza Ali",
        ],
      ],
      [
        "General board",
        "general",
        [
          "Yusuf Ibrahim",
          "Zainab Hussain",
          "Idris Bello",
          "Huda Karim",
          "Sara Malik",
        ],
      ],
    ],
  );
  assert.equal(team.provenance, "sample");
});

test("the Executive board's tiers hold each of its roles once; listed and photo rules (review fixes P4)", () => {
  assert.deepEqual(EXECUTIVE_TIERS.flat().sort(), [...EXECUTIVE_ROLES].sort());
  const executive = randomUUID();
  const other = randomUUID();
  assert.equal(
    listedPublicly({ section_id: executive, show_on_public: false }, executive),
    true,
  );
  assert.equal(
    listedPublicly({ section_id: other, show_on_public: false }, executive),
    false,
  );
  assert.equal(
    listedPublicly(
      { section_id: executive, show_on_public: true, archived_at: "x" },
      executive,
    ),
    false,
  );
  assert.equal(photoAllowed(executive, executive), true);
  assert.equal(photoAllowed(other, executive), false);
  assert.equal(photoAllowed(other, null), false);
  const kept = { section_id: other, photo_path: "a.webp" };
  assert.equal(shownPhoto(kept, executive), "");
  assert.equal(
    shownPhoto({ ...kept, section_id: executive }, executive),
    "a.webp",
  );
  const people = [
    {
      id: "s",
      full_name: "S",
      role_title: "Secretary",
      section_id: executive,
      photo_path: "",
    },
    {
      id: "p",
      full_name: "P",
      role_title: "President",
      section_id: executive,
      photo_path: "",
    },
    {
      id: "t",
      full_name: "T",
      role_title: "Treasurer",
      section_id: executive,
      photo_path: "x.webp",
    },
    {
      id: "g",
      full_name: "G",
      role_title: "",
      section_id: other,
      photo_path: "",
    },
  ];
  assert.deepEqual(
    executivesWithoutPhoto(people, executive).map((person) => person.id),
    ["p", "s"],
  );
});
