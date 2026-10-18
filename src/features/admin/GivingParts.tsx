import Link from "next/link";
import type { ItemFlag } from "@/lib/community/payment-policy";
import type { SeasonDates } from "@/lib/community/season-policy";
import { shortDateLabel } from "@/lib/time/date-label";
import { itemFlagText, sideStatusWords } from "./payment-words";

/**
 * Small parts the giving screens share (PR6 WP-5, WP-6, WP-7): the Payments
 * tabs, a season's days with their badges, and a fund's flags.
 */

const tabs = [
  ["money", "/admin/payments", "Money in"],
  ["funds", "/admin/payments/funds", "Funds"],
  ["tickets", "/admin/payments/tickets", "Tickets"],
] as const;

/** Money in, Funds and Tickets (mockup `payments-audit`; no Headings tab, D-77). */
export function PaymentsNav({
  current,
}: {
  current: (typeof tabs)[number][0];
}) {
  return (
    <nav className="admin-actions" aria-label="Payments">
      {tabs.map(([key, href, label]) => (
        <Link
          key={key}
          className="button-secondary"
          href={href}
          aria-current={key === current ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

/** "8 Feb expected – 8 Mar 2027 expected": Gregorian days only (D-78). */
export function SeasonDays({ dates }: { dates: SeasonDates | undefined }) {
  if (!dates || dates.state === "unavailable")
    return <span className="muted">Dates unavailable</span>;
  if (dates.state === "over")
    return <span className="muted">Over: type new days to run it again</span>;
  const side = (day: string, status: keyof typeof sideStatusWords) => (
    <>
      <time dateTime={day}>
        {shortDateLabel(day)}
        {day === dates.last ? ` ${day.slice(0, 4)}` : ""}
      </time>{" "}
      <span className="admin-badge">{sideStatusWords[status]}</span>
    </>
  );
  return (
    <span className="season-days">
      {side(dates.first, dates.firstStatus)}
      {dates.first === dates.last ? null : (
        <> – {side(dates.last, dates.lastStatus)}</>
      )}
    </span>
  );
}

/** A fund's or ticket's flags as badges; an ended one asks to close it in Go2Pay. */
export function ItemFlags({
  flags,
  endDateShown = false,
}: {
  flags: readonly ItemFlag[];
  /** The row already says when it ended (a fund's Donate line). */
  endDateShown?: boolean;
}) {
  if (!flags.length) return null;
  return (
    <p className="admin-badges">
      {flags.map((flag) => (
        <span
          key={flag.code}
          className={
            flag.code === "ended" || flag.code === "no_link"
              ? "admin-badge giving-attention"
              : "admin-badge"
          }
        >
          {itemFlagText(flag, { endDateShown })}
        </span>
      ))}
    </p>
  );
}
