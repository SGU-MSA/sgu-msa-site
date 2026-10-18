import { getSite, placedReminder } from "@/lib/content";
import { cardImages, postCard } from "@/features/seo/card-text";
import { CommunityPost } from "@/features/community/CommunityPost";
import {
  findCommunityPost,
  loadCommunityPost,
} from "@/features/community/load";

/**
 * One update or event per address: the menu reads the address, which is
 * only known per visit, so this page is built on each visit (Cache
 * Components; review fixes PR-C). Its page text and verse are still cached.
 */
export const instant = false;

type Props = { params: Promise<{ kind: string; id: string }> };

export async function generateMetadata({ params }: Props) {
  const { kind, id } = await params;
  const [site, post] = await Promise.all([
    getSite(),
    findCommunityPost(kind, id),
  ]);
  const row = post?.row;
  const images = post
    ? cardImages(`/community/${kind}/${id}`, postCard(post, site), site)
    : undefined;
  return {
    title: row?.title ?? "Update not found",
    description: row?.summary,
    alternates: { canonical: `/community/${kind}/${id}` },
    openGraph: {
      title: row?.title,
      description: row?.summary,
      ...images?.openGraph,
    },
    twitter: {
      title: row?.title,
      description: row?.summary,
      ...images?.twitter,
    },
  };
}

export default async function UpdatePage({ params }: Props) {
  const { kind, id } = await params;
  const [post, verse] = await Promise.all([
    loadCommunityPost(kind, id),
    placedReminder("community"),
  ]);
  return <CommunityPost row={post.row} kind={post.kind} verse={verse} />;
}
