import type { Metadata } from "next";

import { RAMADAN_SLUG, seasonMetadata } from "@/features/season/load";
import { SeasonRoute } from "@/features/season/SeasonRoute";
import { requestNow } from "@/lib/runtime/public-cache";

export function generateMetadata(): Promise<Metadata> {
  return seasonMetadata(RAMADAN_SLUG);
}

/**
 * Ramadan: the Ramadan season's page, filled from the dashboard (Seasons →
 * Ramadan → Public page; PR5c). It stays up all year.
 */
export default async function RamadanPage() {
  return <SeasonRoute slug={RAMADAN_SLUG} now={await requestNow()} />;
}
