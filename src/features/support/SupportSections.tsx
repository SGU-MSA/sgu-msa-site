import { Mail, Phone, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

import { shownIds, type SectionId } from "@/lib/content/page-layouts";
import { PageSection } from "@/shared/layout/PageSection";
import type { SupportContent } from "@/lib/content/schemas";
import { externalLinkProps, safeHref } from "@/lib/url";
import { Container } from "@/shared/ui/Container";
import { PocBadge } from "@/shared/ui/Meta";
import { PageHero } from "@/shared/ui/PageHero";
import { Section } from "@/shared/ui/Section";

/**
 * The Support page's sections: the heading and the governance statement,
 * then the privacy note, who students can reach and professional SGU
 * support in the order the board set in Pages, without the hidden ones
 * (review 3 B).
 * Presentational (PR5b WP4): the page passes the stored text (and shows it
 * only while the page is switched on), the Pages preview the typed text.
 */
export function SupportSections({ support }: { support: SupportContent }) {
  // Only contacts visitors can reach: no "to be confirmed" cards (review fixes P3).
  const reachable = support.contacts.items.filter(
    (contact) =>
      contact.status !== "details_pending" &&
      Boolean(
        safeHref(contact.email ? `mailto:${contact.email}` : null) ||
        contact.phone ||
        safeHref(contact.link),
      ),
  );
  const showNotice = support.prototype_notice;
  const sections: Record<SectionId<"support">, ReactNode> = {
    privacy: (
      <Section tight>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] lg:gap-16">
          <div>
            <p className="section-kicker inline-flex items-center gap-2">
              <ShieldCheck
                aria-hidden="true"
                className="size-4"
                strokeWidth={1.35}
              />
              Privacy
            </p>
            <h2
              className="mt-3 font-serif leading-[1.06] tracking-[-0.025em] text-[var(--ink)]"
              style={{ fontSize: "var(--type-h2)" }}
            >
              {support.privacy.heading}
            </h2>
          </div>
          <div className="editorial-copy lg:pt-2">
            <p>{support.privacy.body}</p>
          </div>
        </div>
      </Section>
    ),
    contacts: (
      <Section
        kicker="Reach out"
        title={support.contacts.heading}
        intro={support.contacts.note}
        bordered
      >
        {reachable.length ? (
          <div className="grid border-l border-t border-[var(--rule)] sm:grid-cols-2 lg:grid-cols-4">
            {reachable.map((contact) => {
              const email = safeHref(
                contact.email ? `mailto:${contact.email}` : null,
              );
              const link = safeHref(contact.link);

              return (
                <div
                  key={contact.id}
                  className="flex flex-col border-b border-r border-[var(--rule)] px-5 py-6"
                >
                  <h3 className="font-serif text-xl text-[var(--ink)]">
                    {contact.role}
                  </h3>
                  {contact.description ? (
                    <p className="mt-2 text-[0.8rem] leading-6 text-[var(--muted)]">
                      {contact.description}
                    </p>
                  ) : null}

                  <div className="mt-5 space-y-2 border-t border-[var(--rule)] pt-4">
                    {email ? (
                      <a
                        href={email}
                        className="inline-flex min-h-9 items-center gap-2 break-all text-[0.8rem] text-[var(--ink)] hover:text-[var(--ring)]"
                      >
                        <Mail
                          aria-hidden="true"
                          className="size-3.5 shrink-0"
                          strokeWidth={1.35}
                        />
                        {contact.email}
                      </a>
                    ) : null}
                    {/* A phone number appears only when one is configured. */}
                    {contact.phone ? (
                      <a
                        href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}
                        className="inline-flex min-h-9 items-center gap-2 text-[0.8rem] text-[var(--muted)] hover:text-[var(--ink)]"
                      >
                        <Phone
                          aria-hidden="true"
                          className="size-3.5 shrink-0"
                          strokeWidth={1.35}
                        />
                        {contact.phone}
                      </a>
                    ) : null}
                    {link ? (
                      <a
                        href={link}
                        {...externalLinkProps(link)}
                        className="inline-flex min-h-9 items-center text-[0.8rem] text-[var(--ink)] hover:text-[var(--ring)]"
                      >
                        Contact form
                      </a>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </Section>
    ),
    professional: (
      <Section
        kicker="Beyond peer support"
        title={support.professional.heading}
        intro={support.professional.body}
        tone="elevated"
        bordered
      >
        {support.professional.items.length ? (
          <ul className="divide-y divide-[var(--rule)] border-y border-[var(--rule)]">
            {support.professional.items.map((item) => {
              const url =
                item.status === "details_pending" ? null : safeHref(item.url);
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 py-5"
                >
                  <div className="min-w-0">
                    <p className="text-base text-[var(--ink)]">{item.name}</p>
                    {item.description ? (
                      <p className="mt-1.5 text-[0.8rem] leading-6 text-[var(--muted)]">
                        {item.description}
                      </p>
                    ) : null}
                  </div>
                  {url ? (
                    <a
                      href={url}
                      {...externalLinkProps(url)}
                      className="text-[0.75rem] uppercase tracking-[0.12em] text-[var(--ring)] hover:text-[var(--ink)]"
                    >
                      Visit
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </Section>
    ),
  };

  return (
    <>
      <PageSection id="top">
        <PageHero
          eyebrow={support.hero.eyebrow}
          title={support.hero.title}
          description={support.hero.description}
          image={support.hero.image}
          compact
          badge={
            showNotice ? (
              <PocBadge>{support.prototype_label}</PocBadge>
            ) : undefined
          }
        />

        {/* ---- governance statement: wording lives in support.yaml, because it
              is the sentence most likely to be reworded during review ---- */}
        {showNotice && support.governance_notice ? (
          <div className="border-b border-[var(--rule)] bg-[var(--paper-light)]">
            <Container className="py-5">
              <p className="max-w-3xl text-[0.78rem] leading-6 text-[var(--muted)]">
                {support.governance_notice}
              </p>
            </Container>
          </div>
        ) : null}
      </PageSection>

      {shownIds(support.sections).map((id) => (
        <PageSection key={id} id={id}>
          {sections[id]}
        </PageSection>
      ))}
    </>
  );
}
