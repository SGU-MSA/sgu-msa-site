import { notFound } from "next/navigation";
import { z } from "@/lib/validation/zod";
import { localDate } from "@/lib/community/schema";
import { clock } from "@/lib/runtime/providers";
import { listAdminLogins, listAdminPeople } from "@/lib/backend/admin-content";
import { AdminHeader } from "@/features/admin/AdminHeader";
import {
  LoginEditor,
  type HolderChoice,
} from "@/features/admin/handover/LoginEditor";
import { ArchivedEntry } from "@/features/admin/ArchivedEntry";
import { restoreSharedLoginAction } from "@/features/admin/handover/handover-actions";
import { boardPage } from "@/features/admin/page-state/board-page";

const parents = [{ label: "New board term", href: "/admin/handover" }];

/** Add or edit who holds one shared login (PR5a D-5): names from People only. */
async function SharedLoginPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const isNew = id === "new";
  if (!isNew && !z.uuid().safeParse(id).success) notFound();
  const [current, archived, people, archivedPeople] = await Promise.all([
    listAdminLogins(),
    listAdminLogins("archived"),
    listAdminPeople(),
    listAdminPeople("archived"),
  ]);
  if (
    current.unavailable ||
    archived.unavailable ||
    people.unavailable ||
    archivedPeople.unavailable
  )
    return (
      <div className="admin-shell narrow">
        <AdminHeader title="Shared login" parents={parents} />
        <p role="alert" className="content-card">
          This page could not be loaded. Check your connection and reload.
        </p>
      </div>
    );
  const login = isNew
    ? null
    : (current.logins.find((row) => row.id === id) ?? null);
  const gone = isNew
    ? null
    : (archived.logins.find((row) => row.id === id) ?? null);
  if (!isNew && !login && !gone) notFound();

  if (gone)
    return (
      <div className="admin-shell narrow">
        <AdminHeader
          title={`Archived · ${gone.service}`}
          parents={parents}
          current={gone.service}
        />
        <ArchivedEntry
          heading={gone.service}
          intro="This account is not on the list of shared logins and cannot be edited. Restore it to edit it again."
          target={{ id: gone.id, version: gone.updated_at }}
          restore={{ action: restoreSharedLoginAction }}
        />
      </div>
    );

  // Current People in order; a holder archived since stays choosable.
  const held = new Set([
    login?.holder_person_id,
    login?.second_factor_person_id,
  ]);
  const choices: HolderChoice[] = [
    ...people.people.map((person) => ({
      id: person.id,
      name: person.full_name,
    })),
    ...archivedPeople.people
      .filter((person) => held.has(person.id))
      .map((person) => ({
        id: person.id,
        name: `${person.full_name} (archived)`,
      })),
  ];
  return (
    <div className="admin-shell narrow">
      <AdminHeader
        title={login ? `Edit · ${login.service}` : "Add an account"}
        parents={parents}
        current={login?.service ?? "Add an account"}
      />
      <p className="muted">
        Who holds the password of a shared account, and who has the phone for
        its 2-step code. Names only. Never passwords or codes.
      </p>
      <LoginEditor
        login={{
          id: login?.id ?? crypto.randomUUID(),
          service: login?.service ?? "",
          holder_person_id: login?.holder_person_id ?? "",
          second_factor_person_id: login?.second_factor_person_id ?? "",
          last_changed_on: login?.last_changed_on ?? "",
          note: login?.note ?? "",
          version: login?.updated_at ?? null,
        }}
        people={choices}
        today={localDate(clock().now())}
      />
    </div>
  );
}

export default boardPage(SharedLoginPage);
