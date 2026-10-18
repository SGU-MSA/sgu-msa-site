import { SafeImage } from "@/shared/ui/SafeImage";
import Link from "next/link";
import { Section } from "@/shared/ui/Section";

import { loadCommunityFeed } from "./load";

/**
 * The latest community updates on Home (three cards and a link to
 * /community). The /community page itself is `CommunityFrontPage`; both read
 * the same feed rules (`buildFeed`).
 */
export async function CommunityFeed({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { items, unavailable, empty } = await loadCommunityFeed();
  return (
    <Section kicker="Stay connected" title="Community updates" bordered>
      {unavailable ? (
        <p role="alert">
          Some updates are temporarily unavailable. Please try again shortly.
        </p>
      ) : null}
      <div className="content-grid">
        {(compact ? items.slice(0, 3) : items).map((row) => (
          <article className="content-card" key={row.id}>
            {row.cover ? (
              <div className="record-cover">
                <SafeImage
                  image={row.cover}
                  fill
                  sizes="(min-width:960px) 30vw, 100vw"
                  fit="cover"
                />
              </div>
            ) : null}
            <p className="section-kicker">
              {row.kind} · <time dateTime={row.date}>{row.date}</time>
            </p>
            <h3>
              <Link href={row.href} className="text-link">
                {row.title}
              </Link>
            </h3>
            <p>{row.excerpt}</p>
          </article>
        ))}
      </div>
      {empty ? (
        <p className="muted">
          There are no current updates. New community news and notices will
          appear here.
        </p>
      ) : null}
      {compact ? (
        <Link href="/community" className="text-link">
          All community updates →
        </Link>
      ) : null}
    </Section>
  );
}
