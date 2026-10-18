import "server-only";
import {
  activityQuerySchema,
  loginOwnerMap,
  matchesActivityQuery,
  removedLoginsIn,
} from "../../community/activity";
import {
  accessChangeProblem,
  accessFrom,
  byOrder,
  clearsOnlyPhoto,
  isExecutiveRole,
  leavesExecutive,
  permissionsProblem,
  personSchema,
  photoAllowed,
  roleHolder,
  touchesExecutive,
  type AccessHolder,
} from "../../community/people";
import { nextPosition } from "../../community/order";
import {
  nextVersion,
  recordActivity,
  sandboxActor,
  sandboxStore,
  type SandboxPerson,
  type SandboxStore,
} from "../../demo/store";
import type {
  AccountInviter,
  ActivityLog,
  PeopleEditor,
  VersionedPerson,
} from "./contract";

/**
 * Sandbox People, access, invites and activity over the in-memory store
 * (D-6). They apply the declared mirrors of the database rules (Executive
 * board roles and moves and their one holder each, permanent groups,
 * `admins_guard`, the two permissions for the Executive board only,
 * archive rules,
 * `grant_access`, `set_access`) and
 * append activity as the triggers do. The acting account is the sandbox
 * admin, the sandbox's only account. No email is sent and no password exists.
 */
const conflict = { ok: false, reason: "conflict" } as const;
const ok = { ok: true } as const;

function accountOf(store: SandboxStore, personId: string) {
  const admin = [...store.admins.values()].find(
    (row) => row.person_id === personId,
  );
  if (!admin) return undefined;
  const account = store.accounts.get(admin.user_id);
  return {
    ...admin,
    email: account?.email ?? null,
    last_sign_in_at: account?.last_sign_in_at ?? null,
  };
}

/** Auth's account lookup: emails match ignoring case and surrounding spaces. */
function accountIdByEmail(store: SandboxStore, email: string) {
  const wanted = email.trim().toLowerCase();
  return [...store.accounts].find(
    ([, account]) => account.email.toLowerCase() === wanted,
  )?.[0];
}

function versioned(store: SandboxStore, row: SandboxPerson): VersionedPerson {
  return {
    ...structuredClone(row),
    access: accessFrom(accountOf(store, row.id)),
  };
}

/** The unique `lower(name)` index on current sections. */
const nameTaken = (store: SandboxStore, id: string, name: string) =>
  [...store.sections.values()].some(
    (other) =>
      other.id !== id &&
      !other.archived_at &&
      other.name.toLowerCase() === name.toLowerCase(),
  );

/** The Executive board's id (`people_sections.kind`). */
const executiveId = (store: SandboxStore) =>
  [...store.sections.values()].find((section) => section.kind === "executive")
    ?.id ?? null;

/** Whether a person is in the Executive board (`in_executive_board`). */
const inExecutive = (store: SandboxStore, personId: string) =>
  store.people.get(personId)?.section_id === executiveId(store);

/** The General board's id (`people_sections.kind`). */
const generalId = (store: SandboxStore) =>
  [...store.sections.values()].find((section) => section.kind === "general")
    ?.id ?? null;

/** `people_one_role_holder`: who else holds this Executive board role now. */
const takenBy = (
  store: SandboxStore,
  person: Pick<SandboxPerson, "id" | "section_id" | "role_title">,
) => roleHolder([...store.people.values()], person, executiveId(store));

const holders = (store: SandboxStore): AccessHolder[] =>
  [...store.admins.values()].map((row) => ({
    personId: row.person_id,
    userId: row.user_id,
    canManagePeople: row.can_manage_people,
    canManageMoney: row.can_manage_money,
    active: !row.deactivated_at,
  }));

