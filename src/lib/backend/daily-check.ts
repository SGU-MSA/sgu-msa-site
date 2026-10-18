import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import {
  attentionFacts,
  attentionItems,
  emailsDue,
  factsUnavailable,
  warningEmail,
  type AttentionReads,
} from "../community/attention";
import type { WarningLedger, WarningMailer } from "./providers/contract";

/**
 * True only for `Authorization: Bearer <secret>`, compared in constant time
 * (hashing first, so the length is not revealed either). Never logs either
 * value.
 */
export function cronAuthorized(header: string | null, secret: string) {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(header ?? ""), digest(`Bearer ${secret}`));
}

/** Counts only: no wording, keys, ids or addresses (daily-check contract). */
export type DailyCheckResult = {
  status: 200 | 500;
  body: {
    /** Problems that need attention today (the dashboard's list). */
    warnings: number;
    /** Problems listed in tonight's email (0 when nothing was sent). */
    emailed: number;
    failed?: "mail" | "ledger" | "facts";
  };
};

/**
 * One nightly run (daily-check contract, Design steps 1–6): read the facts,
 * apply the shared policy, check what was already emailed, send at most one
 * email, then record it. A step is recorded only after the email went out,
 * so a failed send is retried the next night and never lost.
 */
export async function runDailyCheck(run: {
  /** The prayer settings, seasons, funds and space (`readAttention`). */
  read: () => Promise<AttentionReads>;
  ledger: WarningLedger;
  mailer: WarningMailer;
  /** Today's Grenada date (YYYY-MM-DD). */
  today: string;
  siteUrl: string;
}): Promise<DailyCheckResult> {
  const facts = attentionFacts(await run.read(), run.today);
  // Any read that failed: no email tonight (a partial list could hide a
  // problem); the next night catches up (P-8 A).
  if (factsUnavailable(facts))
    return { status: 500, body: { warnings: 0, emailed: 0, failed: "facts" } };
  const items = attentionItems(facts, run.today);
  const warnings = items.length;
  if (warnings === 0) return { status: 200, body: { warnings, emailed: 0 } };

  const ledger = await run.ledger.alreadySent(items.map((item) => item.key));
  if ("unavailable" in ledger)
    return { status: 500, body: { warnings, emailed: 0, failed: "ledger" } };
  const due = emailsDue(items, ledger.sent, run.today);
  if (due.length === 0) return { status: 200, body: { warnings, emailed: 0 } };

  const sent = await run.mailer.send(warningEmail(due, run.siteUrl));
  if (!sent.ok)
    // "off": this deployment never sends (not Vercel Production).
    return sent.reason === "off"
      ? { status: 200, body: { warnings, emailed: 0 } }
      : { status: 500, body: { warnings, emailed: 0, failed: "mail" } };
  const recorded = await run.ledger.record(
    due.map(({ item, step }) => ({ key: item.key, step })),
    run.today,
  );
  const emailed = due.length;
  return recorded.ok
    ? { status: 200, body: { warnings, emailed } }
    : { status: 500, body: { warnings, emailed, failed: "ledger" } };
}
