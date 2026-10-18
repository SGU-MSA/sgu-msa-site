import type { Provenance } from "../../community/providers/contract";

/** One point on the map: the board's musallah pin. Never inferred from a visitor's location. */
export type Place = Readonly<{ latitude: number; longitude: number }>;

/**
 * Where the musallah is: the one board-managed pin (PR7, the
 * `musallah_location` row), the only source for the map, the directions and
 * the prayer start times (ADR 0012). Read only; board writes go through
 * `ContentEditor.saveMusallahPin`.
 */
export interface PlacesProvider {
  musallahEntrance(): Promise<{
    /** Null only when `unavailable`: there is always a pin. */
    place: Place | null;
    /** True when the place source could not be reached right now. */
    unavailable: boolean;
    provenance: Provenance;
  }>;
}
