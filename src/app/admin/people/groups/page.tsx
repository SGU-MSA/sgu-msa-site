import {
  listAdminPeople,
  listAdminSections,
} from "@/lib/backend/admin-content";
import type { VersionedSection } from "@/lib/backend/providers/contract";
import { requireAdmin } from "@/lib/backend/server";
import { AdminHeader } from "@/features/admin/AdminHeader";
import { GroupsEditor } from "@/features/admin/GroupsEditor";
import { boardPage } from "@/features/admin/page-state/board-page";
import { AppearsOn } from "@/features/admin/AppearsOn";

async function GroupsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const admin = await requireAdmin();
  const query = await searchParams;
  const [current, archived, people, archivedPeople] = await Promise.all([
    listAdminSections(),
    listAdminSections("archived"),
    listAdminPeople(),
    listAdminPeople("archived"),
  ]);
  const unavailable =
    current.unavailable ||
    archived.unavailable ||
    people.unavailable ||
    archivedPeople.unavailable;
  const editable = (section: VersionedSection) => ({
    id: section.id,
    name: section.name,
    shownByDefault: section.shown_by_default,
    kind: section.kind,
    version: section.updated_at,
  });
  // Archived people stay in their group, so it is not empty yet.
  const everyone = [...people.people, ...archivedPeople.people];
  return (
    <div className="admin-shell narrow">
      <AdminHeader
        title="Team groups"
        parents={[{ label: "People", href: "/admin/people" }]}
      />
      <AppearsOn area="groups" />
      {query.archived ? (
        <p role="status" className="success-message">
          Group archived.
        </p>
      ) : null}
      {query.restored ? (
        <p role="status" className="success-message">
          Group restored.
        </p>
      ) : null}
      {query.deleted ? (
        <p role="status" className="success-message">
          Group permanently deleted.
        </p>
      ) : null}
      <p className="muted">
        Groups sort People and head the public team list, in this order.
      </p>
      {unavailable ? (
        <p role="alert" className="content-card">
          Groups could not be loaded. Check your connection and reload.
        </p>
      ) : (
        <GroupsEditor
          groups={current.sections.map(editable)}
          archived={archived.sections.map((section) => ({
            ...editable(section),
            people: everyone.filter(
              (person) => person.section_id === section.id,
            ).length,
          }))}
          newId={crypto.randomUUID()}
          canDelete={admin.canManagePeople}
        />
      )}
    </div>
  );
}

export default boardPage(GroupsPage);
