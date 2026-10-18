import { getCommunity, placedReminder } from "@/lib/content";
import { CommunityFrontPage } from "@/features/community/CommunityFrontPage";
import { loadCommunityFeed } from "@/features/community/load";

export const metadata = {
  alternates: { canonical: "/community" },
  title: "Community updates",
  description:
    "News and announcements from the SGU Muslim Students Association.",
};

export default async function CommunityPage() {
  const [content, feed, verse] = await Promise.all([
    getCommunity(),
    loadCommunityFeed(),
    placedReminder("community"),
  ]);
  return <CommunityFrontPage content={content} feed={feed} verse={verse} />;
}
