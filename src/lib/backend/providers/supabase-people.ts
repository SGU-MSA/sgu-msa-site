import "server-only";
import { z } from "../../validation/zod";
import {
  activityDayBounds,
  activityEntrySchema,
  activityQuerySchema,
  loginOwnerMap,
  ownerActor,
  removedLoginsIn,
  type ActivityEntry,
} from "../../community/activity";
import {
  accessFrom,
  adminAccountSchema,
  grantAccessResults,
  personSchema,
  sectionSchema,
  setAccessResults,
  takeRoleResults,
  type AdminAccount,
} from "../../community/people";
import type { Clock } from "../../runtime/clock";
import { adminClient } from "../server";
import type {
  AccessResult,
  ActivityLog,
  GrantResult,
  PeopleEditor,
  VersionedPerson,
  VersionedSection,
} from "./contract";
import { inView, outcome, unavailable } from "./supabase";

/**
 * People, groups, access and the activity log on Supabase, with the
 * person's own session cookie client: RLS, the group and role rules, the
 * access guard and the log triggers decide (PR3 migrations). Access changes go only
 * through the `grant_access` and `set_access` functions.
 */

// SQLSTATEs raised by the PR3 migrations, and Postgres' own.
const refusedAccess = {
  SGU01: "self",
  SGU02: "last_manager",
  SGU03: "forbidden",
} as const;
const checkViolation = "23514";
const foreignKeyViolation = "23503";
const uniqueViolation = "23505";
// `archived_read_only`: an archived row changes only by Restore (D-20), so
// the screen was stale.
const archivedRow = "SGU06";
// `people_executive_role` and `people_sections_permanent` (review 2).
const executiveRole = "SGU12";
const permanentGroup = "SGU13";
// `people_executive_moves` (2026-10-06).
const executiveMove = "SGU15";
// `people_one_role_holder` (2026-10-06): one current person per role.
const roleTaken = "SGU17";
// `people_photo_executive_only` (review fixes P4): photos are for the
// Executive board; the save action refuses it first with its own words.
const photoExecutiveOnly = "SGU40";

const stamp = (value: unknown) => (value ? String(value) : null);

function versionedPerson(
  row: Record<string, unknown>,
  accounts: readonly AdminAccount[],
): VersionedPerson {
  const person = personSchema.parse(row);
  return {
    ...person,
    updated_at: String(row.updated_at),
    archived_at: stamp(row.archived_at),
    access: accessFrom(accounts.find((entry) => entry.person_id === person.id)),
  };
}

const versionedSection = (row: Record<string, unknown>): VersionedSection => ({
  ...sectionSchema.parse(row),
  updated_at: String(row.updated_at),
  archived_at: stamp(row.archived_at),
});

type Client = NonNullable<Awaited<ReturnType<typeof adminClient>>>;

/** Logins linked to People entries (admins only); null when unavailable. */
async function accounts(
  client: Client,
  personId?: string,
): Promise<AdminAccount[] | null> {
  const query = client.rpc("admin_accounts");
  const { data, error } = await (personId
    ? query.eq("person_id", personId)
    : query);
  return error ? null : z.array(adminAccountSchema).parse(data ?? []);
}

