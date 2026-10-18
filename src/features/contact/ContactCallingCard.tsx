import type { ReactNode } from "react";
import Link from "next/link";

import { shownIds, type SectionId } from "@/lib/content/page-layouts";
import { PageSection } from "@/shared/layout/PageSection";
import { InkHeading } from "@/shared/ui/InkHeading";
import quiet from "@/shared/ui/page.module.css";
import type { ContactContent, SiteContent } from "@/lib/content/schemas";
import { externalLinkProps, safeHref } from "@/lib/url";
import { Container } from "@/shared/ui/Container";
import { InkRing } from "@/shared/ui/InkRing";
import { SocialIcon } from "@/shared/ui/SocialIcon";

import c from "./contact.module.css";

/**
 * The Contact page as a calling card (PR8 D-10, option A "Calling card"): the
 * welcome beside a paper card holding the email (in the page's one ink ring)
 * and the social links; below, the Musallah note beside the "Find us on
 * campus" box, which the page passes in unchanged. The card and the Musallah
 * note follow the order the board set in Pages, without the hidden ones
 * (review 3 B); the card stays beside the welcome while it comes first. No
 * verse (contract). The
 * words are page text (Pages → Contact, PR5b); the email and social links
 * come from Site-wide.
 */
export function ContactCallingCard({
  content,
  email,
  social,
  map,
}: {
  content: ContactContent;
  email?: string | null;
  social: SiteContent["social"];
  /** The shared "Find us on campus" box (LocationMap), placed as is. */
  map: ReactNode;
}) {
  const mailto = email ? safeHref(`mailto:${email}`) : null;
  // The email above already carries the address, so its duplicate row is skipped.
  const links = social.flatMap((item) => {
    const href = safeHref(item.url);
    return href && href !== mailto ? [{ ...item, href }] : [];
  });

  const card = (
    <div className={c.card}>
      <InkHeading
        id="contact-touch"
        text={content.card.heading}
        className={quiet.h2Small}
        inline
      />
      {mailto ? (
        <>
          {content.card.email_intro ? (
            <p className={c.body}>{content.card.email_intro}</p>
          ) : null}
          <p className={c.ringed}>
            <span className={c.ringBox}>
              <InkRing />
            </span>
            <a href={mailto} className={c.email}>
              {email}
            </a>
          </p>
        </>
      ) : (
        <p className={c.pending}>{content.card.no_email}</p>
      )}
      {links.length ? (
        <ul className={c.social}>
          {links.map((item) => (
            <li key={`${item.id}-${item.href}`}>
              <a href={item.href} {...externalLinkProps(item.href)}>
                <SocialIcon kind={item.kind} className={c.icon} />
                <span className={c.label}>{item.label}</span>
                <span aria-hidden="true" className={c.arrow}>
                  ↗
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
  const shown = shownIds(content.sections);
  // The card sits beside the welcome while it comes first (PR8 D-10).
  const cardBeside = shown[0] === "card";
  const sections: Record<SectionId<"contact">, ReactNode> = {
    card: cardBeside ? null : (
      <section
        className={`${quiet.rule} ${c.alone}`}
        aria-labelledby="contact-touch"
      >
        {card}
      </section>
    ),
    visit: (
      <section
        className={`${quiet.rule} ${c.visit}`}
        aria-labelledby="contact-musallah"
      >
        <div>
          <InkHeading
            id="contact-musallah"
            text={content.visit.heading}
            className={quiet.h2Small}
            inline
          />
          {content.visit.body ? (
            <p className={c.body}>{content.visit.body}</p>
          ) : null}
          <div className={quiet.actions}>
            <Link href="/prayer#find-the-musallah" className={quiet.underline}>
              <span>{content.visit.link_label}</span>
            </Link>
          </div>
        </div>
        <div className={c.map}>{map}</div>
      </section>
    ),
  };

  return (
    <Container className={quiet.above}>
      <PageSection id="top" joined={cardBeside ? "card" : undefined}>
        <section
          className={c.top}
          aria-labelledby={cardBeside ? "contact-touch" : "contact-title"}
        >
          <header className={quiet.enter}>
            {content.eyebrow ? (
              <p className={quiet.eyebrow}>{content.eyebrow}</p>
            ) : null}
            <h1 id="contact-title" className={`${quiet.display} ${c.title}`}>
              {content.title}
            </h1>
            {content.description ? (
              <p className={c.sub}>{content.description}</p>
            ) : null}
          </header>
          {cardBeside ? card : null}
        </section>
      </PageSection>
      {shown.map((id) =>
        sections[id] ? (
          <PageSection key={id} id={id}>
            {sections[id]}
          </PageSection>
        ) : null,
      )}
    </Container>
  );
}
