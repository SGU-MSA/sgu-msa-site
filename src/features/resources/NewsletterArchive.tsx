import type { NewslettersContent } from "@/lib/content/schemas";
import { externalLinkProps, isExternalHref, safeHref } from "@/lib/url";

import { newsletterButton } from "./library";
import r from "./resources.module.css";

/**
 * The newsletter archive as a ledger by period.
 *
 * Presented as an archive throughout: each issue is labelled with the period
 * it covers, so nothing implies that an older edition is the current one.
 */
export function NewsletterArchive({
  content,
}: {
  /** Only the issues are read (the newsletter editor's Preview passes one). */
  content: Pick<NewslettersContent, "issues">;
}) {
  if (!content.issues.length) {
    return <p className={r.quiet}>Newsletter editions will be listed here.</p>;
  }

  return (
    <ul className={r.ledger}>
      {content.issues.map((issue) => {
        const href = safeHref(issue.file_url);
        return (
          <li key={issue.id} className={r.ledgerRow}>
            <p className={r.period}>{issue.period}</p>
            <div>
              <p className={r.meta}>
                {issue.label}
                {issue.edition ? (
                  <>
                    <span aria-hidden="true"> · </span>
                    {issue.edition}
                  </>
                ) : null}
              </p>
              {issue.summary ? <p className={r.desc}>{issue.summary}</p> : null}
            </div>
            {href ? (
              <a
                href={href}
                {...(isExternalHref(href) ? externalLinkProps(href) : {})}
                className={r.open}
              >
                {newsletterButton(href)}
              </a>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