/** `clock` stamps `archived_at`; it comes from the composition point. */
export function createSupabasePeopleEditor(clock: Clock): PeopleEditor {
  const now = () => clock.now().toISOString();
  return {
    async listPeople(view) {
      const client = await adminClient();
      if (!client) return { people: [], unavailable: true };
      const [{ data, error }, logins] = await Promise.all([
        inView(client.from("people").select("*"), view)
          .order("position")
          .order("full_name")
          .limit(500),
        accounts(client),
      ]);
      if (error || !logins) return { people: [], unavailable: true };
      return {
        people: (data ?? []).map((row) => versionedPerson(row, logins)),
        unavailable: false,
      };
    },
    async readPerson(id) {
      const client = await adminClient();
      if (!client) return { person: null, unavailable: true };
      const [{ data, error }, logins] = await Promise.all([
        client.from("people").select("*").eq("id", id).maybeSingle(),
        accounts(client, id),
      ]);
      if (error || !logins) return { person: null, unavailable: true };
      return {
        person: data ? versionedPerson(data, logins) : null,
        unavailable: false,
      };
    },
    async savePerson(row, version) {
      const client = await adminClient();
      if (!client) return unavailable;
      const payload = personSchema.parse(row);
      const refusals = {
        [checkViolation]: "invalid",
        [foreignKeyViolation]: "invalid",
        [executiveRole]: "invalid",
        [photoExecutiveOnly]: "invalid",
        [archivedRow]: "conflict",
        [executiveMove]: "forbidden",
        // Moving someone out of the Executive board turns their permissions
        // off under the access guard (`people_leave_executive`).
        SGU01: "self",
        SGU02: "last_manager",
        [roleTaken]: "role_taken",
      } as const;
      return outcome(
        await (version
          ? client
              .from("people")
              .update(payload)
              .eq("id", row.id)
              .eq("updated_at", version)
              .select("id")
          : client.from("people").insert(payload).select("id")),
        refusals,
      );
    },
    async savePersonTakingRole(row, version, holder) {
      const client = await adminClient();
      if (!client) return unavailable;
      const { data, error } = await client.rpc("save_person_taking_role", {
        person: personSchema.parse(row),
        version,
        holder: holder.id,
        // The holder's `updated_at` exactly as the screen read it.
        holder_version: holder.version,
      });
      const result = z.enum(takeRoleResults).safeParse(data);
      if (error || !result.success) return unavailable;
      return result.data === "ok"
        ? { ok: true }
        : { ok: false, reason: result.data };
    },
    async archivePerson(id, version): Promise<AccessResult> {
      const client = await adminClient();
      if (!client) return unavailable;
      // The `archive_access` trigger turns the login off in the same transaction.
      return outcome(
        await client
          .from("people")
          .update({ archived_at: now() })
          .eq("id", id)
          .eq("updated_at", version)
          .is("archived_at", null)
          .select("id"),
        refusedAccess,
      );
    },
    async restorePerson(id, version) {
      const client = await adminClient();
      if (!client) return unavailable;
      return outcome(
        await client
          .from("people")
          .update({ archived_at: null })
          .eq("id", id)
          .eq("updated_at", version)
          .not("archived_at", "is", null)
          .select("id"),
        { [roleTaken]: "role_taken" },
      );
    },
    async purgePerson(id, version) {
      const client = await adminClient();
      if (!client) return unavailable;
      return outcome(
        await client
          .from("people")
          .delete()
          .eq("id", id)
          .eq("updated_at", version)
          .not("archived_at", "is", null)
          .select("id"),
      );
    },
    async listSections(view) {
      const client = await adminClient();
      if (!client) return { sections: [], unavailable: true };
      const { data, error } = await inView(
        client.from("people_sections").select("*"),
        view,
      )
        .order("position")
        .order("name")
        .limit(200);
      return error
        ? { sections: [], unavailable: true }
        : { sections: (data ?? []).map(versionedSection), unavailable: false };
    },
    async saveSection(row, version) {
      const client = await adminClient();
      if (!client) return unavailable;
      const refusals = {
        [uniqueViolation]: "name_taken",
        [archivedRow]: "conflict",
        [permanentGroup]: "permanent",
      } as const;
      // A group's permanence is the database's own: never written here.
      const payload = {
        id: row.id,
        name: row.name,
        position: row.position,
        shown_by_default: row.shown_by_default,
      };
      return outcome(
        await (version
          ? client
              .from("people_sections")
              .update(payload)
              .eq("id", row.id)
              .eq("updated_at", version)
              .select("id")
          : client.from("people_sections").insert(payload).select("id")),
        refusals,
      );
    },
    async archiveSection(id, version) {
      const client = await adminClient();
      if (!client) return unavailable;
      return outcome(
        await client
          .from("people_sections")
          .update({ archived_at: now() })
          .eq("id", id)
          .eq("updated_at", version)
          .is("archived_at", null)
          .select("id"),
        { SGU04: "section_in_use", [permanentGroup]: "permanent" } as const,
      );
    },
    async restoreSection(id, version) {
      const client = await adminClient();
      if (!client) return unavailable;
      return outcome(
        await client
          .from("people_sections")
          .update({ archived_at: null })
          .eq("id", id)
          .eq("updated_at", version)
          .not("archived_at", "is", null)
          .select("id"),
        { [uniqueViolation]: "name_taken" } as const,
      );
    },
    async deleteSection(id, version) {
      const client = await adminClient();
      if (!client) return unavailable;
      // RLS: archived groups only, "manage people" holders only; the people
      // foreign key keeps a group anyone is still in.
      return outcome(
        await client
          .from("people_sections")
          .delete()
          .eq("id", id)
          .eq("updated_at", version)
          .not("archived_at", "is", null)
          .select("id"),
        { [foreignKeyViolation]: "in_use" } as const,
      );
    },
    async grantAccess(personId, email, permissions): Promise<GrantResult> {
      const client = await adminClient();
      if (!client) return unavailable;
      const { data, error } = await client.rpc("grant_access", {
        person: personId,
        email,
        manage_people: permissions.canManagePeople,
        manage_money: permissions.canManageMoney,
      });
      const result = z.enum(grantAccessResults).safeParse(data);
      if (error || !result.success) return unavailable;
      return result.data === "ok"
        ? { ok: true }
        : { ok: false, reason: result.data };
    },
    async setAccess(change): Promise<AccessResult> {
      const client = await adminClient();
      if (!client) return unavailable;
      const { data, error } = await client.rpc("set_access", {
        person: change.personId,
        manage_people: change.canManagePeople,
        manage_money: change.canManageMoney,
        active: change.active,
        // The access row's `updated_at` exactly as it was read.
        version: change.version,
      });
      const result = z.enum(setAccessResults).safeParse(data);
      if (error || !result.success) return unavailable;
      return result.data === "ok"
        ? { ok: true }
        : { ok: false, reason: result.data };
    },
  };
}

