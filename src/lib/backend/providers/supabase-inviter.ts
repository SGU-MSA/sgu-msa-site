import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { AccountInviter } from "./contract";

/**
 * Invite emails and account deletion through Supabase Auth's admin API: one
 * of the two holders of the secret key (ADR 0007, least privilege; the other
 * is the daily check's `supabase-ledger.ts`, ADR 0022) and its only Auth uses
 * (`inviteUserByEmail`, `updateUserById` for "Change email" (review fixes
 * P4), and `deleteUser` after a permanent delete, D-21). The
 * key comes from the composition point, which reads it with
 * `supabaseSecretKey`; it is never logged, returned or sent to the browser.
 * No other client is created here, and the key never touches data tables
 * (those stay under RLS with the person's own session).
 */
export function createSupabaseAccountInviter(settings: {
  url: string;
  secretKey: string;
}): AccountInviter {
  const admin = createClient(settings.url, settings.secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return {
    async invite(email, redirectTo, details) {
      try {
        const { error } = await admin.auth.admin.inviteUserByEmail(email, {
          redirectTo,
          // Read by the invite email template (D-1).
          data: { full_name: details.fullName, invited_by: details.invitedBy },
        });
        if (!error) return { ok: true, delivery: "email" };
        if (
          error.code === "email_exists" ||
          error.code === "user_already_exists"
        )
          return { ok: false, reason: "already-registered" };
        // Email not connected, switched off, or over the sending limits.
        if (
          error.code === "over_email_send_rate_limit" ||
          error.code === "email_provider_disabled" ||
          /sending/i.test(error.message)
        )
          return { ok: false, reason: "email-unavailable" };
        return { ok: false, reason: "unavailable" };
      } catch {
        return { ok: false, reason: "unavailable" };
      }
    },
    async changeEmail(userId, email) {
      try {
        // Set by a board member who can manage people: the new address is
        // taken as confirmed, so no confirmation email is sent to either.
        const { error } = await admin.auth.admin.updateUserById(userId, {
          email,
          email_confirm: true,
        });
        if (!error) return { ok: true };
        return error.code === "email_exists" ||
          error.code === "user_already_exists"
          ? { ok: false, reason: "taken" }
          : { ok: false, reason: "unavailable" };
      } catch {
        return { ok: false, reason: "unavailable" };
      }
    },
    async deleteAccount(userId) {
      try {
        const { error } = await admin.auth.admin.deleteUser(userId);
        // Already gone (an earlier attempt, or the owner deleted it) is the goal.
        return !error || error.code === "user_not_found"
          ? { ok: true }
          : { ok: false, reason: "unavailable" };
      } catch {
        return { ok: false, reason: "unavailable" };
      }
    },
  };
}
