import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-config";
import { deploymentProfile } from "@/lib/runtime/providers";
export default function robots(): MetadataRoute.Robots {
  if (!deploymentProfile().indexable)
    return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/media/"] },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
