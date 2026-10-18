import Link from "next/link";
import { ForgotPasswordForm } from "@/features/admin/PasswordForms";
import { boardPage } from "@/features/admin/page-state/board-page";

function ForgotPasswordPage() {
  return (
    <div className="admin-shell narrow">
      <p className="section-kicker">SGU MSA</p>
      <h1>Forgot your password?</h1>
      <p className="muted">
        Type the email you sign in with. If it belongs to a board account, we
        email you a link to choose a new password. The link works once and
        expires in 24 hours. Choosing a new password signs you out on your other
        devices.
      </p>
      <ForgotPasswordForm />
      <p>
        <Link className="text-link" href="/admin">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

export default boardPage(ForgotPasswordPage);
