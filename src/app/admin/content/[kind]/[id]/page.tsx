import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/backend/server";
import { listAdminRecords, readAdminRecord } from "@/lib/backend/admin-content";
import {
  collectionSchema,
  currentUrgentNotices,
  duplicableCollections,
  localDate,
  startFrom,
  type Collection,
  type CommunityRecord,
} from "@/lib/community/schema";
import { z } from "@/lib/validation/zod";
import { clock } from "@/lib/runtime/providers";
import {
  purgeRecordAction,
  restoreRecordAction,
} from "@/features/admin/actions";
import { ArchivedEntry } from "@/features/admin/ArchivedEntry";
import { ContentEditor } from "@/features/admin/ContentEditor";
import { AdminHeader } from "@/features/admin/AdminHeader";
import { ticketChoices } from "@/features/admin/event-tickets";
import { eventSeasonChoices } from "@/features/admin/event-seasons";
import { eventListChoices } from "@/features/admin/event-lists";
import { collectionLabels, createFromWords } from "@/features/admin/fields";
import { boardPage } from "@/features/admin/page-state/board-page";
import { AppearsOn } from "@/features/admin/AppearsOn";

/** The urgent notices visitors see now, but this one ("Urgent now: N", PR5a D-16). */
async function otherUrgentNotices(id: string) {
  const { records } = await listAdminRecords("announcements", "current");
  return currentUrgentNotices(records ?? [], clock().now())
    .filter((notice) => notice.id !== id)
    .map(({ title, urgent_until }) => ({ title, urgent_until }));
}

/**
 * The saved item a new one starts from (`?from=<id>`, review fixes P3), or
 * null: only events and announcements, and only a current item.
 */
async function startingItem(
  kind: Collection,
  from: string | string[] | undefined,
): Promise<CommunityRecord | null> {
  const id = z.uuid().safeParse(from);
  if (
    !id.success ||
    !(duplicableCollections as readonly Collection[]).includes(kind)
  )
    return null;
  const record = await readAdminRecord(kind, id.data);
  return record && !record.archived_at ? record : null;
}

async function EditPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdmin();
  const { kind: requested, id } = await params;
  const { from } = await searchParams;
  const kind = collectionSchema.safeParse(requested);
  if (!kind.success) notFound();
  let record: CommunityRecord;
  // "Create from this event" (review fixes P3): a saved item's details, no date.
  const source = id === "new" ? await startingItem(kind.data, from) : null;
  if (source) record = startFrom(source, crypto.randomUUID());
  else if (id === "new")
    record = {
      id: crypto.randomUUID(),
      title: "",
      summary: "",
      body: "",
      date: localDate(clock().now()),
      expires_on: "",
      start_time: "",
      end_date: "",
      end_time: "",
      location: "",
      url: "",
      image_path: "",
      image_alt: "",
      file_path: "",
      published: false,
      featured: false,
      urgent_until: "",
      status: "scheduled",
      status_note: "",
      ticket_payment_item_id: "",
      season_id: "",
      category_id: "",
      term_id: "",
    };
  else {
    const data = await readAdminRecord(kind.data, id);
    if (!data) notFound();
    record = data;
  }
  const label = collectionLabels[kind.data];
  if (record.archived_at && record.updated_at)
    return (
      <div className="admin-shell narrow">
        <AdminHeader
          title={`Archived · ${label}`}
          parents={[
            { label, href: `/admin/content/${kind.data}` },
            {
              label: "Archived",
              href: `/admin/content/${kind.data}?view=archived`,
            },
          ]}
          current={record.title || "Untitled"}
        />
        <ArchivedEntry
          heading={record.title}
          intro="This item is not on the website and cannot be edited. Restore it to edit it again: it comes back as an unpublished draft."
          details={[
            ["Date", record.date],
            // An event's form has no summary (it moves into the description, D-7).
            ...(kind.data === "events"
              ? []
              : [["Short summary", record.summary] as const]),
            [
              "Published before it was archived",
              record.published ? "Yes" : "No",
            ],
          ]}
          target={{
            collection: kind.data,
            id: record.id,
            version: record.updated_at,
          }}
          restore={{ action: restoreRecordAction }}
          purge={{
            action: purgeRecordAction,
            allowed: admin.canManagePeople,
            note: "Its image or PDF is deleted too, unless another item uses it.",
          }}
        />
      </div>
    );
  return (
    <div className="admin-shell narrow">
      <AdminHeader
        title={`${id === "new" ? "Create" : "Edit"} · ${label}`}
        parents={[{ label, href: `/admin/content/${kind.data}` }]}
        current={id === "new" ? "New" : record.title || "Edit"}
        tour="content"
      />
      <AppearsOn area={kind.data} />
      {source ? (
        <p role="status" className="muted">
          {createFromWords.started(source.title)}
        </p>
      ) : null}
      <ContentEditor
        kind={kind.data}
        record={record}
        today={localDate(clock().now())}
        urgentNow={
          kind.data === "announcements"
            ? await otherUrgentNotices(record.id)
            : []
        }
        tickets={
          kind.data === "events" ? await ticketChoices(record.id) : undefined
        }
        seasons={
          kind.data === "events"
            ? await eventSeasonChoices(record.season_id)
            : undefined
        }
        lists={kind.data === "events" ? await eventListChoices() : undefined}
      />
    </div>
  );
}

export default boardPage(EditPage);
