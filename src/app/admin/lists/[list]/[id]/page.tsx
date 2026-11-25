import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "@/lib/validation/zod";
import {
  listInfo,
  listNames,
  listWords,
  type ListName,
} from "@/lib/community/lists";
import { AdminHeader } from "@/features/admin/AdminHeader";
import { AppearsOn } from "@/features/admin/AppearsOn";
import { NameForm } from "@/features/admin/ListsEditor";
import { deleteListOptionAction } from "@/features/admin/list-actions";
import { loadLists } from "@/features/admin/lists-data";
import { boardPage } from "@/features/admin/page-state/board-page";
import { ActionForm } from "@/features/admin/RecordActions";

/** One option of a list on its own page (or a new one: "new"). */
async function ListOptionPage({
  params,
}: {
  params: Promise<{ list: string; id: string }>;
}) {
  const { list: listParam, id } = await params;
  const parsed = z.enum(listNames).safeParse(listParam);
  if (!parsed.success) notFound();
  const list: ListName = parsed.data;
  const isNew = id === "new";
  if (!isNew && !z.uuid().safeParse(id).success) notFound();
  const { lists, unavailable } = await loadLists();
  const row = isNew ? null : lists[list].find((option) => option.id === id);
  if (!isNew && !unavailable && !row) notFound();
  const info = listInfo[list];
  return (
    <div className="admin-shell narrow">
      <AdminHeader
        title={row ? `Edit ${info.item}` : `Add a ${info.item}`}
        parents={[{ label: "Lists", href: "/admin/lists" }]}
      />
      <AppearsOn area="lists" />
      <Link href={`/admin/lists#list-${list}`} className="text-link">
        ← Back to {info.title.toLowerCase()}
      </Link>
      {unavailable ? (
        <p role="alert" className="content-card">
          {listWords.unavailable}
        </p>
      ) : (
        <section className="content-card">
          <h2>{info.title}</h2>
          <NameForm
            key={row?.version ?? "new"}
            list={list}
            id={row?.id ?? crypto.randomUUID()}
            version={row?.version ?? null}
            name={row?.name ?? ""}
            submitLabel={row ? "Save name" : "Add"}
          />
          {row ? (
            row.usedBy ? (
              <p className="muted">{row.usedBy}</p>
            ) : (
              <ActionForm
                action={deleteListOptionAction}
                fields={{ id: row.id, version: row.version, list }}
                label={listWords.delete}
                pendingLabel={listWords.deleting}
                itemName={row.name}
              />
            )
          ) : null}
        </section>
      )}
    </div>
  );
}

export default boardPage(ListOptionPage);
