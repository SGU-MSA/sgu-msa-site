import Link from "next/link";
import type { ListView } from "./fields";

/** The Current and Archived tabs of a board list (ADR 0013); the view is in the URL. */
export function ViewTabs({
  href,
  view,
  label,
}: {
  /** The list's path; Archived adds `?view=archived`. */
  href: string;
  view: ListView;
  /** What the tabs switch between, for screen readers ("Events"). */
  label: string;
}) {
  return (
    <nav className="admin-actions" aria-label={`${label}: current or archived`}>
      {(["current", "archived"] as const).map((tab) => (
        <Link
          key={tab}
          className="button-secondary"
          href={tab === "archived" ? `${href}?view=archived` : href}
          aria-current={tab === view ? "page" : undefined}
        >
          {tab === "archived" ? "Archived" : "Current"}
        </Link>
      ))}
    </nav>
  );
}
