import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "@/lib/validation/zod";
import { listAdminSteps } from "@/lib/backend/admin-content";
import { AdminHeader } from "@/features/admin/AdminHeader";
import { ArchiveStep, StepForm } from "@/features/admin/handover/StepsEditor";
import { checklistStep } from "@/features/admin/handover/pages";
import { boardPage } from "@/features/admin/page-state/board-page";

/** One hand-over step on its own page (or a new one: "new"). */
async function StepPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === "new";
  if (!isNew && !z.uuid().safeParse(id).success) notFound();
  const current = await listAdminSteps();
  const found = isNew ? null : current.steps.find((step) => step.id === id);
  if (!isNew && !current.unavailable && !found) notFound();
  const step = found ? checklistStep(found) : null;
  return (
    <div className="admin-shell narrow">
      <AdminHeader
        title={step ? "Edit step" : "Add a step"}
        parents={[
          { label: "New board term", href: "/admin/handover" },
          { label: "Edit the steps", href: "/admin/handover/steps" },
        ]}
      />
      <Link href="/admin/handover/steps" className="text-link">
        ← Back to the steps
      </Link>
      {current.unavailable ? (
        <p role="alert" className="content-card">
          The steps could not be loaded. Check your connection and reload.
        </p>
      ) : (
        <section className="content-card">
          <StepForm
            key={step?.version ?? "new"}
            step={step ?? { id: crypto.randomUUID(), version: null }}
            submitLabel={step ? "Save step" : "Add step"}
          />
          {step ? <ArchiveStep step={step} /> : null}
        </section>
      )}
    </div>
  );
}

export default boardPage(StepPage);
