"use client";
import type { ReactNode } from "react";

import { EventDetail } from "@/features/calendar/EventDetail";
import { CommunityPost } from "@/features/community/CommunityPost";
import { KIND_LABEL } from "@/features/community/feed";
import { NoticeStrip } from "@/features/community/NoticeStrip";
import { NewsletterArchive } from "@/features/resources/NewsletterArchive";
import { eventEntry, newsletterIssue } from "@/lib/community/event-entry";
import {
  announcementPriority,
  type Collection,
  type CommunityRecord,
} from "@/lib/community/schema";
import { shortDateLabel } from "@/lib/time/date-label";
import { UrgentNoticeRotator } from "@/shared/ui/UrgentNoticeRotator";

import { recordFromTyped } from "../form-state";
import { PreviewPaper } from "./PreviewPaper";

/** The item as typed: the saved item with the form's values over it. */
function typedItem(
  stored: CommunityRecord,
  values: Record<string, string>,
): CommunityRecord {
  return { ...stored, ...recordFromTyped(values) } as CommunityRecord;
}

/**
 * "Scheduled: appears on 10 Oct" when a "Show from" (or a news or newsletter
 * date) is later than today (PR5a, Design → Urgent notices). Events show
 * before their date, so they never say it. `today` is the server's Grenada
 * day, as the public pages use.
 */
function Scheduled({
  kind,
  date,
  today,
}: {
  kind: Collection;
  date: string;
  today: string;
}) {
  if (kind === "events" || !date || date <= today) return null;
  return (
    <p className="editor-preview-note">
      Scheduled: appears on {shortDateLabel(date)}
    </p>
  );
}

/**
 * Each kind's public parts, rendered from the typed item (never a copy of
 * their markup). An event is its whole page (`EventDetail`).
 */
function Parts({ kind, item }: { kind: Collection; item: CommunityRecord }) {
  switch (kind) {
    case "events":
      return <EventDetail event={eventEntry(item)} />;
    case "announcements": {
      const priority = announcementPriority(item);
      return (
        <>
          {priority === "featured" ? <NoticeStrip notice={item} /> : null}
          {priority === "urgent" ? (
            <UrgentNoticeRotator
              notices={[
                {
                  id: item.id,
                  title: item.title,
                  href: `/community/announcements/${item.id}`,
                },
              ]}
            />
          ) : null}
          <CommunityPost row={item} kind={KIND_LABEL.announcements} />
        </>
      );
    }
    case "news_posts":
      return <CommunityPost row={item} kind={KIND_LABEL.news_posts} />;
    case "newsletters":
      return (
        <NewsletterArchive content={{ issues: [newsletterIssue(item)] }} />
      );
  }
}

/**
 * A content editor's Preview (PR5a D-11): what visitors will see, built by
 * the same view builders as the public pages (`eventEntry`,
 * `newsletterIssue`) and drawn by the public components themselves.
 */
export function contentPreview(
  kind: Collection,
  stored: CommunityRecord,
  /** Today in Grenada on the server clock (`localDate(clock().now())`). */
  today: string,
): (values: Record<string, string>) => ReactNode {
  return function ContentPreview(values) {
    const item = typedItem(stored, values);
    if (kind === "events") return <Parts kind={kind} item={item} />;
    return (
      <PreviewPaper>
        <Scheduled kind={kind} date={item.date} today={today} />
        <Parts kind={kind} item={item} />
      </PreviewPaper>
    );
  };
}
