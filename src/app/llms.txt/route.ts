import { getSite } from "@/lib/content";
import { llmsTxt } from "@/lib/seo/text-files";
import { siteUrl } from "@/lib/site-config";

/** A plain summary of the site for language models (llmstxt.org), from the board's Site-wide text. */
export async function GET() {
  return new Response(llmsTxt(await getSite(), siteUrl), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
