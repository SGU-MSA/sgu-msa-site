import { notFound } from "next/navigation";

import { findCommunityPost } from "@/features/community/load";
import { getSite } from "@/lib/content";
import { ogCard, siteCard } from "@/lib/seo/og-card";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "The SGU MSA seal beside this page's title";

/** The update's link-preview card: its title and summary; not found when it does not exist. */
export default async function Image({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}) {
  const { kind, id } = await params;
  const [site, post] = await Promise.all([
    getSite(),
    findCommunityPost(kind, id),
  ]);
  if (!post) notFound();
  return ogCard({
    fallback: siteCard(site),
    kicker: `${site.brand.short_name} · ${post.kind}`,
    heading: post.row.title,
    subheading: post.row.summary,
  });
}
