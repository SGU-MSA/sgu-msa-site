import type { ReactNode } from "react";

/**
 * One section of a public page, drawn where the board put it in Pages
 * (review 3 B). It lays nothing out (`display: contents`): it only names
 * the section, so the Pages preview can scroll to the section being edited
 * (`pageSectionSelector`).
 */
export function PageSection({
  id,
  joined,
  children,
}: {
  /** The section's id (`page-layouts.ts`); "top" for the page top. */
  id: string;
  /** A section drawn together with this one (Jumu'ah beside today's times). */
  joined?: string;
  children: ReactNode;
}) {
  return (
    <div
      data-page-section={joined ? `${id} ${joined}` : id}
      className="contents"
    >
      {children}
    </div>
  );
}

/** The CSS selector of a page section drawn by `PageSection`. */
export const pageSectionSelector = (id: string) =>
  `[data-page-section~="${CSS.escape(id)}"]`;