export function createSamplePeopleEditor(seed: Date): PeopleEditor {
  const instant = new Date(seed);
  const store = () => sandboxStore(instant);
  const stamp = () => instant.toISOString();
  const editor: PeopleEditor = {
    async listPeople(view = "current") {
      const sandbox = store();
      const people = [...sandbox.people.values()]
        .filter((row) => Boolean(row.archived_at) === (view === "archived"))
        .sort(byOrder((row) => row.full_name))
        .map((row) => versioned(sandbox, row));
      return { people, unavailable: false };
    },
    async readPerson(id) {
      const sandbox = store();
      const row = sandbox.people.get(id);
      return {
        person: row ? versioned(sandbox, row) : null,
        unavailable: false,
      };
    },
    async savePerson(row, version) {
      const sandbox = store();
      const actor = sandboxActor(sandbox);
      if (!actor) return conflict;
      const existing = sandbox.people.get(row.id);
      // An archived entry is read-only until restored, except that its photo
      // may be cleared (`archived_read_only`, D-20, D-26).
      if (
        version === null
          ? existing
          : existing?.updated_at !== version ||
            (existing.archived_at && !clearsOnlyPhoto(existing, row))
      )
        return conflict;
      // The database checks, the group foreign key and the Executive board's
      // roles (`people_executive_role`).
      const parsed = personSchema.safeParse(row);
      const group = sandbox.sections.get(row.section_id);
      if (
        !parsed.success ||
        !group ||
        (group.kind === "executive" && !isExecutiveRole(parsed.data.role_title))
      )
        return { ok: false, reason: "invalid" };
      // `people_executive_moves`: Executive board moves need "manage people".
      const executive = executiveId(sandbox);
      if (
        touchesExecutive(existing ?? null, parsed.data, executive) &&
        !actor.can_manage_people
      )
        return { ok: false, reason: "forbidden" };
      // `people_one_role_holder`: one current person per role.
      if (!existing?.archived_at && takenBy(sandbox, parsed.data))
        return { ok: false, reason: "role_taken" };
      // `people_leave_executive`: moving out turns the two permissions off,
      // under the access guard.
      const login = accountOf(sandbox, row.id);
      const dropsPermissions =
        existing &&
        login &&
        (login.can_manage_people || login.can_manage_money) &&
        leavesExecutive(existing, parsed.data, executive);
      if (dropsPermissions) {
        const problem = accessChangeProblem(
          holders(sandbox),
          {
            personId: row.id,
            canManagePeople: false,
            canManageMoney: false,
            active: !login.deactivated_at,
          },
          actor.user_id,
        );
        if (problem === "self" || problem === "last_manager")
          return { ok: false, reason: problem };
      }
      // `people_photo_executive_only`: a new photo outside the Executive
      // board is refused; a photo already there is kept, hidden.
      const photo = parsed.data.photo_path;
      if (
        photo &&
        !photoAllowed(parsed.data.section_id, executive) &&
        existing?.photo_path !== photo
      )
        return { ok: false, reason: "invalid" };
      const saved: SandboxPerson = {
        ...parsed.data,
        archived_at: existing?.archived_at ?? null,
        updated_at: nextVersion(),
      };
      sandbox.people.set(row.id, saved);
      recordActivity(sandbox, instant, "people", existing ?? null, saved);
      if (dropsPermissions) {
        const before = sandbox.admins.get(login.user_id)!;
        const after = {
          ...before,
          can_manage_people: false,
          can_manage_money: false,
          updated_at: nextVersion(),
        };
        sandbox.admins.set(login.user_id, after);
        recordActivity(sandbox, instant, "admins", before, after);
      }
      return ok;
    },
    async savePersonTakingRole(row, version, holder) {
      const sandbox = store();
      const actor = sandboxActor(sandbox);
      if (!actor) return conflict;
      if (!actor.can_manage_people) return { ok: false, reason: "forbidden" };
      const held = sandbox.people.get(holder.id);
      const general = generalId(sandbox);
      if (
        !held ||
        !general ||
        held.updated_at !== holder.version ||
        held.id === row.id ||
        takenBy(sandbox, row)?.id !== held.id
      )
        return conflict;
      // Both saves or neither, as the database function's one transaction.
      const people = new Map(sandbox.people);
      const admins = new Map(sandbox.admins);
      const logged = sandbox.activity.length;
      const undo = () => {
        sandbox.people.clear();
        for (const [id, person] of people) sandbox.people.set(id, person);
        sandbox.admins.clear();
        for (const [id, admin] of admins) sandbox.admins.set(id, admin);
        sandbox.activity.length = logged;
      };
      const moved = await editor.savePerson(
        personSchema.parse({
          ...held,
          section_id: general,
          role_title: "",
          position: nextPosition(
            [...sandbox.people.values()].filter(
              (person) => person.section_id === general,
            ),
          ),
        }),
        held.updated_at,
      );
      const saved = moved.ok ? await editor.savePerson(row, version) : moved;
      if (!saved.ok) undo();
      return saved;
    },
    async archivePerson(id, version) {
      const sandbox = store();
      const actor = sandboxActor(sandbox);
      const existing = sandbox.people.get(id);
      if (!actor || existing?.updated_at !== version || existing.archived_at)
        return conflict;
      // D-12: archiving turns an active login off in the same step, under the guard.
      const login = accountOf(sandbox, id);
      const active = login && !login.deactivated_at;
      if (active) {
        if (!actor.can_manage_people) return { ok: false, reason: "forbidden" };
        const problem = accessChangeProblem(
          holders(sandbox),
          {
            personId: id,
            canManagePeople: login.can_manage_people,
            active: false,
          },
          actor.user_id,
        );
        if (problem) return { ok: false, reason: problem };
      }
      const saved = {
        ...existing,
        archived_at: stamp(),
        updated_at: nextVersion(),
      };
      sandbox.people.set(id, saved);
      recordActivity(sandbox, instant, "people", existing, saved);
      if (active) {
        const before = sandbox.admins.get(login.user_id)!;
        const after = {
          ...before,
          deactivated_at: stamp(),
          updated_at: nextVersion(),
        };
        sandbox.admins.set(login.user_id, after);
        recordActivity(sandbox, instant, "admins", before, after);
      }
      return ok;
    },
    async restorePerson(id, version) {
      const sandbox = store();
      const existing = sandbox.people.get(id);
      if (
        !sandboxActor(sandbox) ||
        existing?.updated_at !== version ||
        !existing.archived_at
      )
        return conflict;
      if (takenBy(sandbox, existing))
        return { ok: false, reason: "role_taken" };
      const saved = {
        ...existing,
        archived_at: null,
        updated_at: nextVersion(),
      };
      sandbox.people.set(id, saved);
      recordActivity(sandbox, instant, "people", existing, saved);
      return ok;
    },
    async purgePerson(id, version) {
      const sandbox = store();
      const existing = sandbox.people.get(id);
      if (
        !sandboxActor(sandbox)?.can_manage_people ||
        existing?.updated_at !== version ||
        !existing.archived_at
      )
        return conflict;
      // The access row goes with the person (on delete cascade); the account stays.
      const login = accountOf(sandbox, id);
      if (login) {
        const before = sandbox.admins.get(login.user_id)!;
        sandbox.admins.delete(login.user_id);
        recordActivity(sandbox, instant, "admins", before, null);
      }
      sandbox.people.delete(id);
      recordActivity(sandbox, instant, "people", existing, null);
      // `on delete set null`: shared logins they held lose the holder (PR5a).
      for (const [loginId, before] of sandbox.sharedLogins) {
        const after = {
          ...before,
          holder_person_id:
            before.holder_person_id === id ? "" : before.holder_person_id,
          second_factor_person_id:
            before.second_factor_person_id === id
              ? ""
              : before.second_factor_person_id,
        };
        if (
          after.holder_person_id === before.holder_person_id &&
          after.second_factor_person_id === before.second_factor_person_id
        )
          continue;
        const saved = { ...after, updated_at: nextVersion() };
        sandbox.sharedLogins.set(loginId, saved);
        recordActivity(sandbox, instant, "shared_logins", before, saved);
      }
      return ok;
    },
    async listSections(view = "current") {
      const sections = [...store().sections.values()]
        .filter((row) => Boolean(row.archived_at) === (view === "archived"))
        .sort(byOrder((row) => row.name))
        .map((row) => structuredClone(row));
      return { sections, unavailable: false };
    },
    async saveSection(row, version) {
      const sandbox = store();
      if (!sandboxActor(sandbox)) return conflict;
      const existing = sandbox.sections.get(row.id);
      // An archived section is read-only until restored (D-20).
      if (
        version === null
          ? existing
          : existing?.updated_at !== version || existing.archived_at
      )
        return conflict;
      const name = row.name.trim();
      // `people_sections_permanent`: a permanent group keeps its name; a new
      // group is always the board's own.
      if (existing?.kind && name !== existing.name)
        return { ok: false, reason: "permanent" };
      if (nameTaken(sandbox, row.id, name))
        return { ok: false, reason: "name_taken" };
      const saved = {
        ...structuredClone(row),
        name,
        kind: existing?.kind ?? null,
        archived_at: null,
        updated_at: nextVersion(),
      };
      sandbox.sections.set(row.id, saved);
      recordActivity(
        sandbox,
        instant,
        "people_sections",
        existing ?? null,
        saved,
      );
      return ok;
    },
    async archiveSection(id, version) {
      const sandbox = store();
      const existing = sandbox.sections.get(id);
      if (
        !sandboxActor(sandbox) ||
        existing?.updated_at !== version ||
        existing.archived_at
      )
        return conflict;
      // `always_kept` runs before `archive_check`.
      if (existing.kind) return { ok: false, reason: "permanent" };
      if (
        [...sandbox.people.values()].some(
          (person) => person.section_id === id && !person.archived_at,
        )
      )
        return { ok: false, reason: "section_in_use" };
      const saved = {
        ...existing,
        archived_at: stamp(),
        updated_at: nextVersion(),
      };
      sandbox.sections.set(id, saved);
      recordActivity(sandbox, instant, "people_sections", existing, saved);
      return ok;
    },
    async restoreSection(id, version) {
      const sandbox = store();
      const existing = sandbox.sections.get(id);
      if (
        !sandboxActor(sandbox) ||
        existing?.updated_at !== version ||
        !existing.archived_at
      )
        return conflict;
      if (nameTaken(sandbox, id, existing.name))
        return { ok: false, reason: "name_taken" };
      const saved = {
        ...existing,
        archived_at: null,
        updated_at: nextVersion(),
      };
      sandbox.sections.set(id, saved);
      recordActivity(sandbox, instant, "people_sections", existing, saved);
      return ok;
    },
    async deleteSection(id, version) {
      const sandbox = store();
      const existing = sandbox.sections.get(id);
      // RLS: archived groups only, "manage people" holders only (D-6).
      if (
        !sandboxActor(sandbox)?.can_manage_people ||
        existing?.updated_at !== version ||
        !existing.archived_at
      )
        return conflict;
      // The people foreign key: nobody, archived or not, may be in it.
      if (
        [...sandbox.people.values()].some((person) => person.section_id === id)
      )
        return { ok: false, reason: "in_use" };
      sandbox.sections.delete(id);
      recordActivity(sandbox, instant, "people_sections", existing, null);
      return ok;
    },
    async grantAccess(personId, email, permissions) {
      const sandbox = store();
      if (!sandboxActor(sandbox)?.can_manage_people)
        return { ok: false, reason: "forbidden" };
      const userId = accountIdByEmail(sandbox, email);
      if (!userId) return { ok: false, reason: "no_account" };
      const person = sandbox.people.get(personId);
      if (!person || person.archived_at)
        return { ok: false, reason: "person_archived" };
      const linked = accountOf(sandbox, personId);
      if (linked?.user_id === userId) return ok;
      if (linked) return { ok: false, reason: "person_has_login" };
      if (sandbox.admins.has(userId))
        return { ok: false, reason: "already_linked" };
      const outside = permissionsProblem(
        inExecutive(sandbox, personId),
        permissions,
      );
      if (outside) return { ok: false, reason: outside };
      const row = {
        user_id: userId,
        person_id: personId,
        can_manage_people: permissions.canManagePeople,
        can_manage_money: permissions.canManageMoney,
        deactivated_at: null,
        updated_at: nextVersion(),
      };
      sandbox.admins.set(userId, row);
      recordActivity(sandbox, instant, "admins", null, row);
      return ok;
    },
    async setAccess(change) {
      const sandbox = store();
      const actor = sandboxActor(sandbox);
      if (!actor?.can_manage_people) return { ok: false, reason: "forbidden" };
      if (change.active && sandbox.people.get(change.personId)?.archived_at)
        return { ok: false, reason: "person_archived" };
      const login = accountOf(sandbox, change.personId);
      if (!login || login.updated_at !== change.version) return conflict;
      const problem = accessChangeProblem(
        holders(sandbox),
        change,
        actor.user_id,
      );
      if (problem) return { ok: false, reason: problem };
      // `admins_executive_only` runs after the guard.
      const outside = permissionsProblem(
        inExecutive(sandbox, change.personId),
        change,
      );
      if (outside) return { ok: false, reason: outside };
      const before = sandbox.admins.get(login.user_id)!;
      const after = {
        ...before,
        can_manage_people: change.canManagePeople,
        can_manage_money: change.canManageMoney,
        deactivated_at: change.active
          ? null
          : (before.deactivated_at ?? stamp()),
        updated_at: nextVersion(),
      };
      sandbox.admins.set(login.user_id, after);
      recordActivity(sandbox, instant, "admins", before, after);
      return ok;
    },
  };
  return editor;
}

