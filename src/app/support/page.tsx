import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SupportSections } from "@/features/support/SupportSections";
import { getSupport } from "@/lib/content";

export const metadata: Metadata = {
  alternates: { canonical: "/support" },
  title: "Support",
  description:
    "A proposed peer support pathway: MSA representatives who can listen and help students find the right next step.",
};

export default async function SupportPage() {
  const support = await getSupport();

  // The whole route is switchable from content.
  if (!support.enabled) notFound();

  return <SupportSections support={support} />;
}
