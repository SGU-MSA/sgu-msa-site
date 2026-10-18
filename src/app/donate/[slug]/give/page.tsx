import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import {
  GIVING_UNAVAILABLE_SIGNPOST,
  NotFoundSignpost,
} from "@/features/system/NotFoundSignpost";
import { loadGiveTarget } from "@/lib/integrations/payments";
import { requestNow } from "@/lib/runtime/public-cache";

/** Worked out on each visit from its address (Cache Components; review fixes PR-C). */
export const instant = false;

export const metadata: Metadata = {
  title: "Give",
  robots: { index: false, follow: false },
};

/**
 * Give (PR6 D-53, D-74): every Give and Buy button opens this address in a
 * new tab. Our own row and dates decide; no Go2Pay call is made. Open → the
 * item's Go2Pay page (or the sandbox checkout); closed, archived or unknown →
 * the 404 "This has closed" (`not-found.tsx`); our database unreadable → the
 * "Temporarily unavailable" signpost, with no redirect.
 */
export default async function GivePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const target = await loadGiveTarget(slug, await requestNow());
  if (target.state === "closed") notFound();
  if (target.state === "redirect") redirect(target.url);
  return <NotFoundSignpost {...GIVING_UNAVAILABLE_SIGNPOST} />;
}
