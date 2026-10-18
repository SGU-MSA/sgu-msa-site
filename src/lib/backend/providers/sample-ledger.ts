import "server-only";
import { sandboxStore } from "../../demo/store";
import type { EmailStep, SentSteps } from "../../community/attention";
import type { WarningLedger } from "./contract";

/** The sandbox's "already emailed" list (the `warning_emails_sent` table). */
export function createSampleWarningLedger(seed: Date): WarningLedger {
  const instant = new Date(seed);
  return {
    async alreadySent(keys) {
      const rows = sandboxStore(instant).warningLedger;
      const sent = new Map<string, Partial<Record<EmailStep, string>>>();
      for (const key of keys) {
        const steps = rows.get(key);
        if (steps) sent.set(key, { ...steps });
      }
      return { sent: sent as SentSteps };
    },
    async record(rows, on) {
      const ledger = sandboxStore(instant).warningLedger;
      for (const { key, step } of rows) {
        const steps = ledger.get(key) ?? {};
        // `on conflict do nothing`: a recorded step keeps its first date.
        steps[step] ??= on;
        ledger.set(key, steps);
      }
      return { ok: true };
    },
  };
}
