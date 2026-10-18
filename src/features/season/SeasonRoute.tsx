import { notFound, permanentRedirect } from "next/navigation";

import { NotFoundSignpost } from "@/features/system/NotFoundSignpost";

import { findSeasonPage, loadSeasonPage, RAMADAN_SLUG } from "./load";
import { SeasonPage } from "./SeasonPage";

/** The season page when our database cannot be read (no stale or invented dates). */
const UNAVAILABLE = {
  eyebrow: null,
  title: "Temporarily unavailable",
  body: "This page can't open right now. Please try again in a few minutes.",
} as const;

/**
 * One season's page by its address (PR5c): /ramadan for Ramadan, and
 * /seasons/<slug> for every other season with a page. /seasons/ramadan
 * goes to /ramadan. An unknown, archived or page-less season is a 404.
 */
export async function SeasonRoute({ slug, now }: { slug: string; now: Date }) {
  const { season, unavailable } = await findSeasonPage(slug);
  if (unavailable) return <NotFoundSignpost {...UNAVAILABLE} />;
  if (!season) notFound();
  return <SeasonPage data={await loadSeasonPage(season, now)} />;
}

/** /seasons/ramadan is Ramadan's page at /ramadan. */
export function canonicalSeasonSlug(slug: string) {
  if (slug === RAMADAN_SLUG) permanentRedirect("/ramadan");
}
