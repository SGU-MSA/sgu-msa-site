import type { MetadataRoute } from "next";
import { siteUrl, publicRoutes } from "@/lib/site-config";
import { getRecords } from "@/lib/community/queries";
import { deploymentProfile } from "@/lib/runtime/providers";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!deploymentProfile().indexable) return [];
  const [events, announcements, news] = await Promise.all([
    getRecords("events"),
    getRecords("announcements"),
    getRecords("news_posts"),
  ]);
  return [
    ...publicRoutes.map((path) => ({ url: siteUrl + path })),
    ...events.records.map((row) => ({ url: `${siteUrl}/calendar/${row.id}` })),
    ...announcements.records.map((row) => ({
      url: `${siteUrl}/community/announcements/${row.id}`,
    })),
    ...news.records.map((row) => ({
      url: `${siteUrl}/community/news_posts/${row.id}`,
    })),
  ];
}
