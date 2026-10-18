import { passwordHint } from "@/lib/backend/password";
import { SetPasswordForm } from "@/features/admin/PasswordForms";
import { boardPage } from "@/features/admin/page-state/board-page";

/** Reached from an invite or reset email link, which signs the person in first. */
function SetPasswordPage() {
  return (
    <div className="admin-shell narrow">
      <p className="section-kicker">SGU MSA</p>
      <h1>Choose your password</h1>
      <p className="muted">
        Choose the password you will use to sign in to the board dashboard.
        Saving it signs you out on your other devices.
      </p>
      <SetPasswordForm hint={passwordHint} />
    </div>
  );
}

export default boardPage(SetPasswordPage);
