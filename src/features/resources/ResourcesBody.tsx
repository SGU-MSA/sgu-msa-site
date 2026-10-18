import type { ReactNode } from "react";

import { shownIds, type SectionId } from "@/lib/content/page-layouts";
import type {
  NewslettersContent,
  Reminder,
  ResourcesContent,
} from "@/lib/content/schemas";
import { PageSection } from "@/shared/layout/PageSection";
import { Container } from "@/shared/ui/Container";
import { InkHeading } from "@/shared/ui/InkHeading";
import { MarginNote } from "@/shared/ui/MarginNote";
import quiet from "@/shared/ui/page.module.css";

import { shownResources, type ResourceCategory } from "./library";
import { NewsletterArchive } from "./NewsletterArchive";
import { ResourceExplorer } from "./ResourceExplorer";
import r from "./resources.module.css";

/**
 * The Resources page's body: the heading with its verse, then the searchable
 * shelf and the newsletter archive in the order the board set in Pages,
 * without the hidden ones (review 3 B). Presentational (PR5b WP4): the page
 * passes the stored text, the Pages preview the typed text; the issues come
 * from the newsletter editor.
 */
export function ResourcesBody({
  content,
  newsletters,
  initialCategory,
  categories,
  verse,
}: {
  content: ResourcesContent;
  /** The board's resource categories (Lists, review fixes P3). */
  categories: readonly ResourceCategory[];
  newsletters: NewslettersContent & { unavailable: boolean };
  initialCategory: string;
  verse?: Reminder | null;
}) {
  const sections: Record<SectionId<"resources">, ReactNode> = {
    library: (
      <ResourceExplorer
        resources={shownResources(content.items)}
        categories={categories}
        placeholder={content.search_placeholder}
        emptyMessage={content.empty_message}
        initialCategory={initialCategory}
      />
    ),
    archive: (
      <section
        id="newsletter-archive"
        aria-labelledby="newsletter-archive-heading"
        className={`${r.archive} scroll-mt-24`}
      >
        <div className={r.archiveHead}>
          <p className={quiet.eyebrow}>Back issues</p>
          <InkHeading
            id="newsletter-archive-heading"
            text={newsletters.heading}
            className={quiet.h2Small}
            inline
          />
          {newsletters.note ? (
            <p className={quiet.small}>{newsletters.note}</p>
          ) : null}
        </div>
        <div>
          {newsletters.unavailable ? (
            <p role="alert" className={r.alert}>
              Newsletters are temporarily unavailable. Please try again shortly.
            </p>
          ) : (
            <NewsletterArchive content={newsletters} />
          )}
        </div>
      </section>
    ),
  };
  return (
    <Container className={quiet.above}>
      <PageSection id="top">
        <header className={`${r.hero} ${quiet.enter}`}>
          <div>
            <h1 className={`${quiet.display} ${r.heroTitle}`}>
              {content.hero.title}
              {content.hero.eyebrow ? (
                <>
                  <br />
                  <em>{content.hero.eyebrow}</em>
                </>
              ) : null}
            </h1>
            {content.hero.description ? (
              <p className={quiet.lede}>{content.hero.description}</p>
            ) : null}
          </div>
          {verse ? <MarginNote reminder={verse} className={r.note} /> : null}
        </header>
      </PageSection>

      {shownIds(content.sections).map((id) => (
        <PageSection key={id} id={id}>
          {sections[id]}
        </PageSection>
      ))}
    </Container>
  );
}
