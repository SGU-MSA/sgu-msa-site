import type { Metadata } from "next";

import quiet from "@/shared/ui/page.module.css";
import { NowWearing } from "@/features/merch/NowWearing";
import { getMerch } from "@/lib/content";
import { loadMerchPage } from "@/lib/integrations/payments";
import { requestNow } from "@/lib/runtime/public-cache";
import { PaperLayers } from "@/shared/ui/PaperLayers";
import { TasbihThread, tasbihThreadHost } from "@/shared/ui/TasbihThread";

export const metadata: Metadata = {
  alternates: { canonical: "/merch" },
  title: "Merch",
  description:
    "MSA collections: what the SGU MSA has made, and what students are wearing now.",
};

/**
 * Merch (PR5c): the opening from Pages → Merch, the collections, items,
 * photos and sizes from the Merch screen. Sizes open and close by Grenada
 * day, so the page is worked out on each visit.
 */
export default async function MerchPage() {
  const now = await requestNow();
  const [content, data] = await Promise.all([getMerch(), loadMerchPage(now)]);
  return (
    <div className={`${tasbihThreadHost} ${quiet.page}`}>
      <PaperLayers />
      <TasbihThread />
      <NowWearing content={content} data={data} />
    </div>
  );
}
