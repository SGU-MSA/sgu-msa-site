import { shownIds } from "@/lib/content/page-layouts";
import type { FAQContent } from "@/lib/content/schemas";
import { PageSection } from "@/shared/layout/PageSection";
import { Container } from "@/shared/ui/Container";
import { InkHeading } from "@/shared/ui/InkHeading";
import quiet from "@/shared/ui/page.module.css";

import { FoldedList } from "./FoldedList";
import s from "./faq.module.css";

/**
 * The FAQ page's body, option B "Folded notes" (PR8 D-7): the heading beside
 * the folded questions, unless the board hid them in Pages (review 3 B). Presentational (PR5b WP4): the page passes the
 * stored text, the Pages preview the typed text.
 */
export function FaqSheet({ faq }: { faq: FAQContent }) {
  const eyebrow = faq.hero?.eyebrow ?? faq.eyebrow;
  const description = faq.hero?.description;

  return (
    <Container className={quiet.above}>
      <div className={s.grid}>
        <PageSection id="top">
          <header className={`${s.hero} ${quiet.enter}`}>
            {eyebrow ? <p className={quiet.eyebrow}>{eyebrow}</p> : null}
            <InkHeading
              as="h1"
              text={faq.hero?.title ?? faq.heading}
              className={`${quiet.display} ${s.display}`}
              inline
            />
            {description ? <p className={s.lede}>{description}</p> : null}
          </header>
        </PageSection>

        {shownIds(faq.sections).map((id) => (
          <PageSection key={id} id={id}>
            <div className={s.sheet}>
              {faq.items.length ? (
                <FoldedList items={faq.items} />
              ) : (
                <p className={s.empty}>Questions will be published here.</p>
              )}
            </div>
          </PageSection>
        ))}
      </div>
    </Container>
  );
}
