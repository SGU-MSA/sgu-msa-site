import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { EmailStep } from "../../community/attention";
import type { WarningLedger } from "./contract";

/**
 * What the daily check already emailed, in `warning_emails_sent` (daily-check
 * contract D-12, D-13). The secret key's one data-table use (ADR 0022): read
 * and add rows here, nothing else. The key comes from the composition point,
 * which reads it with `supabaseSecretKey`; it is never logged or returned.
 */
export function createSupabaseWarningLedger(settings: {
  url: string;
  secretKey: string;
}): WarningLedger {
  const server = createClient(settings.url, settings.secretKey, {
    db: { retry: false },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          cache: "no-store",
          signal: AbortSignal.timeout(10_000),
        }),
    },
  });
  const table = () => server.from("warning_emails_sent");
  return {
    async alreadySent(keys) {
      if (keys.length === 0) return { sent: new Map() };
      try {
        const { data, error } = await table()
          .select("warning_key, step, emailed_on")
          .in("warning_key", [...keys]);
        if (error) return { unavailable: true };
        const sent = new Map<string, Partial<Record<EmailStep, string>>>();
        for (const row of data ?? []) {
          const step = row.step as EmailStep;
          const steps = sent.get(row.warning_key) ?? {};
          steps[step] = String(row.emailed_on);
          sent.set(row.warning_key, steps);
        }
        return { sent };
      } catch {
        return { unavailable: true };
      }
    },
    async record(rows, on) {
      if (rows.length === 0) return { ok: true };
      try {
        const { error } = await table().upsert(
          rows.map(({ key, step }) => ({
            warning_key: key,
            step,
            emailed_on: on,
          })),
          { onConflict: "warning_key,step", ignoreDuplicates: true },
        );
        return { ok: !error };
      } catch {
        return { ok: false };
      }
    },
  };
}
