import { currentAdmin } from "@/lib/backend/server";
import { adminSeasonContext, readMoneyIn } from "@/lib/backend/admin-payments";
import { paymentsCsv } from "@/lib/community/payment-policy";
import { moneyFilters, seasonRanges } from "@/features/admin/payment-forms";
import { gatewayWords } from "@/features/admin/payment-words";

// The Payments CSV (PR6 WP-7, D-39, D-64): the same rows as the screen, with
// each giver's note and never a name, made per request and never stored
// (`no-store`). Only "manage money" holders; anyone else gets 403. A read
// that is partial or failed gives no file, so a missing order never looks
// like a complete list.

const text = (body: string, status: number) =>
  new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

export async function GET(request: Request) {
  const admin = await currentAdmin();
  if (!admin?.canManageMoney)
    return text(
      "Only board members who can manage money can download payments.",
      403,
    );
  const query = Object.fromEntries(new URL(request.url).searchParams);
  const context = await adminSeasonContext();
  const seasons = seasonRanges(
    context.seasons,
    context.today,
    context.adjustment,
  );
  const filters = moneyFilters(query, context.today, seasons);
  const money = await readMoneyIn(admin, filters);
  if (money.state === "forbidden")
    return text(
      "Only board members who can manage money can download payments.",
      403,
    );
  if (money.state === "unavailable")
    return text("Funds and tickets could not be loaded. Try again.", 503);
  if (money.state === "gateway") return text(gatewayWords[money.problem], 503);
  if (money.partial) return text(gatewayWords.partial, 503);
  return new Response(paymentsCsv(money.report.rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payments-${filters.from}-to-${filters.until}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
