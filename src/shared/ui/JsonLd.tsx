import { jsonLdText } from "@/lib/seo/structured-data";

/** One schema.org block for search engines (the only place that writes raw HTML for it; `<` is escaped). */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdText(data) }}
    />
  );
}
