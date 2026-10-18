import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "@/lib/validation/zod";
import { requireAdmin } from "@/lib/backend/server";
import {
  listActivity,
  listActivityLogins,
  listAdminPeople,
  listAdminSections,
} from "@/lib/backend/admin-content";
import {
  allAdminPaymentItems,
  listAdminSeasons,
} from "@/lib/backend/admin-payments";
import {
  activityFilterQuery,
  activityFiltersFrom,
  activityHref,
  activityKinds,
  ownerActor,
  type ActivityFilters,
} from "@/lib/community/activity";
import { dayLabel } from "@/lib/time/date-label";
import { merchEditor } from "@/lib/runtime/providers";
import { AdminHeader } from "@/features/admin/AdminHeader";
import { ActivityFeed } from "@/features/admin/ActivityFeed";
import { boardPage } from "@/features/admin/page-state/board-page";
import { DateField } from "@/shared/ui/DateField";
import { anyDate, dayRange } from "@/lib/time/field-rules";

const pageSize = 25;
/** `?before=` is the oldest entry id on the previous page. */
const olderThan = z.coerce.number().int().positive();

/**
 * People and section names for the entries that only refer to them by id,
 * and "Who": everyone who has or had a login (a removed one too), by People
 * name, with all of their logins (D-10, E-25). `unavailable` when any list
 * could not be read, so the page can say why some entries show without a
 * name.
 */
