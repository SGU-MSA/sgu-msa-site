import { redirect } from "next/navigation";
import { EmailLinkForm } from "@/features/admin/PasswordForms";
import { emailLinkSchema } from "@/features/admin/email-link";
import { boardPage } from "@/features/admin/page-state/board-page";

/**
 * Where invite and reset emails lead (PR3 contract, Design → Invite; D-25).
 * Opening this page does not use the one-time link: mail scanners (such as
 * Outlook's) open links before the person does. The link is used only when
 * the person clicks **Continue** (`confirmEmailLinkAction`).
 */
async function EmailLinkPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token_hash, type } = await searchParams;
  // A broken link goes straight to sign-in, as the action would after Continue.
  const link = emailLinkSchema.safeParse({ token_hash, type });
  if (!link.success) redirect("/admin?link=expired");
  return (
    <div className="admin-shell narrow">
      <p className="section-kicker">SGU MSA</p>
      <h1>Continue to choose your password</h1>
      <p className="muted">
        Click Continue to choose your password for the board dashboard. The link
        from your email works once and expires 24 hours after it was sent.
      </p>
      <EmailLinkForm tokenHash={link.data.token_hash} type={link.data.type} />
    </div>
  );
}

export default boardPage(EmailLinkPage);
