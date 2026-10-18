import { getSite } from "@/lib/content";
import { requestNow } from "@/lib/runtime/public-cache";
import { securityTxt } from "@/lib/seo/text-files";
import { siteUrl } from "@/lib/site-config";

/** RFC 9116 security contact: the board's Site-wide email and the Contact page, with a rolling Expires. */
export async function GET() {
  const [site, now] = await Promise.all([getSite(), requestNow()]);
  return new Response(
    securityTxt({ email: site.brand.email, origin: siteUrl, now }),
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}
