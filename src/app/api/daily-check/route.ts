import { readAttention } from "@/lib/backend/attention-reads";
import { runDailyCheck, cronAuthorized } from "@/lib/backend/daily-check";
import { localDate } from "@/lib/community/schema";
import { cronSecret, runtimeConfig } from "@/lib/runtime/config";
import { clock, warningLedger, warningMailer } from "@/lib/runtime/providers";

// The nightly check (daily-check contract, ADR 0022): Vercel Cron calls this
// once a day with `Authorization: Bearer CRON_SECRET`. It only composes; the
// rules live in src/lib/community/attention.ts.
export const maxDuration = 60;

export async function GET(request: Request) {
  const config = runtimeConfig();
  // The secret only from the header, never a query string; "off" refuses all.
  if (
    config.dailyCheck === "off" ||
    !cronAuthorized(request.headers.get("authorization"), cronSecret(config))
  )
    return new Response("Unauthorized", {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  const { status, body } = await runDailyCheck({
    read: readAttention,
    ledger: warningLedger(),
    mailer: warningMailer(),
    today: localDate(clock().now()),
    siteUrl: config.siteUrl,
  });
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