/**
 * Creates a sandbox account for a new email (no email is sent), changes a
 * login's email, and deletes one after a permanent delete (D-21).
 */
export function createSampleAccountInviter(seed: Date): AccountInviter {
  const instant = new Date(seed);
  return {
    async invite(email) {
      const sandbox = sandboxStore(instant);
      if (accountIdByEmail(sandbox, email))
        return { ok: false, reason: "already-registered" };
      sandbox.accounts.set(crypto.randomUUID(), {
        email: email.trim().toLowerCase(),
        last_sign_in_at: null,
      });
      return { ok: true, delivery: "sandbox" };
    },
    async changeEmail(userId, email) {
      const sandbox = sandboxStore(instant);
      const account = sandbox.accounts.get(userId);
      if (!account) return { ok: false, reason: "unavailable" };
      const other = accountIdByEmail(sandbox, email);
      if (other && other !== userId) return { ok: false, reason: "taken" };
      sandbox.accounts.set(userId, {
        ...account,
        email: email.trim().toLowerCase(),
      });
      return ok;
    },
    async deleteAccount(userId) {
      const sandbox = sandboxStore(instant);
      // Auth's delete cascades to a remaining access row under the guard,
      // which runs without a signed-in actor there: only the last manager
      // is protected.
      const linked = sandbox.admins.get(userId);
      if (linked) {
        const change = {
          personId: linked.person_id,
          canManagePeople: false,
          active: false,
        };
        if (accessChangeProblem(holders(sandbox), change, ""))
          return { ok: false, reason: "unavailable" };
        sandbox.admins.delete(userId);
        recordActivity(sandbox, instant, "admins", linked, null);
      }
      sandbox.accounts.delete(userId);
      return ok;
    },
  };
}

