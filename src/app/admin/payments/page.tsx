import Link from "next/link";
import { requireAdmin } from "@/lib/backend/server";
import {
  adminSeasonContext,
  allAdminPaymentItems,
  canSeeMoney,
  readMoneyIn,
} from "@/lib/backend/admin-payments";
import { AdminHeader } from "@/features/admin/AdminHeader";
import { PaymentsNav } from "@/features/admin/GivingParts";
import { PaymentsFilters } from "@/features/admin/PaymentsFilters";
import {
  MoneyKeyNotices,
  PaymentsReport,
} from "@/features/admin/PaymentsReport";
import { moneyFilters, seasonRanges } from "@/features/admin/payment-forms";
import { gatewayWords } from "@/features/admin/payment-words";
import { boardPage } from "@/features/admin/page-state/board-page";

/**
 * Payments → Money in (PR6 WP-7, D-64): what came in per fund and ticket,
 * read live from Go2Pay with the "Take payments only" key, for board members
 * who can manage money. Others see the Funds and Tickets tabs only.
 */
async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdmin();
  const query = await searchParams;
  const header = (
    <>
      <AdminHeader title="Payments" />
      <PaymentsNav current="money" />
    </>
  );
  if (!canSeeMoney(admin))
    return (
      <div className="admin-shell">
        {header}
        <section className="content-card" aria-labelledby="money-only">
          <h2 id="money-only">Only for board members who can manage money</h2>
          <p>
            Money in shows givers&apos; names and notes, so only board members
            with <strong>Manage money</strong> can open it. Ask a board member
            who can manage people to give it to you.
          </p>
          <p>
            Any board member can add and edit{" "}
            <Link className="text-link" href="/admin/payments/funds">
              Funds
            </Link>{" "}
            and{" "}
            <Link className="text-link" href="/admin/payments/tickets">
              Tickets
            </Link>
            .
          </p>
        </section>
      </div>
    );

  const [context, rows] = await Promise.all([
    adminSeasonContext(),
    allAdminPaymentItems(),
  ]);
  const seasons = seasonRanges(
    context.seasons,
    context.today,
    context.adjustment,
  );
  const filters = moneyFilters(query, context.today, seasons);
  const money = await readMoneyIn(admin, filters, rows);
  return (
    <div className="admin-shell">
      {header}
      <MoneyKeyNotices
        mode={
          money.state === "ready" || money.state === "gateway"
            ? money.mode
            : null
        }
        broadKey={money.state === "ready" && money.broadKey}
      />
      <PaymentsFilters filters={filters} seasons={seasons} items={rows.items} />
      {money.state === "unavailable" ? (
        <p role="alert" className="content-card">
          Funds and tickets could not be loaded. Check your connection and
          reload.
        </p>
      ) : money.state === "gateway" ? (
        <p role="alert" className="form-error">
          {gatewayWords[money.problem]}
        </p>
      ) : money.state === "ready" ? (
        <>
          {money.partial ? (
            <p role="alert" className="form-error">
              {gatewayWords.partial}
            </p>
          ) : null}
          <PaymentsReport report={money.report} />
        </>
      ) : null}
    </div>
  );
}

export default boardPage(PaymentsPage);
