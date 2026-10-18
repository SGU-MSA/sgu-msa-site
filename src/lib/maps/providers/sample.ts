import "server-only";
import { sandboxStore } from "../../demo/store";
import type { PlacesProvider } from "./contract";

/**
 * The sandbox's musallah pin (D-6): the in-memory store seeded at `now` (the
 * sample clock), so a pin moved in the sandbox dashboard shows on the public
 * pages. Never reads a database.
 */
export function createSamplePlacesProvider(now: Date): PlacesProvider {
  const instant = new Date(now);
  return {
    async musallahEntrance() {
      const { latitude, longitude } = sandboxStore(instant).musallah.pin;
      return {
        place: { latitude, longitude },
        unavailable: false,
        provenance: "sample",
      };
    },
  };
}