/**
 * Account id → People id for every login that has or had access: current
 * links from `admin_accounts()`, removed ones from the log's access deletes
 * (a handful of rows for a club). Null when unavailable.
 */
async function loginOwners(client: Client) {
  const [current, removed] = await Promise.all([
    accounts(client),
    client
      .from("activity_log")
      .select("*")
      .eq("area", "admins")
      .eq("action", "deleted"),
  ]);
  const rows = z.array(activityEntrySchema).safeParse(removed.data ?? []);
  if (!current || removed.error || !rows.success) return null;
  return loginOwnerMap(
    current.map((login) => ({
      userId: login.user_id,
      personId: login.person_id,
    })),
    removedLoginsIn(rows.data),
  );
}

/** Recent changes under RLS (admins only); names come from People when read (D-5). */
export const supabaseActivityLog: ActivityLog = {
  async list(query) {
    const parsed = activityQuerySchema.parse(query);
    const { before, limit, area, recordId, actors, areas } = parsed;
    const { since, until } = activityDayBounds(parsed);
    // A person with no login has no changes.
    if (actors?.length === 0) return { entries: [], unavailable: false };
    const client = await adminClient();
    if (!client) return { entries: [], unavailable: true };
    let request = client
      .from("activity_log")
      .select("*")
      .order("id", { ascending: false })
      .limit(limit);
    if (before !== undefined) request = request.lt("id", before);
    if (area !== undefined) request = request.eq("area", area);
    if (areas !== undefined) request = request.in("area", areas);
    if (recordId !== undefined) request = request.eq("record_id", recordId);
    if (actors !== undefined) {
      // Validated uuids (and "owner"), so the list is safe in the filter.
      const ids = actors.filter((actor) => actor !== ownerActor);
      request = request.or(
        [
          ...(actors.includes(ownerActor) ? ["actor.is.null"] : []),
          ...(ids.length ? [`actor.in.(${ids.join(",")})`] : []),
        ].join(","),
      );
    }
    if (since !== undefined) request = request.gte("occurred_at", since);
    if (until !== undefined) request = request.lt("occurred_at", until);
    const [{ data, error }, personOf] = await Promise.all([
      request,
      loginOwners(client),
    ]);
    if (error || !personOf) return { entries: [], unavailable: true };
    const rows = z.array(activityEntrySchema).parse(data ?? []);
    const personIds = [
      ...new Set(
        rows.flatMap((row) => {
          const id = row.actor && personOf.get(row.actor);
          return id ? [id] : [];
        }),
      ),
    ];
    const names = new Map<string, string>();
    if (personIds.length) {
      const people = await client
        .from("people")
        .select("id, full_name")
        .in("id", personIds);
      if (people.error) return { entries: [], unavailable: true };
      for (const person of people.data ?? [])
        names.set(String(person.id), String(person.full_name));
    }
    const entries: ActivityEntry[] = rows.map((row) => {
      const personId = row.actor ? personOf.get(row.actor) : undefined;
      return { ...row, actorName: (personId && names.get(personId)) || null };
    });
    return { entries, unavailable: false };
  },
  async logins() {
    const client = await adminClient();
    const owners = client ? await loginOwners(client) : null;
    if (!owners) return { logins: [], unavailable: true };
    return {
      logins: [...owners].map(([userId, personId]) => ({ userId, personId })),
      unavailable: false,
    };
  },
};
