import Link from "next/link";
import { Lock } from "lucide-react";

import type { Reminder } from "@/lib/content/schemas";
import { externalLinkProps, safeHref } from "@/lib/url";

import { ArabicLine } from "@/shared/ui/ArabicLine";
import { Container } from "@/shared/ui/Container";
import { MeaningTip } from "@/shared/ui/MeaningTip";
import { Seal } from "@/shared/ui/Seal";
import { SocialIcon } from "@/shared/ui/SocialIcon";

type FooterLink = { label: string; href: string };

type SocialLink = { id?: string; label: string; url: string; kind?: string };

type FooterProps = {
  /** The organisation's full name (Site-wide), in the copyright line. */
  name: string;
  shortName: string;
  university: string;
  tagline: string;
  quickLinks: FooterLink[];
  socialLinks: SocialLink[];
  email?: string | null;
  /**
   * The verse placed at the bottom of every page (PR5b D-24), Arabic with its
   * "?" meaning. Missing when none is placed or the library is unavailable:
   * nothing shows.
   */
  verse?: Reminder | null;
  /** This year on the server clock: the copyright line follows it. */
  year: number;
  /** Discreet board entry point — never in the primary navigation. */
  adminLink?: FooterLink | null;
};

export function Footer({
  name,
  shortName,
  university,
  tagline,
  quickLinks,
  socialLinks,
  email,
  verse,
  year,
  adminLink,
}: FooterProps) {
  const adminHref = adminLink ? safeHref(adminLink.href) : null;

  return (
    <footer className="site-footer">
      <Container className="grid gap-10 py-14 lg:grid-cols-[1.2fr_.9fr_.7fr_1.15fr] lg:gap-10">
        <div className="flex items-start gap-4">
          <Seal size={48} />
          <div>
            <p className="text-base font-semibold text-[var(--ink)]">
              {shortName}
            </p>
            <p className="mt-2 max-w-[15rem] text-sm leading-6">{university}</p>
            <p className="mt-3 text-sm">{tagline}</p>
          </div>
        </div>

        <div>
          <p className="footer-label">Quick links</p>
          <div className="mt-3 grid grid-cols-2 gap-x-5 sm:mt-4">
            {quickLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-11 items-center text-sm lg:min-h-10"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="footer-label">Connect</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {socialLinks.map((item) => {
              const href = safeHref(item.url);
              if (!href) return null;
              return (
                <a
                  key={`${item.id ?? item.label}-${href}`}
                  href={href}
                  aria-label={item.label}
                  {...externalLinkProps(href)}
                  className="nav-icon-button inline-grid"
                >
                  <SocialIcon kind={item.kind} />
                </a>
              );
            })}
          </div>
          {email ? (
            <a
              href={`mailto:${email}`}
              className="mt-3 flex min-h-11 items-center break-all text-sm"
            >
              {email}
            </a>
          ) : null}
        </div>

        {verse ? (
          <figure className="footer-verse m-0" aria-label="Reminder">
            <div className="flex items-center gap-1">
              <ArabicLine
                as="blockquote"
                text={verse.arabic}
                className="footer-verse-arabic m-0"
              />
              <MeaningTip reminder={verse} />
            </div>
          </figure>
        ) : null}
      </Container>

      <Container className="flex flex-col items-center gap-3 border-t border-[var(--rule)] py-5 text-xs sm:flex-row sm:justify-between">
        <p>{`© ${year} ${name}. All rights reserved.`}</p>
        {adminHref ? (
          <Link
            href={adminHref}
            className="inline-flex min-h-11 items-center gap-1.5"
          >
            <Lock aria-hidden="true" className="size-3" strokeWidth={1.5} />
            {adminLink?.label}
          </Link>
        ) : null}
      </Container>
    </footer>
  );
}
