import "server-only";
import { sandboxStore } from "../../demo/store";
import type { WarningMailer } from "./contract";

/**
 * The sandbox's warning mailer: records each email in the sandbox store
 * (`sentWarnings`) instead of sending it. Never connects to Gmail.
 */
export function createSampleWarningMailer(seed: Date): WarningMailer {
  const instant = new Date(seed);
  return {
    async send(email) {
      sandboxStore(instant).sentWarnings.push({ ...email });
      return { ok: true, delivery: "sandbox" };
    },
  };
}
