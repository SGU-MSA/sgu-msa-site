import "server-only";
import {
  loginFromRow,
  loginToRow,
  stepFromRow,
  stepToRow,
} from "../../community/handover";
import type { Clock } from "../../runtime/clock";
import { adminClient } from "../server";
import type { HandoverEditor, VersionedLogin, VersionedStep } from "./contract";
import { inView, outcome, unavailable } from "./supabase";

/**
 * New board term on Supabase (PR5a WP2), with the person's own session
 * cookie client: RLS (`is_admin()`), the checks, `archived_read_only` and
 * the log trigger decide (migration 202610150001_schema.sql).
 */

// `archived_read_only`: an archived row changes only by Restore, so the
// screen was stale; a holder removed from People meanwhile, likewise.
const stale = { SGU06: "conflict", "23503": "conflict" } as const;

const stamp = (value: unknown) => (value ? String(value) : null);
const versionedStep = (row: Record<string, unknown>): VersionedStep => ({
  ...stepFromRow(row),
  updated_at: String(row.updated_at),
  archived_at: stamp(row.archived_at),
});
const versionedLogin = (row: Record<string, unknown>): VersionedLogin => ({
  ...loginFromRow(row),
  updated_at: String(row.updated_at),
  archived_at: stamp(row.archived_at),
});

type Table = "handover_steps" | "shared_logins";

/** `clock` stamps `archived_at`; it comes from the composition point. */
export function createSupabaseHandoverEditor(clock: Clock): HandoverEditor {
  const save = async (
    table: Table,
    payload: Record<string, unknown>,
    version: string | null,
  ) => {
    const client = await adminClient();
    if (!client) return unavailable;
    return outcome(
      await (version
        ? client
            .from(table)
            .update(payload)
            .eq("id", payload.id as string)
            .eq("updated_at", version)
            .select("id")
        : client.from(table).insert(payload).select("id")),
      stale,
    );
  };
  const setArchived = async (
    table: Table,
    id: string,
    version: string,
    archive: boolean,
  ) => {
    const client = await adminClient();
    if (!client) return unavailable;
    const query = client
      .from(table)
      .update({ archived_at: archive ? clock.now().toISOString() : null })
      .eq("id", id)
      .eq("updated_at", version);
    return outcome(
      await (
        archive
          ? query.is("archived_at", null)
          : query.not("archived_at", "is", null)
      ).select("id"),
    );
  };
  return {
    async listSteps(view) {
      const client = await adminClient();
      if (!client) return { steps: [], unavailable: true };
      const { data, error } = await inView(
        client.from("handover_steps").select("*"),
        view,
      )
        .order("position")
        .order("title")
        .limit(200);
      return error
        ? { steps: [], unavailable: true }
        : { steps: (data ?? []).map(versionedStep), unavailable: false };
    },
    saveStep: (row, version) => save("handover_steps", stepToRow(row), version),
    archiveStep: (id, version) =>
      setArchived("handover_steps", id, version, true),
    restoreStep: (id, version) =>
      setArchived("handover_steps", id, version, false),
    async startNewTerm() {
      const client = await adminClient();
      if (!client) return unavailable;
      // One statement; the log trigger records one change per ticked step.
      const { error } = await client
        .from("handover_steps")
        .update({ done_on: null })
        .not("done_on", "is", null)
        .is("archived_at", null);
      return error ? unavailable : { ok: true };
    },
    async listLogins(view) {
      const client = await adminClient();
      if (!client) return { logins: [], unavailable: true };
      const { data, error } = await inView(
        client.from("shared_logins").select("*"),
        view,
      )
        .order("service")
        .limit(200);
      return error
        ? { logins: [], unavailable: true }
        : { logins: (data ?? []).map(versionedLogin), unavailable: false };
    },
    saveLogin: (row, version) =>
      save("shared_logins", loginToRow(row), version),
    archiveLogin: (id, version) =>
      setArchived("shared_logins", id, version, true),
    restoreLogin: (id, version) =>
      setArchived("shared_logins", id, version, false),
  };
}
