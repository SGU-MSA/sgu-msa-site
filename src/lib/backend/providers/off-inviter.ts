import type { AccountInviter } from "./contract";

/**
 * Invite emails, email changes and account deletion switched off (`SUPABASE_SECRET_KEY=off`,
 * a developer's computer only; refused in production). Nothing is sent and
 * nothing changes.
 */
export const offAccountInviter: AccountInviter = {
  async invite() {
    return { ok: false, reason: "off" };
  },
  async deleteAccount() {
    return { ok: false, reason: "off" };
  },
  async changeEmail() {
    return { ok: false, reason: "off" };
  },
};
