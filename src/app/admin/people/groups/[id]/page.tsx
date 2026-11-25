import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "@/lib/validation/zod";
import { listAdminSections } from "@/lib/backend/admin-content";
import { AdminHeader } from "@/features/admin/AdminHeader";
import { AppearsOn } from "@/features/admin/AppearsOn";
import { ArchiveGroup, GroupForm } from "@/features/admin/GroupsEditor";
import { boardPage } from "@/features/admin/page-state/board-page";

/** One team group on its own page (or a new one: "new"). */
async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === "new";
  if (!isNew && !z.uuid().safeParse(id).success) notFound();
  const current = await listAdminSections();
  const found = isNew ? null : current.sections.find((s) => s.id === id);
  if (!isNew && !current.unavailable && !found) notFound();
  const group = found
    ? {
        id: found.id,
        name: found.name,
        shownByDefault: found.shown_by_default,
        kind: found.kind,
        version: found.updated_at,
        people: 0,
      }
    : null;
  return (
    <div className="admin-shell narrow">
      <AdminHeader
        title={group ? "Edit group" : "Add a group"}
        parents={[
          { label: "People", href: "/admin/people" },
          { label: "Team groups", href: "/admin/people/groups" },
        ]}
      />
      <AppearsOn area="groups" />
      <Link href="/admin/people/groups" className="text-link">
        ← Back to the groups
      </Link>
      {current.unavailable ? (
        <p role="alert" className="content-card">
          Groups could not be loaded. Check your connection and reload.
        </p>
      ) : (
        <section className="content-card">
          <GroupForm
            key={group?.version ?? "new"}
            group={group ?? { id: crypto.randomUUID(), version: null }}
            submitLabel={group ? "Save group" : "Add group"}
          />
          {group && !group.kind ? <ArchiveGroup group={group} /> : null}
        </section>
      )}
    </div>
  );
}

export default boardPage(GroupPage);