/** Account id → People id for every login that has or had access in the sandbox. */
const sandboxLoginOwners = (sandbox: SandboxStore) =>
  loginOwnerMap(
    [...sandbox.admins.values()].map((row) => ({
      userId: row.user_id,
      personId: row.person_id,
    })),
    removedLoginsIn(sandbox.activity),
  );

/** The sandbox activity log, newest first; names come from People when read. */
export function createSampleActivityLog(seed: Date): ActivityLog {
  const instant = new Date(seed);
  return {
    async list(query) {
      const parsed = activityQuerySchema.parse(query);
      const sandbox = sandboxStore(instant);
      const owners = sandboxLoginOwners(sandbox);
      const nameOf = (actor: string | null) => {
        const personId = actor && owners.get(actor);
        return (personId && sandbox.people.get(personId)?.full_name) || null;
      };
      const entries = [...sandbox.activity]
        .reverse()
        .filter((entry) => matchesActivityQuery(entry, parsed))
        .slice(0, parsed.limit)
        .map((entry) => ({
          ...structuredClone(entry),
          actorName: nameOf(entry.actor),
        }));
      return { entries, unavailable: false };
    },
    async logins() {
      const owners = sandboxLoginOwners(sandboxStore(instant));
      return {
        logins: [...owners].map(([userId, personId]) => ({ userId, personId })),
        unavailable: false,
      };
    },
  };
}
