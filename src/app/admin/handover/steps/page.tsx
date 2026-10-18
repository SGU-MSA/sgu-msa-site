import { listAdminSteps } from "@/lib/backend/admin-content";
import { AdminHeader } from "@/features/admin/AdminHeader";
import { StepsEditor } from "@/features/admin/handover/StepsEditor";
import { checklistStep } from "@/features/admin/handover/pages";
import { boardPage } from "@/features/admin/page-state/board-page";

const notices: Record<string, string> = {
  archived: "Step archived. Find it under Archived steps.",
  restored: "Step restored.",
};

/** "Edit the steps" of the New board term (PR5a D-5): any board member. */
async function HandoverStepsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const [current, archived] = await Promise.all([
    listAdminSteps(),
    listAdminSteps("archived"),
  ]);
  const notice = Object.keys(notices).find((key) => query[key]);
  return (
    <div className="admin-shell narrow">
      <AdminHeader
        title="Edit the steps"
        parents={[{ label: "New board term", href: "/admin/handover" }]}
      />
      {notice ? (
        <p role="status" className="success-message">
          {notices[notice]}
        </p>
      ) : null}
      <p className="muted">
        The checklist each new board works through. Reword a step, drag it into
        place, or archive one that no longer applies. Every change is in Recent
        changes.
      </p>
      {current.unavailable || archived.unavailable ? (
        <p role="alert" className="content-card">
          The steps could not be loaded. Check your connection and reload.
        </p>
      ) : (
        <StepsEditor
          steps={current.steps.map(checklistStep)}
          archived={archived.steps.map(checklistStep)}
          newId={crypto.randomUUID()}
        />
      )}
    </div>
  );
}

export default boardPage(HandoverStepsPage);
