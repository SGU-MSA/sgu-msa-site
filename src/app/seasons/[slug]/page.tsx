import type { Metadata } from "next";

import { seasonMetadata } from "@/features/season/load";
import {
  canonicalSeasonSlug,
  SeasonRoute,
} from "@/features/season/SeasonRoute";
import { requestNow } from "@/lib/runtime/public-cache";

/** Worked out on each visit from its address and the season's days (PR5c). */
export const instant = false;

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  return seasonMetadata((await params).slug);
}

/** A season's page, filled from the dashboard (Seasons → the season → Public page; PR5c). */
export default async function SeasonPageRoute({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  canonicalSeasonSlug(slug);
  return <SeasonRoute slug={slug} now={await requestNow()} />;
}
