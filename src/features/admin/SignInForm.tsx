"use client";

import Link from "next/link";
import { useActionState, useId } from "react";

import { signInAction, type SignInState } from "@/features/admin/actions";
import { FormMessages } from "@/features/admin/FormMessages";
import { PasswordInput } from "@/shared/ui/PasswordInput";

const initial: SignInState = { error: null };

/** `sandbox`: the local sandbox signs in with a username (cleanup-outdated D-10). */
export function SignInForm({ sandbox }: { sandbox: boolean }) {
  const [state, formAction, pending] = useActionState(signInAction, initial);
  // The eye button sits inside the label, so name the field by its text alone.
  const passwordLabel = useId();

  return (
    <form action={formAction} className="editor-form">
      <label>
        {sandbox ? "Username" : "Email"}
        <input
          name="email"
          type={sandbox ? "text" : "email"}
          autoComplete="username"
          required
          placeholder={sandbox ? "admin" : "you@sgu.edu"}
        />
      </label>

      <label>
        <span id={passwordLabel}>Password</span>
        <PasswordInput
          name="password"
          aria-labelledby={passwordLabel}
          autoComplete="current-password"
          required
        />
      </label>

      <FormMessages error={state.error} notice={null} />

      <button className="button-primary" disabled={pending}>
        {pending ? "Signing in…" : "Sign In"}
      </button>

      <p>
        <Link className="text-link" href="/admin/forgot-password">
          Forgot your password?
        </Link>
      </p>
    </form>
  );
}
