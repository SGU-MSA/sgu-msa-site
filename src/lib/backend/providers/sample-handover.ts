import "server-only";
import {
  byStepOrder,
  handoverStepSchema,
  sharedLoginSchema,
} from "../../community/handover";
import {
  nextVersion,
  recordActivity,
  sandboxActor,
  sandboxStore,
  type SandboxStore,
} from "../../demo/store";
import type {
  HandoverEditor,
  ListView,
  VersionedLogin,
  VersionedStep,
  WriteResult,
} from "./contract";

/**
 * Sandbox New board term over the in-memory store (D-6, PR5a WP2). It applies
 * the declared mirrors of the database rules: admins only, the `updated_at`
 * check, archived rows read-only until restored, holders chosen from People,
 * no delete; and appends activity as the trigger does.
 */
const conflict: WriteResult = { ok: false, reason: "conflict" };
const ok: WriteResult = { ok: true };

type Area = "handover_steps" | "shared_logins";
type Row = VersionedStep | VersionedLogin;

const inView = (row: { archived_at: string | null }, view: ListView) =>
  Boolean(row.archived_at) === (view === "archived");

export function createSampleHandoverEditor(seed: Date): HandoverEditor {
  const instant = new Date(seed);
  const store = () => sandboxStore(instant);
  const tables = (sandbox: SandboxStore) => ({
    handover_steps: sandbox.handoverSteps as Map<string, Row>,
    shared_logins: sandbox.sharedLogins as Map<string, Row>,
  });

  /** Insert (`version` null) or update an unarchived row with a matching version. */
  const save = (
    area: Area,
    row: Omit<Row, "updated_at" | "archived_at">,
    version: string | null,
  ) => {
    const sandbox = store();
    if (!sandboxActor(sandbox)) return conflict;
    const table = tables(sandbox)[area];
    const existing = table.get(row.id);
    if (
      version === null
        ? existing
        : existing?.updated_at !== version || existing.archived_at
    )
      return conflict;
    const saved = {
      ...structuredClone(row),
      archived_at: null,
      updated_at: nextVersion(),
    } as Row;
    table.set(row.id, saved);
    recordActivity(sandbox, instant, area, existing ?? null, saved);
    return ok;
  };

  const setArchived = (
    area: Area,
    id: string,
    version: string,
    archive: boolean,
  ) => {
    const sandbox = store();
    const table = tables(sandbox)[area];
    const existing = table.get(id);
    if (
      !sandboxActor(sandbox) ||
      existing?.updated_at !== version ||
      Boolean(existing.archived_at) === archive
    )
      return conflict;
    const saved = {
      ...existing,
      archived_at: archive ? instant.toISOString() : null,
      updated_at: nextVersion(),
    };
    table.set(id, saved);
    recordActivity(sandbox, instant, area, existing, saved);
    return ok;
  };

  /** The `people` foreign keys: a chosen holder must still be in People. */
  const holdersExist = (sandbox: SandboxStore, ...ids: readonly string[]) =>
    ids.every((id) => !id || sandbox.people.has(id));

  return {
    async listSteps(view = "current") {
      const steps = [...store().handoverSteps.values()]
        .filter((row) => inView(row, view))
        .sort(byStepOrder)
        .map((row) => structuredClone(row));
      return { steps, unavailable: false };
    },
    async saveStep(row, version) {
      // The database checks.
      const parsed = handoverStepSchema.safeParse(row);
      if (!parsed.success) return { ok: false, reason: "unavailable" };
      return save("handover_steps", parsed.data, version);
    },
    archiveStep: async (id, version) =>
      setArchived("handover_steps", id, version, true),
    restoreStep: async (id, version) =>
      setArchived("handover_steps", id, version, false),
    async startNewTerm() {
      const sandbox = store();
      if (!sandboxActor(sandbox)) return conflict;
      for (const [id, before] of sandbox.handoverSteps) {
        if (before.archived_at || !before.done_on) continue;
        const after = { ...before, done_on: "", updated_at: nextVersion() };
        sandbox.handoverSteps.set(id, after);
        recordActivity(sandbox, instant, "handover_steps", before, after);
      }
      return ok;
    },
    async listLogins(view = "current") {
      const logins = [...store().sharedLogins.values()]
        .filter((row) => inView(row, view))
        .sort((a, b) => a.service.localeCompare(b.service))
        .map((row) => structuredClone(row));
      return { logins, unavailable: false };
    },
    async saveLogin(row, version) {
      const parsed = sharedLoginSchema.safeParse(row);
      if (!parsed.success) return { ok: false, reason: "unavailable" };
      if (
        !holdersExist(
          store(),
          parsed.data.holder_person_id,
          parsed.data.second_factor_person_id,
        )
      )
        return conflict;
      return save("shared_logins", parsed.data, version);
    },
    archiveLogin: async (id, version) =>
      setArchived("shared_logins", id, version, true),
    restoreLogin: async (id, version) =>
      setArchived("shared_logins", id, version, false),
  };
}
