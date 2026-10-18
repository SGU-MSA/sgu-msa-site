import Link from "next/link";

import { shownIds } from "@/lib/content/page-layouts";
import type { CommunityContent, Reminder } from "@/lib/content/schemas";
import { PageSection } from "@/shared/layout/PageSection";
import { Container } from "@/shared/ui/Container";
import { InkRing } from "@/shared/ui/InkRing";
import { MarginNote } from "@/shared/ui/MarginNote";
import { InkHeading } from "@/shared/ui/InkHeading";
import quiet from "@/shared/ui/page.module.css";

import { Cover } from "./CommunityParts";
import { longDate, type Feed } from "./feed";
import c from "./community.module.css";

/**
 * /community, "Front page" (PR8 D-4): the top update (featured first, then
 * newest) is the lead story on a lifted paper sheet with its kind circled in
 * ink; every other update follows as a ruled index with a small photo. The
 * margin carries the verse placed on Community. The heading and the empty
 * lines are page text (Pages → Community page, PR5b).
 */
export function CommunityFrontPage({
  content,
  feed,
  verse,
}: {
  content: CommunityContent;
  feed: Feed;
  verse?: Reminder | null;
}) {
  const [lead, ...rest] = feed.items;
  // The list of updates with its empty lines: a section the board can hide (review 3 B).
  const updates = (
    <>
      {feed.unavailable ? (
        <p role="alert" className={c.alert}>
          Some updates are temporarily unavailable. Please try again shortly.
        </p>
      ) : null}

      {lead ? (
        <article className={c.lead}>
          <div className={c.sheet} aria-hidden="true" />
          <div className={`${c.leadInner} ${lead.cover ? c.withCover : ""}`}>
            {lead.cover ? (
              <Cover
                image={lead.cover}
                sizes="(min-width: 960px) 45vw, 100vw"
                className={c.leadCover}
                eager
              />
            ) : null}
            <div className={c.leadCopy}>
              <p className={c.label}>
                <span className={c.ringed}>
                  <InkRing />
                  {lead.kind}
                </span>
                <span aria-hidden="true"> · </span>
                <time dateTime={lead.date}>{longDate(lead.date)}</time>
              </p>
              <h2 className={c.leadTitle}>
                <Link href={lead.href} className={c.titleLink}>
                  {lead.title}
                </Link>
              </h2>
              <p className={c.leadExcerpt}>{lead.excerpt}</p>
            </div>
          </div>
        </article>
      ) : null}

      {rest.length ? (
        <ol className={c.index}>
          {rest.map((item) => (
            <li key={`${item.path}-${item.id}`}>
              <article className={`${c.row} ${item.cover ? c.withCover : ""}`}>
                <p className={`${c.label} ${c.rowMeta}`}>
                  <time dateTime={item.date}>{longDate(item.date)}</time>
                  <span>{item.kind}</span>
                </p>
                <div className={c.rowCopy}>
                  <h2 className={c.rowTitle}>
                    <Link href={item.href} className={c.titleLink}>
                      {item.title}
                    </Link>
                  </h2>
                  <p className={c.rowExcerpt}>{item.excerpt}</p>
                </div>
                {item.cover ? (
                  <Cover
                    image={item.cover}
                    sizes="(min-width: 960px) 14rem, 7rem"
                    className={c.thumb}
                  />
                ) : null}
              </article>
            </li>
          ))}
        </ol>
      ) : null}

      {feed.empty ? (
        <div className={c.empty}>
          <p className={c.emptyTitle}>{content.empty_title}</p>
          {content.empty_hint ? (
            <p className={c.emptyHint}>{content.empty_hint}</p>
          ) : null}
        </div>
      ) : null}
    </>
  );
  return (
    <div className={c.page}>
      <Container>
        <PageSection id="top">
          <header className={`${c.head} ${quiet.enter}`}>
            <div>
              {content.eyebrow ? (
                <p className={quiet.eyebrow}>{content.eyebrow}</p>
              ) : null}
              <InkHeading
                as="h1"
                text={content.title}
                className={`${quiet.display} ${c.title}`}
              />
              {content.description ? (
                <p className={quiet.lede}>{content.description}</p>
              ) : null}
            </div>
            {verse ? (
              <MarginNote reminder={verse} className={c.headNote} />
            ) : null}
          </header>
        </PageSection>

        {shownIds(content.sections).map((id) => (
          <PageSection key={id} id={id}>
            {updates}
          </PageSection>
        ))}
      </Container>
    </div>
  );
}
