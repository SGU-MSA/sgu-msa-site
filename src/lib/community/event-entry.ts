import type { SiteEvent } from "../content/schemas";
import { categoryTone, emptyLists, type Lists } from "./lists";
import type { CommunityRecord } from "./schema";

/**
 * One dashboard event as the public views show it (PR5a): the public loader
 * (`managedEvents`) and the editor's Preview build it the same way. Pure and
 * browser-safe, so the Preview can call it with typed values. Sandbox
 * events look exactly like live ones (review fixes PR-1).
 */
export function eventEntry(
  record: CommunityRecord,
  /** The Lists, for the event's category and term (review fixes P3). */
  lists: Lists = emptyLists(),
): SiteEvent {
  const categoryAt = lists.event_categories.findIndex(
    (option) => option.id === record.category_id,
  );
  const category = lists.event_categories[categoryAt];
  const term = lists.terms.find((option) => option.id === record.term_id);
  return {
    id: record.id,
    title: record.title,
    description: record.body || record.summary,
    date: record.date,
    start_time: record.start_time,
    end_date: record.end_date || null,
    end_time: record.end_time,
    location: record.location,
    registration_url: record.url,
    category: category?.slug ?? null,
    category_name: category?.name ?? null,
    category_tone: category ? categoryTone(categoryAt) : null,
    term: term?.slug ?? null,
    term_name: term?.name ?? null,
    organization: "MSA",
    visibility: "public",
    featured: record.featured,
    verification_status: "verified",
    image: record.image_path
      ? {
          src: `/media/${record.image_path}`,
          alt: record.image_alt,
          historical: false,
        }
      : null,
    status: record.status,
    status_note: record.status_note,
    ticket_payment_item_id: record.ticket_payment_item_id || null,
    updated_at: record.updated_at ?? null,
  };
}

/**
 * One dashboard newsletter as the public archive row shows it (PR5a): the
 * Resources page and the newsletter editor's Preview build it the same way.
 */
export function newsletterIssue(record: CommunityRecord) {
  return {
    id: record.id,
    label: record.title,
    period: record.date,
    summary: record.summary,
    file_url: record.file_path ? `/media/${record.file_path}` : record.url,
  };
}
