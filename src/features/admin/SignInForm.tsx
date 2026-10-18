"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signInAction, type SignInState } from "@/features/admin/actions";

const initial: SignInState = { error: null };
const primaryButton =
  "inline-flex min-h-12 w-full items-center justify-center border border-[var(--msa-gold)] bg-[var(--msa-gold)] px-5 text-[0.72rem] font-semibold uppercase tracking-[0.09em] text-[var(--design-on-accent)] transition-colors hover:bg-[var(--msa-gold-light)] disabled:opacity-60";

function SignInError({ error }: { error: string | null }) {
  return error ? (
    <p
      role="alert"
      className="border border-red-500/40 bg-red-500/10 px-4 py-3 text-[0.8rem] leading-6 text-red-200"
    >
      {error}
    </p>
  ) : null;
}

/** `sandbox`: the local sandbox signs in with a username (cleanup-outdated D-10). */
export function SignInForm({ sandbox }: { sandbox: boolean }) {
  const [state, formAction, pending] = useActionState(signInAction, initial);

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <label className="block">
        <span className="text-[0.68rem] uppercase tracking-[0.14em] text-[var(--text-secondary)]">
          {sandbox ? "Username" : "Email"}
        </span>
        <input
          name="email"
          type={sandbox ? "text" : "email"}
          autoComplete="username"
          required
          className="mt-2 min-h-12 w-full border border-[var(--border-subtle)] bg-white/[.02] px-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--msa-gold)] focus:outline-none"
          placeholder={sandbox ? "admin" : "you@sgu.edu"}
        />
      </label>

      <label className="block">
        <span className="text-[0.68rem] uppercase tracking-[0.14em] text-[var(--text-secondary)]">
          Password
        </span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-2 min-h-12 w-full border border-[var(--border-subtle)] bg-white/[.02] px-4 text-sm text-[var(--text-primary)] focus:border-[var(--msa-gold)] focus:outline-none"
        />
      </label>

      <SignInError error={state.error} />

      <button type="submit" disabled={pending} className={primaryButton}>
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
