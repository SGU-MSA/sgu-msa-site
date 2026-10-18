import "server-only";

import { notFound } from "next/navigation";

import { getRecords } from "@/lib/community/queries";

import { buildFeed, KIND_LABEL, type PostPath } from "./feed";

/** Announcements and news posts as one feed (see `buildFeed`). */
export async function loadCommunityFeed() {
  const [announcements, news] = await Promise.all([
    getRecords("announcements"),
    getRecords("news_posts"),
  ]);
  return buildFeed(announcements, news);
}

/** One post by kind and id; `undefined` when it is not published. */
export async function findCommunityPost(kind: string, id: string) {
  if (kind !== "announcements" && kind !== "news_posts") return undefined;
  const row = (await getRecords(kind)).records.find(
    (record) => record.id === id,
  );
  return row ? { row, kind: KIND_LABEL[kind as PostPath] } : undefined;
}

/** As `findCommunityPost`, but a missing post is the not-found page. */
export async function loadCommunityPost(kind: string, id: string) {
  const post = await findCommunityPost(kind, id);
  if (!post) notFound();
  return post;
}
