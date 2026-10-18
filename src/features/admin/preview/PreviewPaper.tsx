import type { ReactNode } from "react";
import { Container } from "@/shared/ui/Container";
import quiet from "@/shared/ui/page.module.css";
import s from "./preview.module.css";

/**
 * A preview that is not a whole public page (a content item's parts, a
 * fund's slip): on the page's paper, inside the page's margins, as the
 * public pages draw their parts.
 */
export function PreviewPaper({ children }: { children: ReactNode }) {
  return (
    <div className={quiet.page}>
      <Container className={s.page}>{children}</Container>
    </div>
  );
}
