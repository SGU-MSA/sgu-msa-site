import Link from "next/link";
import {
  listAdminPeople,
  listAdminSections,
} from "@/lib/backend/admin-content";
import type { VersionedPerson } from "@/lib/backend/providers/contract";
import { requireAdmin } from "@/lib/backend/server";
import {
  purgePersonAction,
  restorePersonAction,
} from "@/features/admin/people-actions";
import { ArchivedRow } from "@/features/admin/ArchiveActions";
import { AdminHeader } from "@/features/admin/AdminHeader";
import { OrderedList } from "@/features/admin/OrderedList";
import { FileCleanup } from "@/features/admin/RecordActions";
import { ViewTabs } from "@/features/admin/ViewTabs";
import {
  accessStateLabels,
  leftFiles,
  leftTeamWords,
  listView,
  noPhotoBadge,
} from "@/features/admin/fields";
import { systemText } from "@/lib/system-text";
import { boardPage } from "@/features/admin/page-state/board-page";
import {
  inGroupOrder,
  listedPublicly,
  photoAllowed,
  type Section,
} from "@/lib/community/people";

function Badges({
  person,
  executiveId,
}: {
  person: VersionedPerson;
  /** The Executive board's id: always on About, and the only group with photos. */
  executiveId: string | null;
}) {
  const { access } = person;
  const badges = [
    person.archived_at
      ? "Archived"
      : listedPublicly(person, executiveId)
        ? "On public page"
        : "Not on public page",
    accessStateLabels[access.state],
    ...(access.state !== "none" && access.canManagePeople
      ? ["Manage people"]
      : []),
    ...(access.state !== "none" && access.canManageMoney
      ? ["Manage money"]
      : []),
    // The nudge for an Executive board member's photo (review fixes P4).
    ...(!person.archived_at &&
    photoAllowed(person.section_id, executiveId) &&
    !person.photo_path
      ? [noPhotoBadge]
      : []),
  ];
  return (
    <p className="admin-badges">
      {badges.map((badge, index) => (
        <span
          className={
            badge === noPhotoBadge
              ? "admin-badge admin-badge-nudge"
              : "admin-badge"
          }
          key={badge}
          // Every person's badges carry these; the tour uses the first match.
          data-tour={["people-public", "people-login"][index]}
        >
          {badge}
        </span>
      ))}
    </p>
  );
}

/** One current person on the list: name, role, labels and Edit. */
function PersonRow({
  person,
  executiveId,
}: {
  person: VersionedPerson;
  executiveId: string | null;
}) {
  return (
    <div className="order-row person-row">
      <div>
        <h3>{person.full_name}</h3>
        {person.role_title ? (
          <p className="muted">{person.role_title}</p>
        ) : null}
        <Badges person={person} executiveId={executiveId} />
      </div>
      <Link className="button-secondary" href={`/admin/people/${person.id}`}>
        Edit
        <span className="sr-only"> {person.full_name}</span>
      </Link>
    </div>
  );
}

