import "server-only";
import { publicClient } from "@/lib/backend/server";
import { musallahPinSchema } from "@/lib/community/schema";
import type { PlacesProvider } from "./contract";

const unavailable = {
  place: null,
  unavailable: true,
  provenance: "live",
} as const;

/**
 * The board's musallah pin from the `musallah_location` row (PR7), read with
 * the publishable key (RLS `public_read`). No client, an error, a missing
 * table (before the PR7 database update) or a row the schema refuses is
 * "unavailable": never a made-up place.
 */
export const supabasePlacesProvider: PlacesProvider = {
  async musallahEntrance() {
    const client = publicClient();
    if (!client) return unavailable;
    try {
      const { data, error } = await client
        .from("musallah_location")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) return unavailable;
      const pin = musallahPinSchema.safeParse(data);
      if (!pin.success) return unavailable;
      const { latitude, longitude } = pin.data;
      return {
        place: { latitude, longitude },
        unavailable: false,
        provenance: "live",
      };
    } catch {
      return unavailable;
    }
  },
};
