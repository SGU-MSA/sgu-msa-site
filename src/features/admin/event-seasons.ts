import "server-only";
import { seasonEditor } from "@/lib/runtime/providers";
import type { TicketChoice } from "./event-tickets";

/** One season an event may belong to (PR5c), named as the list shows it. */
export type SeasonOption = TicketChoice;

/**
 * The seasons an event's form offers (PR5c; any board member): every
 * current season, plus the event's own season even if it was archived
 * since, so saving unchanged keeps it. The season's page lists the event.
 * `unavailable`: the seasons could not be read.
 */
export async function eventSeasonChoices(
  own: string,
): Promise<{ choices: SeasonOption[]; unavailable: boolean }> {
  const [current, archived] = await Promise.all([
    seasonEditor().listSeasons(),
    seasonEditor().listSeasons("archived"),
  ]);
  if (current.unavailable || archived.unavailable)
    return { choices: [], unavailable: true };
  return {
    choices: [
      ...current.seasons.map((season) => ({
        id: season.id,
        name: season.name,
        archived: false,
      })),
      ...archived.seasons
        .filter((season) => season.id === own)
        .map((season) => ({
          id: season.id,
          name: season.name,
          archived: true,
        })),
    ],
    unavailable: false,
  };
}