async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [query, admin] = await Promise.all([searchParams, requireAdmin()]);
  const view = listView(query.view);
  const archived = view === "archived";
  const [peopleResult, sectionsResult] = await Promise.all([
    listAdminPeople(view),
    listAdminSections(),
  ]);
  const unavailable = peopleResult.unavailable || sectionsResult.unavailable;
  const { people } = peopleResult;
  const executiveId =
    sectionsResult.sections.find((section) => section.kind === "executive")
      ?.id ?? null;
  const groups: {
    id: string;
    name: string;
    kind: Section["kind"];
    people: VersionedPerson[];
  }[] = sectionsResult.sections.map((section) => ({
    id: section.id,
    name: section.name,
    kind: section.kind,
    // The Executive board is listed by role (review 2).
    people: inGroupOrder(
      section.kind,
      people.filter((person) => person.section_id === section.id),
    ),
  }));
  // Nobody is hidden: a person whose group is no longer current still shows.
  const placed = new Set(groups.flatMap((group) => group.people));
  const unplaced = people.filter((person) => !placed.has(person));
  if (unplaced.length)
    groups.push({
      id: "unplaced",
      name: "In an archived group",
      kind: null,
      people: unplaced,
    });
  // Archived: only the groups someone archived was in.
  const shown = archived
    ? groups.filter((group) => group.people.length)
    : groups;
  return (
    <div className="admin-shell">
      {/* The tour explains the current list; Archived has its own intro. */}
      <AdminHeader title="People" tour={archived ? undefined : "people"} />
      {query.archived ? (
        <p role="status" className="success-message">
          {leftTeamWords.done}
        </p>
      ) : null}
      {query.deleted ? (
        <p role="status" className="success-message">
          {query.login === "deleted"
            ? "Permanently deleted, together with their login account."
            : "Permanently deleted."}
        </p>
      ) : null}
      {query.login === "kept" ? (
        <p role="alert" className="form-error">
          The person was deleted, but their login account could not be removed.
          Ask the site owner to delete it in Supabase → Authentication → Users.
        </p>
      ) : null}
      <FileCleanup files={leftFiles(query.file)} />
      <ViewTabs href="/admin/people" view={view} label="People" />
      {archived ? (
        <p className="muted">{leftTeamWords.listIntro}</p>
      ) : (
        <>
          <p className="muted">
            Everyone on the team, by group. The Executive board is always on the
            About page; the others when “Show on public page” is ticked.{" "}
            {systemText.order.hint}
          </p>
          <div className="admin-actions">
            <Link
              className="button-primary"
              href="/admin/people/new"
              data-tour="people-add"
            >
              Add a person
            </Link>
            <Link
              className="button-secondary"
              href="/admin/people/groups"
              data-tour="people-groups"
            >
              Edit groups
            </Link>
          </div>
        </>
      )}
      {unavailable ? (
        <p role="alert" className="content-card">
          People could not be loaded. Check your connection and reload.
        </p>
      ) : (
        shown.map((group) => (
          <section
            className="admin-group"
            key={group.id}
            aria-labelledby={`group-${group.id}`}
          >
            <h2 id={`group-${group.id}`}>{group.name}</h2>
            {group.people.length &&
            !archived &&
            group.id !== "unplaced" &&
            group.kind !== "executive" ? (
              <OrderedList
                list="people"
                label={group.name}
                // Every group's list carries it; the tour uses the first.
                tour="people-order"
                rows={group.people.map((person) => ({
                  id: person.id,
                  version: person.updated_at,
                  name: person.full_name,
                  content: (
                    <PersonRow person={person} executiveId={executiveId} />
                  ),
                }))}
              />
            ) : group.people.length ? (
              <ul
                className={
                  group.kind === "executive" && !archived
                    ? "admin-list fixed-order"
                    : "admin-list"
                }
              >
                {group.people.map((person) =>
                  archived ? (
                    <ArchivedRow
                      key={person.id}
                      name={person.full_name}
                      heading="h3"
                      view={`/admin/people/${person.id}`}
                      fields={{ id: person.id, version: person.updated_at }}
                      restore={{ action: restorePersonAction }}
                      purge={{
                        action: purgePersonAction,
                        allowed: admin.canManagePeople,
                        note: "Their photo and their login account are deleted too.",
                      }}
                    >
                      {person.role_title ? (
                        <p className="muted">{person.role_title}</p>
                      ) : null}
                      <Badges person={person} executiveId={executiveId} />
                    </ArchivedRow>
                  ) : (
                    <li key={person.id}>
                      <PersonRow person={person} executiveId={executiveId} />
                    </li>
                  ),
                )}
              </ul>
            ) : (
              <p className="muted">Nobody in this group yet.</p>
            )}
          </section>
        ))
      )}
      {!unavailable && archived && !shown.length ? (
        <p className="content-card">Nobody is archived.</p>
      ) : null}
      {!unavailable && !archived && !groups.length ? (
        <p className="content-card">
          No groups yet.{" "}
          <Link className="text-link" href="/admin/people/groups">
            Add a group first
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}

export default boardPage(PeoplePage);
