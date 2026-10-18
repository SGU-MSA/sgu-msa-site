import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { placesProvider } from "@/lib/runtime/providers";
import { publicCacheTags } from "@/lib/runtime/public-cache";
import type { Provenance } from "../community/providers/contract";
import { directionsLinks, type DirectionsLinks } from "./location";
import type { Place } from "./providers/contract";

export type { DirectionsLinks } from "./location";
export type { Place } from "./providers/contract";

export type MusallahDirections = {
  /** The board's pin; null only when the location could not be read (`unavailable`). */
  place: Place | null;
  links: DirectionsLinks | null;
  unavailable: boolean;
  provenance: Provenance;
};

/**
 * The musallah pin, cached until a board save (`publicCacheTags.musallahPin`;
 * review fixes PR-C): the prayer starts and the directions box always use the
 * same read (never disagreeing). A fallback read is kept only briefly.
 */
export async function musallahPin() {
  "use cache";
  cacheTag(publicCacheTags.musallahPin);
  const result = await placesProvider().musallahEntrance();
  if (result.unavailable) cacheLife("minutes");
  else cacheLife("max");
  return result;
}

/**
 * The musallah pin and the directions to it, from the composition point's
 * `PlacesProvider` (ADR 0012). Pages never learn where the pin is stored.
 */
export async function musallahDirections(): Promise<MusallahDirections> {
  const { place, unavailable, provenance } = await musallahPin();
  return {
    place,
    links: place ? directionsLinks(place) : null,
    unavailable,
    provenance,
  };
}
