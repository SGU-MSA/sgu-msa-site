import {
  CATEGORIES,
  type PaymentsReport as Report,
  type ReportLine,
  productLabel,
} from "@/lib/community/payment-policy";
import type { Category } from "@/lib/community/payments";
import { dayLabel } from "@/lib/time/date-label";
import { gatewayWords, money } from "./payment-words";

const statusWords: Record<string, string> = {
  PAID: "Paid",
  "PARTIAL REFUND": "Partly refunded",
  REFUNDED: "Refunded",
};

/** The unrestricted category tags, from `CATEGORIES` (no wording of our own). */
const unrestrictedTags = (Object.keys(CATEGORIES) as Category[])
  .filter((category) => !CATEGORIES[category].restricted)
  .map((category) => CATEGORIES[category].tag);

/**
 * The lines above Money in about the key: a TEST key (whose
 * orders are real, the probe of 2026-10-05: Go2Pay's test keys read live
 * orders), and a key that can do more than take payments (D-74).
 */
export function MoneyKeyNotices({
  mode,
  broadKey,
}: {
  /** Which payments were read; null when Go2Pay was not reached. */
  mode: "live" | "test" | "sample" | "off" | null;
  broadKey: boolean;
}) {
  return (
    <>
      {mode === "test" ? (
        <p role="status" className="prayer-note">
          <strong>TEST</strong> key: this computer reads Go2Pay with a test key.
          Developers only. Orders shown are real.
        </p>
      ) : null}
      {broadKey ? (
        <p role="alert" className="form-error">
          {gatewayWords.too_broad}
        </p>
      ) : null}
    </>
  );
}

function Lines({
  lines,
  total,
}: {
  lines: readonly ReportLine[];
  total?: { label: string; gift: number; refunded: number };
}) {
  if (!lines.length)
    return <p className="muted">Nothing came in for these days.</p>;
  return (
    <table className="money-lines">
      <thead>
        <tr>
          <th scope="col">Fund or ticket</th>
          <th scope="col">Payments</th>
          <th scope="col">Gifts</th>
          <th scope="col">Refunded</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => (
          <tr key={line.itemId}>
            <th scope="row">
              {line.name}
              <span className="muted money-products">
                {line.productIds.map(productLabel).join(", ")}
              </span>
            </th>
            <td>{line.orders}</td>
            <td>{money(line.gift)}</td>
            <td>{line.refunded ? money(line.refunded) : "—"}</td>
          </tr>
        ))}
      </tbody>
      {total ? (
        <tfoot>
          <tr>
            <th scope="row">{total.label}</th>
            <td />
            <td>{money(total.gift)}</td>
            <td>{total.refunded ? money(total.refunded) : "—"}</td>
          </tr>
        </tfoot>
      ) : null}
    </table>
  );
}

/**
 * Money in (PR6 WP-7, D-64; mockup `payments-audit` with the four
 * categories): each zakat category in its own box, never added to anything;
 * one box for unrestricted money with a subtotal; no grand total. Then every
 * counted payment, newest first, with the giver's name and note (on screen
 * only, D-3, D-39). Amounts: the gift first, what the buyer paid second (D-38).
 */
export function PaymentsReport({ report }: { report: Report }) {
  return (
    <>
      <div className="money-boxes">
        {report.restricted.map((box) => (
          <section
            key={box.category}
            className="content-card money-box money-box-restricted"
            aria-labelledby={`box-${box.category}`}
          >
            <h2 id={`box-${box.category}`}>{box.tag}</h2>
            <p>
              {CATEGORIES[box.category].ruleLine} Never added to any other
              total.
            </p>
            <Lines lines={box.lines} />
          </section>
        ))}
        <section
          className="content-card money-box"
          aria-labelledby="box-unrestricted"
        >
          <h2 id="box-unrestricted">Unrestricted</h2>
          <p>
            {unrestrictedTags.join(", ")}, season funds and ticket sales. The
            board decides how it is used.
          </p>
          <Lines
            lines={report.unrestricted.lines}
            total={{
              label: "Unrestricted money in",
              gift: report.unrestricted.subtotal.gift,
              refunded: report.unrestricted.subtotal.refunded,
            }}
          />
        </section>
      </div>
      <p className="prayer-note">
        There is <strong>no grand total</strong>: zakat is never added to other
        money. To match a Go2Pay payout, use the CSV.
      </p>
      <h2 className="money-heading">Every payment</h2>
      {report.rows.length ? (
        <table className="login-table money-table">
          <thead>
            <tr>
              <th scope="col">Date (Grenada)</th>
              <th scope="col">Fund or ticket</th>
              <th scope="col">Category</th>
              <th scope="col">Order</th>
              <th scope="col">Giver</th>
              <th scope="col">Note</th>
              <th scope="col">Gift</th>
              <th scope="col">Buyer paid</th>
              <th scope="col">Refunded</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr key={row.orderId}>
                <th scope="row">
                  <time dateTime={row.day}>{dayLabel(row.day)}</time>
                </th>
                <td data-label="Fund or ticket:">{row.itemName}</td>
                <td data-label="Category:">{row.tag}</td>
                <td data-label="Order:">
                  #{row.orderId}{" "}
                  <span className="muted">{productLabel(row.productId)}</span>
                </td>
                <td data-label="Giver:">{row.giver || "—"}</td>
                <td data-label="Note:">{row.note || "—"}</td>
                <td data-label="Gift:">{money(row.gift)}</td>
                <td data-label="Buyer paid:">{money(row.buyerPaid)}</td>
                <td data-label="Refunded:">
                  {row.refunded ? money(row.refunded) : "—"}
                </td>
                <td data-label="Status:">
                  {statusWords[row.status] ?? row.status}
                  {row.test ? <span className="admin-badge">Test</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="content-card">No payments for these filters.</p>
      )}
      <p className="muted">
        Givers&apos; names show here for board members who can manage money
        only. They are read from Go2Pay when you open this page, never kept on
        the website, and never in the CSV.
      </p>
    </>
  );
}
