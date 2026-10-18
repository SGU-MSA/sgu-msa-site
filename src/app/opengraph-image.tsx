import { getSite } from "@/lib/content";
import { siteCard } from "@/features/seo/card-text";
import { ogCard } from "@/lib/seo/og-card";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "The SGU MSA seal beside this page's title";

/** The default link-preview card: the site's name and search description (Pages → Site-wide). */
export default async function Image() {
  const site = await getSite();
  return ogCard(siteCard(site));
}
