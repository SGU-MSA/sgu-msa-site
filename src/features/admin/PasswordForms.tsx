"use client";
import { useActionState, useId } from "react";
import {
  confirmEmailLinkAction,
  requestPasswordResetAction,
  setPasswordAction,
} from "@/features/admin/access-actions";
import { PasswordInput } from "@/shared/ui/PasswordInput";
import type { EmailLink } from "./email-link";
import { initialEditorState } from "./fields";
import { FormMessages } from "./FormMessages";

/** Asks for a reset link; the answer never says whether the email has an account. */
export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(
    requestPasswordResetAction,
    initialEditorState,
  );
  return (
    <form action={action} className="editor-form">
      <label>
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
        />
      </label>
      <FormMessages error={state.error} notice={state.notice} />
      <button className="button-primary" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}

/**
 * Chooses a new password after an invite or reset link. `hint` is the D-16
 * rule; the server and Supabase Auth check it again.
 */
export function SetPasswordForm({ hint }: { hint: string }) {
  const [state, action, pending] = useActionState(
    setPasswordAction,
    initialEditorState,
  );
  // The eye button sits inside each label, so name each field by its text alone.
  const newLabel = useId();
  const confirmLabel = useId();
  return (
    <form action={action} className="editor-form">
      <label>
        <span id={newLabel}>New password</span>
        <PasswordInput
          name="password"
          aria-labelledby={newLabel}
          autoComplete="new-password"
          required
          minLength={12}
          aria-describedby="password-hint"
        />
      </label>
      <p id="password-hint" className="muted">
        {hint}
      </p>
      <label>
        <span id={confirmLabel}>Type the new password again</span>
        <PasswordInput
          name="confirm"
          aria-labelledby={confirmLabel}
          autoComplete="new-password"
          required
          minLength={12}
        />
      </label>
      <FormMessages error={state.error} notice={state.notice} />
      <button className="button-primary" disabled={pending}>
        {pending ? "Saving…" : "Save password"}
      </button>
    </form>
  );
}

/**
 * The **Continue** button behind an invite or reset email link (D-25): the
 * one-time link is used only when the person clicks it, never when a mail
 * scanner opens the page.
 */
export function EmailLinkForm({
  tokenHash,
  type,
}: {
  tokenHash: string;
  type: EmailLink["type"];
}) {
  const [, action, pending] = useActionState(
    confirmEmailLinkAction,
    initialEditorState,
  );
  return (
    <form action={action} className="editor-form">
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="type" value={type} />
      <button className="button-primary" disabled={pending}>
        {pending ? "Opening…" : "Continue"}
      </button>
    </form>
  );
}
