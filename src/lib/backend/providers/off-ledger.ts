import type { WarningLedger } from "./contract";

/**
 * No "already emailed" list: `SUPABASE_SECRET_KEY=off` on a developer's
 * computer, where warning emails are off too. Remembers nothing.
 */
export const offWarningLedger: WarningLedger = {
  async alreadySent() {
    return { sent: new Map() };
  },
  async record() {
    return { ok: false };
  },
};
