import "server-only";
import { seasonFromRow, seasonToRow } from "../../community/seasons";
import type { Clock } from "../../runtime/clock";
import { adminClient } from "../server";
import type { SeasonEditor, VersionedSeason } from "./contract";
import { inView, outcome, unavailable } from "./supabase";

/**
 * Seasons on Supabase (PR6 WP-4), with the person's own session cookie
 * client: RLS (`is_admin()`), the checks, the one-current-name index, the
 * in-use rule (SGU08), `archived_read_only` (SGU06) and the log trigger
 * decide (migration 202610150001_schema.sql).
 */
const versioned = (row: Record<string, unknown>): VersionedSeason => ({
  ...seasonFromRow(row),
  updated_at: String(row.updated_at),
  archived_at: row.archived_at ? String(row.archived_at) : null,
});

/** `clock` stamps `archived_at`; it comes from the composition point. */
export function createSupabaseSeasonEditor(clock: Clock): SeasonEditor {
  const setArchived = async <R extends string>(
    id: string,
    version: string,
    archive: boolean,
    refusals: Record<string, R>,
  ) => {
    const client = await adminClient();
    if (!client) return unavailable;
    const query = client
      .from("seasons")
      .update({ archived_at: archive ? clock.now().toISOString() : null })
      .eq("id", id)
      .eq("updated_at", version);
    return outcome(
      await (
        archive
          ? query.is("archived_at", null)
          : query.not("archived_at", "is", null)
      ).select("id"),
      refusals,
    );
  };
  return {
    async listSeasons(view) {
      const client = await adminClient();
      if (!client) return { seasons: [], unavailable: true };
      const { data, error } = await inView(
        client.from("seasons").select("*"),
        view,
      )
        .order("name")
        .limit(200);
      return error
        ? { seasons: [], unavailable: true }
        : { seasons: (data ?? []).map(versioned), unavailable: false };
    },
    async saveSeason(row, version) {
      const client = await adminClient();
      if (!client) return unavailable;
      const payload = seasonToRow(row);
      return outcome(
        await (version
          ? client
              .from("seasons")
              .update(payload)
              .eq("id", row.id)
              .eq("updated_at", version)
              .select("id")
          : client.from("seasons").insert(payload).select("id")),
        { "23505": "name_taken", SGU06: "conflict" } as const,
      );
    },
    // A season a current item uses is refused (SGU08); a restored name must be free.
    archiveSeason: (id, version) =>
      setArchived(id, version, true, { SGU08: "in_use" } as const),
    restoreSeason: (id, version) =>
      setArchived(id, version, false, { "23505": "name_taken" } as const),
  };
}
