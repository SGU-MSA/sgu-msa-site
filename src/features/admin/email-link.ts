import { z } from "@/lib/validation/zod";

/**
 * What a valid invite or reset email link carries (PR3 contract D-25). The
 * Continue page checks it before showing the button, and
 * `confirmEmailLinkAction` checks it again before using the one-time token, so
 * both share this one definition. Checking the shape uses nothing up.
 */
export const emailLinkSchema = z.object({
  token_hash: z.string().min(1).max(1024),
  type: z.enum(["invite", "recovery"]),
});

export type EmailLink = z.infer<typeof emailLinkSchema>;
