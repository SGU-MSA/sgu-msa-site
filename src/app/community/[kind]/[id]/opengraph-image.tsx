import { findCommunityPost } from "@/features/community/load";
import { getSite } from "@/lib/content";
import { ogCard } from "@/lib/seo/og-card";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "The SGU MSA seal beside this page's title";

/** The update's link-preview card: its title and summary; the site's card when it cannot be read. */
export default async function Image({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}) {
  const { kind, id } = await params;
  const [site, post] = await Promise.all([
    getSite(),
    findCommunityPost(kind, id).catch(() => undefined),
  ]);
  if (!post)
    return ogCard({
      kicker: site.brand.short_name,
      heading: site.brand.name,
      subheading: site.meta?.description,
    });
  return ogCard({
    kicker: `${site.brand.short_name} · ${post.kind}`,
    heading: post.row.title,
    subheading: post.row.summary,
  });
}
