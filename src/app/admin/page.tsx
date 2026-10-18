import { redirect } from "next/navigation";
import { SignInForm } from "@/features/admin/SignInForm";
import { expiredLink } from "@/features/admin/fields";
import { currentAdmin } from "@/lib/backend/server";
import { deploymentProfile } from "@/lib/runtime/providers";
import { boardPage } from "@/features/admin/page-state/board-page";
async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (await currentAdmin()) redirect("/admin/dashboard");
  const { link } = await searchParams;
  return (
    <div className="admin-shell narrow">
      <p className="section-kicker">SGU MSA</p>
      <h1>Board sign in</h1>
      <p className="muted">
        For invited board members. Need access? Ask a board member who can
        manage people.
      </p>
      {link === "expired" ? (
        <p role="alert" className="form-error">
          {expiredLink}
        </p>
      ) : null}
      <SignInForm sandbox={deploymentProfile().adminPortal === "sample"} />
    </div>
  );
}

export default boardPage(AdminPage);
