import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "@/lib/validation/zod";
import { requireAdmin } from "@/lib/backend/server";
import {
  listAdminPeople,
  listAdminSections,
  readAdminPerson,
} from "@/lib/backend/admin-content";
import {
  accessLocks,
  listedPublicly,
  roleHolders,
  shownPhoto,
  roleTitleSuggestions,
  type Access,
} from "@/lib/community/people";
import { AccessPanel } from "@/features/admin/AccessPanel";
import { AdminHeader } from "@/features/admin/AdminHeader";
import { ArchivedEntry } from "@/features/admin/ArchivedEntry";
import { PersonEditor } from "@/features/admin/PersonEditor";
import {
  ArchivePerson,
  RemovePhoto,
} from "@/features/admin/PersonRecordActions";
import { FileCleanup } from "@/features/admin/RecordActions";
import {
  purgePersonAction,
  restorePersonAction,
} from "@/features/admin/people-actions";
import {
  accessStateLabels,
  leftFiles,
  leftTeamWords,
  removeLoginWords,
} from "@/features/admin/fields";
import { boardPage } from "@/features/admin/page-state/board-page";
import { AppearsOn } from "@/features/admin/AppearsOn";

/** Whether a login holds "manage people" or "manage money". */
const holdsPermissions = (access: Access | undefined) =>
  access !== undefined &&
  access.state !== "none" &&
  (access.canManagePeople || access.canManageMoney);

async function PersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdmin();
  const { id } = await params;
  const query = await searchParams;
  const isNew = id === "new";
  if (!isNew && !z.uuid().safeParse(id).success) notFound();
  const [person, { sections, unavailable }, archivedSections, everyone] =
    await Promise.all([
      isNew ? null : readAdminPerson(id),
      listAdminSections(),
      isNew ? null : listAdminSections("archived"),
      listAdminPeople(),
    ]);
  if (!isNew && !person) notFound();
  const target = person ? { id: person.id, version: person.updated_at } : null;
  // Only Executive board members hold the two permissions (2026-10-06).
  const executiveId =
    sections.find((section) => section.kind === "executive")?.id ?? null;
  const locks = person
    ? accessLocks(
        person,
        everyone.people,
        admin.userId,
        person.section_id === executiveId,
      )
    : null;
  const notices = (
    <>
      {query.restored ? (
        <p role="status" className="success-message">
          {person?.access.state === "none"
            ? "Restored."
            : "Restored. Their login stays off until someone who can manage people reactivates it below."}
        </p>
      ) : null}
      {query.login === "removed" ? (
        <p role="status" className="success-message">
          {removeLoginWords.done}
        </p>
      ) : null}
      {query.photo === "removed" ? (
        <p role="status" className="success-message">
          Photo removed.
        </p>
      ) : null}
      <FileCleanup files={leftFiles(query.file)} />
    </>
  );
  const access =
    person && everyone ? (
      <AccessPanel
        personId={person.id}
        personName={person.full_name}
        access={person.access}
        canManage={admin.canManagePeople}
        locks={locks!}
        archived={Boolean(person.archived_at)}
      />
    ) : null;
  // Someone outside the Executive board keeps their photo hidden (user,
  // 2026-10-07): nothing about it shows until they are back in it.
  const hasPhoto = person ? Boolean(shownPhoto(person, executiveId)) : false;
  const photo = hasPhoto && target ? <RemovePhoto target={target} /> : null;

  if (person?.archived_at && target) {
    const groupName =
      [...sections, ...(archivedSections?.sections ?? [])].find(
        (section) => section.id === person.section_id,
      )?.name ?? "";
    return (
      <div className="admin-shell narrow">
        <AdminHeader
          title={`Archived · ${person.full_name}`}
          parents={[
            { label: "People", href: "/admin/people" },
            { label: "Archived", href: "/admin/people?view=archived" },
          ]}
          current={person.full_name}
        />
        {notices}
        <ArchivedEntry
          heading={person.full_name}
          intro={leftTeamWords.archivedIntro}
          details={[
            ["Role title", person.role_title],
            ["Group", groupName],
            [
              "Was on the public page",
              listedPublicly({ ...person, archived_at: null }, executiveId)
                ? "Yes"
                : "No",
            ],
            ["Photo", hasPhoto ? "Yes" : "No"],
            ["Login", accessStateLabels[person.access.state]],
          ]}
          target={target}
          restore={{ action: restorePersonAction }}
          purge={{
            action: purgePersonAction,
            allowed: admin.canManagePeople,
            note: "Their photo and their login account are deleted too.",
          }}
        >
          {photo}
        </ArchivedEntry>
        {access}
      </div>
    );
  }

  return (
    <div className="admin-shell narrow">
      <AdminHeader
        title={person ? `Edit · ${person.full_name}` : "Add a person"}
        parents={[{ label: "People", href: "/admin/people" }]}
        current={person?.full_name ?? "Add a person"}
      />
      <AppearsOn area="people" />
      {notices}
      {unavailable ? (
        <p role="alert" className="content-card">
          Groups could not be loaded. Check your connection and reload.
        </p>
      ) : !sections.length ? (
        <p className="content-card">
          Add a group before adding people.{" "}
          <Link className="text-link" href="/admin/people/groups">
            Edit groups
          </Link>
        </p>
      ) : (
        <PersonEditor
          id={person?.id ?? crypto.randomUUID()}
          person={person}
          version={person?.updated_at ?? null}
          groups={sections.map(({ id, name, shown_by_default, kind }) => ({
            id,
            name,
            shownByDefault: shown_by_default,
            kind,
          }))}
          roleTitles={roleTitleSuggestions(everyone.people)}
          roleHolders={roleHolders(everyone.people, executiveId, admin.userId)}
          canManagePeople={admin.canManagePeople}
          holdsPermissions={holdsPermissions(person?.access)}
          moveOutRefusal={
            locks?.managePeople === "self" ||
            locks?.managePeople === "last_manager"
              ? locks.managePeople
              : null
          }
        />
      )}
      {photo}
      {access}
      {person && target && everyone ? (
        <ArchivePerson
          target={target}
          // D-12: archiving turns an active login off, so the access guard's
          // refusals apply (a UX mirror; the database decides).
          lock={
            person.access.state === "invited" ||
            person.access.state === "active"
              ? admin.canManagePeople
                ? (locks?.deactivate ?? null)
                : "forbidden"
              : null
          }
        />
      ) : null}
    </div>
  );
}

export default boardPage(PersonPage);
