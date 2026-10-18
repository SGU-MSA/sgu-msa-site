import type { ReactNode } from "react";

/** Small label used where governance or provenance status matters. */
export function PocBadge({ children = "POC" }: { children?: ReactNode }) {
  return <span className="poc-badge">{children}</span>;
}
