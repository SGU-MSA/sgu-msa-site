import type { Metadata } from "next";

import { ResourcesBody } from "@/features/resources/ResourcesBody";
import quiet from "@/shared/ui/page.module.css";
import { managedNewsletters } from "@/lib/community/managed";
import { getLists } from "@/lib/community/queries";
import { getResources, placedReminder } from "@/lib/content";
import { PaperLayers } from "@/shared/ui/PaperLayers";

export const metadata: Metadata = {
  alternates: { canonical: "/resources" },
  title: "Resources",
  description:
    "Newsletters, guides, and reference material published by the SGU MSA.",
};

export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [content, newsletters, verse, { lists }] = await Promise.all([
    getResources(),
    managedNewsletters(),
    placedReminder("resources"),
    getLists(),
  ]);
  const requested = (await searchParams).category;
  const initialCategory = Array.isArray(requested) ? requested[0] : requested;

  return (
    <div className={quiet.page}>
      <PaperLayers />
      <ResourcesBody
        content={content}
        newsletters={newsletters}
        initialCategory={initialCategory ?? "all"}
        categories={lists.resource_categories}
        verse={verse}
      />
    </div>
  );
}
