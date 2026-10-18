import "server-only";
import { seasonSchema } from "../../community/seasons";
import {
  nextVersion,
  recordActivity,
  sandboxActor,
  sandboxStore,
} from "../../demo/store";
import type { ListView, SeasonEditor, VersionedSeason } from "./contract";

/**
 * Sandbox seasons over the in-memory store (PR6 WP-4), with the declared
 * mirrors of the database rules: admins only, the `updated_at` check, one
 * current season per name (any case), archived rows read-only until
 * restored, a season a current item uses stays (SGU08), the page address
 * made once (`season_slug`), no delete; and
 * activity appended as the trigger does.
 */
const conflict = { ok: false, reason: "conflict" } as const;
const nameTaken = { ok: false, reason: "name_taken" } as const;

const inView = (row: { archived_at: string | null }, view: ListView) =>
  Boolean(row.archived_at) === (view === "archived");

export function createSampleSeasonEditor(seed: Date): SeasonEditor {
  const instant = new Date(seed);
  const store = () => sandboxStore(instant);
  const nameUsed = (name: string, except: string) =>
    [...store().seasons.values()].some(
      (season) =>
        !season.archived_at &&
        season.id !== except &&
        season.name.toLowerCase() === name.toLowerCase(),
    );
  /** Mirror of the `season_slug` trigger: the name's address, "-2" … when taken. */
  const seasonSlug = (name: string) => {
    const base =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 50)
        .replace(/-+$/g, "") || "season";
    const taken = new Set([...store().seasons.values()].map((row) => row.slug));
    let candidate = base;
    for (let n = 2; taken.has(candidate); n++) candidate = `${base}-${n}`;
    return candidate;
  };
  const write = (before: VersionedSeason | null, after: VersionedSeason) => {
    store().seasons.set(after.id, after);
    recordActivity(store(), instant, "seasons", before, after);
    return { ok: true } as const;
  };

  return {
    async listSeasons(view = "current") {
      return {
        seasons: [...store().seasons.values()]
          .filter((row) => inView(row, view))
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((row) => structuredClone(row)),
        unavailable: false,
      };
    },
    async saveSeason(row, version) {
      const sandbox = store();
      if (!sandboxActor(sandbox)) return conflict;
      const parsed = seasonSchema.safeParse(row);
      if (!parsed.success) return { ok: false, reason: "unavailable" };
      const existing = sandbox.seasons.get(row.id);
      if (
        version === null
          ? existing
          : existing?.updated_at !== version || existing.archived_at
      )
        return conflict;
      if (nameUsed(parsed.data.name, row.id)) return nameTaken;
      return write(existing ?? null, {
        ...structuredClone(parsed.data),
        // `season_slug`: made once from the name, then never changed.
        slug: existing?.slug ?? seasonSlug(parsed.data.name),
        archived_at: null,
        updated_at: nextVersion(),
      });
    },
    async archiveSeason(id, version) {
      const sandbox = store();
      const existing = sandbox.seasons.get(id);
      if (
        !sandboxActor(sandbox) ||
        existing?.updated_at !== version ||
        existing.archived_at
      )
        return conflict;
      if (
        [...sandbox.paymentItems.values()].some(
          (item) => !item.archived_at && item.season_id === id,
        )
      )
        return { ok: false, reason: "in_use" };
      return write(existing, {
        ...existing,
        archived_at: instant.toISOString(),
        updated_at: nextVersion(),
      });
    },
    async restoreSeason(id, version) {
      const sandbox = store();
      const existing = sandbox.seasons.get(id);
      if (
        !sandboxActor(sandbox) ||
        existing?.updated_at !== version ||
        !existing.archived_at
      )
        return conflict;
      if (nameUsed(existing.name, id)) return nameTaken;
      return write(existing, {
        ...existing,
        archived_at: null,
        updated_at: nextVersion(),
      });
    },
  };
}
