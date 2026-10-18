import Link from "next/link";
import type { CommunityRecord } from "@/lib/community/schema";
import { Container } from "@/shared/ui/Container";

import h from "../home/home.module.css";

/**
 * The featured announcement as a hairline strip under Home's hero. Markup
 * only: Home (`HomeNotice`) and the announcement editor's Preview render the
 * same strip.
 */
export function NoticeStrip({
  notice,
}: {
  notice: Pick<CommunityRecord, "id" | "title" | "summary">;
}) {
  return (
    <aside aria-label="Community notice" className={h.notice}>
      <Container>
        <Link
          className={h.noticeLink}
          href={`/community/announcements/${notice.id}`}
        >
          <span className={h.noticeLabel} aria-hidden="true">
            Notice
          </span>
          <strong className={h.noticeTitle}>{notice.title}</strong>
          <span className={h.noticeSummary}>
            {notice.summary || "Read the announcement"} →
          </span>
        </Link>
      </Container>
    </aside>
  );
}
