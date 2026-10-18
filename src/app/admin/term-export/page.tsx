import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/backend/server";
import { systemText } from "@/lib/system-text";
import { AdminHeader } from "@/features/admin/AdminHeader";
import { boardPage } from "@/features/admin/page-state/board-page";
import { TermExportForm } from "@/features/admin/term-export/TermExportForm";
import { termExportSchema } from "@/features/admin/term-export/term-form";

const words = systemText.termExport;

const one = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : "";

/**
 * Term export (review fixes P5): a term's records, photos and PDFs as one
 * zip, then "Free up space". "Manage people" holders only: anyone else is
 * sent to the dashboard, which has no card for them; the download route
 * and the actions check again, and the database decides "Free up space".
 */
async function TermExportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdmin();
  if (!admin.canManagePeople) redirect("/admin/dashboard");
  const query = await searchParams;
  const start = {
    name: one(query.name),
    from: one(query.from),
    until: one(query.until),
  };
  // A Download that came back: say why, with the boxes as they were.
  const problem =
    query.problem === "unavailable"
      ? words.unavailable
      : query.problem === "invalid"
        ? (termExportSchema.safeParse(start).error?.issues[0]?.message ??
          words.fillFirst)
        : null;
  return (
    <div className="admin-shell">
      <AdminHeader title={words.title} />
      <p className="muted">{words.intro}</p>
      <TermExportForm start={start} problem={problem} />
    </div>
  );
}

export default boardPage(TermExportPage);
