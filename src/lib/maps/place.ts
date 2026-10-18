import type { Place } from "./providers/contract";

/**
 * The box a musallah pin must be in (PR7 D-9): Grenada, Carriacou and
 * Petite Martinique, leaving out Petit St. Vincent and Union Island (Saint
 * Vincent and the Grenadines). A fixed safety rule, not a board setting.
 * Mirrored once in `supabase/migrations/202610150001_schema.sql`
 * (a test checks the two agree).
 */
export const GRENADA_BOUNDS = {
  south: 11.95,
  north: 12.531,
  west: -61.85,
  east: -61.37,
} as const;

/** Whether `place` is inside `GRENADA_BOUNDS`, edges included. */
export function inGrenada({ latitude, longitude }: Place): boolean {
  const { south, north, west, east } = GRENADA_BOUNDS;
  return (
    latitude >= south &&
    latitude <= north &&
    longitude >= west &&
    longitude <= east
  );
}

/**
 * The SGU campus (review fixes P4): the starting pin, the "MSA Mosque" place
 * the user gave (PR7 D-3, `202610150002_starter_data.sql`).
 */
export const SGU_CAMPUS = { latitude: 12.0025521, longitude: -61.7723834 };

/** How far from `SGU_CAMPUS` the musallah pin may be (the plan: about 1.5 km). */
export const CAMPUS_PIN_REACH_M = 1500;

/** The board-facing refusal for a pin too far from campus (review fixes P4). */
export const outsideCampus =
  "The pin must be on or near the SGU campus. Drag it back onto the campus.";

const METRES_PER_DEGREE = 111320;

/**
 * Whether `place` is within `CAMPUS_PIN_REACH_M` of `SGU_CAMPUS`, measured
 * on a flat map (exact enough at this size). Mirrored once in
 * `supabase/migrations/202610160003_team_list_and_campus_pin.sql`
 * (`musallah_location_near_campus`; a test checks the two agree).
 */
export function nearCampus({ latitude, longitude }: Place): boolean {
  const north = (latitude - SGU_CAMPUS.latitude) * METRES_PER_DEGREE;
  const east =
    (longitude - SGU_CAMPUS.longitude) *
    METRES_PER_DEGREE *
    Math.cos((SGU_CAMPUS.latitude * Math.PI) / 180);
  return north * north + east * east <= CAMPUS_PIN_REACH_M ** 2;
}
