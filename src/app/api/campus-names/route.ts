import { connection } from "next/server";
import { campusNamesFor, pausedAfterFailure } from "@/lib/maps/campus-names";
import { musallahPin } from "@/lib/maps";
import {
  CAMPUS_NAMES_REFRESH_S,
  CAMPUS_NAMES_TIMEOUT_MS,
} from "@/lib/maps/style";

/**
 * OpenStreetMap, through Next's data cache (good replies only, refreshed
 * daily). After a failure with no good copy kept, it is not asked again for
 * an hour (this server instance), so views stay fast while it is down.
 */
const overpass = pausedAfterFailure(
  (url) =>
    fetch(url, {
      next: { revalidate: CAMPUS_NAMES_REFRESH_S },
      headers: { "User-Agent": "sgu-msa-site (campus building names)" },
      signal: AbortSignal.timeout(CAMPUS_NAMES_TIMEOUT_MS),
    }),
  () => performance.now(),
);

/**
 * GET /api/campus-names (PR7 P-4): the named campus buildings near the
 * musallah pin, as GeoJSON points (name and centre only), for the map's
 * italic labels. Our server asks OpenStreetMap at most once a day per pin
 * (Next's data cache keeps the last good reply when a refresh fails), so
 * visitors' browsers only ever call this site. Public, no secrets, no
 * visitor data, and never a 500: a failure is an empty list (and an hour's
 * pause before OpenStreetMap is asked again).
 */
export async function GET() {
  // Answered per request (never built ahead of time), so a failed build-time
  // reply can never stand in for a day; the data cache above keeps good ones.
  await connection();
  const { place } = await musallahPin();
  const names = await campusNamesFor(place, overpass);
  return Response.json(names, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
