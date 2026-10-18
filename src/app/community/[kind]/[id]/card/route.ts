import { findCommunityPost } from "@/features/community/load";
import { getSite } from "@/lib/content";
import { postCard, siteCard } from "@/features/seo/card-text";
import { ogCard } from "@/lib/seo/og-card";

/**
 * The update's link-preview card (a plain route so its address can carry a
 * version of the card's words; contract D-12). 404 when it does not exist.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ kind: string; id: string }> },
) {
  const { kind, id } = await params;
  const [site, post] = await Promise.all([
    getSite(),
    findCommunityPost(kind, id),
  ]);
  if (!post) return new Response("Not found", { status: 404 });
  const card = await ogCard({
    ...postCard(post, site),
    fallback: siteCard(site),
  });
  if (new URL(request.url).searchParams.has("v"))
    card.headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return card;
}
