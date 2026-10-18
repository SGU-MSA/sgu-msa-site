import type { ReactNode } from "react";

/** Small label used where governance or provenance status matters. */
export function PocBadge({ children = "POC" }: { children?: ReactNode }) {
  return <span className="poc-badge">{children}</span>;
}

/** Marks archive imagery so nothing historical reads as current. */
export function ArchiveTag({ year }: { year?: string | number | null }) {
  return <span className="archive-tag">Archive{year ? ` · ${year}` : ""}</span>;
}
