import type { WarningMailer } from "./contract";

/**
 * Warning emails switched off: every deployment but Vercel Production, even
 * with real Gmail values on a developer's computer (daily-check contract
 * WP-1), and Vercel Production while both Gmail variables are "off" (D-17).
 * Nothing is sent and nothing connects.
 */
export const offWarningMailer: WarningMailer = {
  async send() {
    return { ok: false, reason: "off" };
  },
};