async function activityNames() {
  const [
    current,
    archived,
    sections,
    archivedSections,
    logins,
    giving,
    seasons,
    archivedSeasons,
    collections,
    archivedCollections,
    items,
    archivedItems,
  ] = await Promise.all([
    listAdminPeople(),
    listAdminPeople("archived"),
    listAdminSections(),
    listAdminSections("archived"),
    listActivityLogins(),
    allAdminPaymentItems(),
    listAdminSeasons(),
    listAdminSeasons("archived"),
    merchEditor().listCollections(),
    merchEditor().listCollections("archived"),
    merchEditor().listItems(),
    merchEditor().listItems("archived"),
  ]);
  const people = new Map(
    [...current.people, ...archived.people].map(
      (person) => [person.id, person.full_name] as const,
    ),
  );
  const loginsOf = new Map<string, string[]>();
  for (const { userId, personId } of logins.logins)
    loginsOf.set(personId, [...(loginsOf.get(personId) ?? []), userId]);
  const names = new Map<string, string>([
    ...people,
    ...[...sections.sections, ...archivedSections.sections].map(
      (section) => [section.id, section.name] as const,
    ),
    // PR6: a fund's season and a Go2Pay link's fund or ticket, by name.
    ...[...giving.items, ...seasons.seasons, ...archivedSeasons.seasons].map(
      (row) => [row.id, row.name] as const,
    ),
    // PR5c: a merch item's collection and a size's merch item, by name.
    ...[
      ...collections.collections,
      ...archivedCollections.collections,
      ...items.items,
      ...archivedItems.items,
    ].map((row) => [row.id, row.name] as const),
  ]);
  const unavailable = [
    current,
    archived,
    sections,
    archivedSections,
    logins,
    giving,
    seasons,
    archivedSeasons,
    collections,
    archivedCollections,
    items,
    archivedItems,
  ].some((list) => list.unavailable);
  // A person deleted for good has no name left to list.
  const who = [...loginsOf.keys()]
    .flatMap((id) => {
      const name = people.get(id);
      return name ? [{ id, name }] : [];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    names,
    unavailable,
    who,
    loginsOf: (personId: string) => loginsOf.get(personId) ?? [],
    loginsUnavailable: logins.unavailable,
  };
}

/**
 * Who / What / From / Until (D-10, mockup `activity-filters`): a plain GET
 * form, so the filters live in the address (E-9) and work without
 * JavaScript.
 */
function Filters({
  filters,
  who,
}: {
  filters: ActivityFilters;
  who: readonly { id: string; name: string }[];
}) {
  return (
    <form
      method="get"
      action="/admin/activity"
      className="editor-form activity-filters"
      data-tour="activity-filters"
    >
      <label>
        Who
        <select name="who" defaultValue={filters.who ?? ""}>
          <option value="">Everyone</option>
          {who.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
          <option value={ownerActor}>Site owner</option>
        </select>
      </label>
      <label>
        What
        <select name="what" defaultValue={filters.what ?? ""}>
          <option value="">Everything</option>
          {Object.entries(activityKinds).map(([key, kind]) => (
            <option key={key} value={key}>
              {kind.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        From
        <DateField
          name="from"
          rule={anyDate}
          defaultValue={filters.from ?? ""}
        />
      </label>
      <label>
        Until
        <DateField
          name="to"
          rule={dayRange({ from: { box: "from" } })}
          defaultValue={filters.to ?? ""}
        />
      </label>
      <button className="button-primary">Show</button>
    </form>
  );
}

/** "Showing changes by Aisha to Events from 1 Sep 2026, newest first." */
function filterSummary(
  filters: ActivityFilters,
  who: readonly { id: string; name: string }[],
) {
  const person =
    filters.who === ownerActor
      ? "the site owner"
      : who.find((entry) => entry.id === filters.who)?.name;
  return [
    "Showing changes",
    filters.who ? ` by ${person ?? "one person"}` : "",
    filters.what ? ` to ${activityKinds[filters.what].label}` : "",
    filters.from ? ` from ${dayLabel(filters.from)}` : "",
    filters.to ? ` until ${dayLabel(filters.to)}` : "",
    ", newest first.",
  ].join("");
}

async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const { before: requested } = query;
  const filters = activityFiltersFrom(query);
  const filtered = Object.keys(filters).length > 0;
  let before: number | undefined;
  if (requested !== undefined) {
    const parsed = olderThan.safeParse(requested);
    if (!parsed.success) notFound();
    before = parsed.data;
  }
  // "Who" needs every login of the chosen person first.
  const named = await activityNames();
  // One extra entry says whether an older page exists.
  const list = await listActivity({
    before,
    limit: pageSize + 1,
    ...activityFilterQuery(filters, named.loginsOf),
  });
  const { entries } = list;
  // Without the logins, a person's changes cannot be picked out.
  const unavailable =
    list.unavailable ||
    (named.loginsUnavailable &&
      filters.who !== undefined &&
      filters.who !== ownerActor);
  const shown = entries.slice(0, pageSize);
  const older = entries.length > pageSize ? shown.at(-1)?.id : undefined;
  return (
    <div className="admin-shell">
      <AdminHeader title="Recent changes" tour="activity" />
      <Filters filters={filters} who={named.who} />
      {filtered ? (
        <p className="muted">
          {filterSummary(filters, named.who)}{" "}
          <Link className="text-link" href="/admin/activity">
            Clear filters
          </Link>
        </p>
      ) : null}
      {unavailable ? (
        <p role="alert" className="content-card">
          Recent changes could not be loaded. Check your connection and reload.
        </p>
      ) : shown.length ? (
        <>
          {named.unavailable ? (
            <p role="status" className="content-card">
              Names could not be loaded; some entries show without a name.
              Reload to try again.
            </p>
          ) : null}
          <div data-tour="activity-feed">
            <ActivityFeed entries={shown} names={named.names} />
          </div>
        </>
      ) : (
        <p className="content-card">
          {before !== undefined
            ? "There are no older changes."
            : filtered
              ? "No changes match these filters."
              : "No changes yet."}
        </p>
      )}
      <div className="admin-actions">
        {before !== undefined ? (
          <Link className="button-secondary" href={activityHref(filters)}>
            Newest changes
          </Link>
        ) : null}
        {older !== undefined ? (
          <Link
            className="button-secondary"
            href={activityHref(filters, older)}
          >
            Older changes
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export default boardPage(ActivityPage);
