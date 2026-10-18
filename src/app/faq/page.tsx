import type { Metadata } from "next";

import { FaqSheet } from "@/features/faq/FaqSheet";
import quiet from "@/shared/ui/page.module.css";
import { getFAQ } from "@/lib/content";
import { TasbihThread, tasbihThreadHost } from "@/shared/ui/TasbihThread";

export const metadata: Metadata = {
  alternates: { canonical: "/faq" },
  title: "Common Questions",
  description:
    "Practical answers about prayer, the Musallah, and getting involved with the SGU MSA.",
};

/** FAQ, option B "Folded notes" (PR8 D-7). No verse on this page (contract). */
export default async function FAQPage() {
  const faq = await getFAQ();

  return (
    <div className={`${tasbihThreadHost} ${quiet.page}`}>
      <TasbihThread />
      <FaqSheet faq={faq} />
    </div>
  );
}
