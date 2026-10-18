import { z } from "../validation/zod";
import type { Place } from "./providers/contract";
import { CAMPUS_NAMES_RADIUS_M, CAMPUS_NAMES_RETRY_S } from "./style";

/**
 * Campus building names for the map (PR7 P-4 "3 + campus names"): the free
 * tiles leave out plain building names (Charter Hall, Superdorm 3), so our
 * server copies the named buildings near the pin from OpenStreetMap's
 * Overpass service. Only a name and a centre per building leave this module.
 */
export const overpassEndpoint = "https://overpass-api.de/api/interpreter";

/** The most names the map shows, and the longest name kept. */
const MAX_NAMES = 200;
const MAX_NAME_LENGTH = 80;

export type CampusNames = {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    properties: { name: string };
    geometry: { type: "Point"; coordinates: [number, number] };
  }[];
};

export const noCampusNames: CampusNames = {
  type: "FeatureCollection",
  features: [],
};

/**
 * The Overpass request for named buildings within `CAMPUS_NAMES_RADIUS_M`
 * of `place`, as one GET URL (the server caches it by URL). Coordinates are
 * rounded to 5 decimals (about 1 m), so a moved pin asks again.
 */
export function campusNamesURL(place: Place): string {
  const around = `around:${CAMPUS_NAMES_RADIUS_M},${place.latitude.toFixed(5)},${place.longitude.toFixed(5)}`;
  const query = `[out:json][timeout:25];(way["building"]["name"](${around});relation["building"]["name"](${around}););out center tags;`;
  const url = new URL(overpassEndpoint);
  url.searchParams.set("data", query);
  return url.href;
}

const point = z.object({ lat: z.number(), lon: z.number() });
const reply = z.object({
  elements: z.array(
    z.object({
      center: point.optional(),
      lat: z.number().optional(),
      lon: z.number().optional(),
      tags: z.object({ name: z.string().optional() }).optional(),
    }),
  ),
});

/**
 * Overpass's reply as map labels: a name and a centre per building, each
 * name once, nothing else. Anything that is not a valid reply gives null,
 * so the caller keeps its last good copy.
 */
export function campusNamesFrom(body: unknown): CampusNames | null {
  const parsed = reply.safeParse(body);
  if (!parsed.success) return null;
  const seen = new Set<string>();
  const features: CampusNames["features"] = [];
  for (const element of parsed.data.elements) {
    const name = element.tags?.name?.trim().slice(0, MAX_NAME_LENGTH);
    const centre =
      element.center ??
      (element.lat !== undefined && element.lon !== undefined
        ? { lat: element.lat, lon: element.lon }
        : null);
    if (!name || !centre || seen.has(name)) continue;
    seen.add(name);
    features.push({
      type: "Feature",
      properties: { name },
      geometry: { type: "Point", coordinates: [centre.lon, centre.lat] },
    });
    if (features.length === MAX_NAMES) break;
  }
  return { type: "FeatureCollection", features };
}

/**
 * The campus names around `place`, never an error: no pin, a failed request
 * or a reply that is not valid gives no names, and the map shows without
 * them. `request` is the server's cached fetch (the route), whose cache
 * keeps the last good reply when a daily refresh fails.
 */
export async function campusNamesFor(
  place: Place | null,
  request: (url: string) => Promise<Response>,
): Promise<CampusNames> {
  if (!place) return noCampusNames;
  try {
    const response = await request(campusNamesURL(place));
    if (!response.ok) return noCampusNames;
    return campusNamesFrom(await response.json()) ?? noCampusNames;
  } catch {
    return noCampusNames;
  }
}

/**
 * `request`, but after a failure (an error, or a reply that is not OK) it
 * is not called again for `CAMPUS_NAMES_RETRY_S`: the server's fetch cache
 * keeps only good replies, so without this pause every map view would ask
 * OpenStreetMap again (and wait) while it is down. `now` is elapsed
 * milliseconds (a monotonic timer, not the site's clock).
 */
export function pausedAfterFailure(
  request: (url: string) => Promise<Response>,
  now: () => number,
): (url: string) => Promise<Response> {
  let pausedUntil = -Infinity;
  const pause = () => {
    pausedUntil = now() + CAMPUS_NAMES_RETRY_S * 1000;
  };
  return async (url) => {
    if (now() < pausedUntil) throw new Error("campus names paused");
    try {
      const response = await request(url);
      if (!response.ok) pause();
      return response;
    } catch (error) {
      pause();
      throw error;
    }
  };
}
