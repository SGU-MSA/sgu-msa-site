import {
  moneyQuery,
  statusFilters,
  type MoneyFilters,
  type SeasonRange,
} from "./payment-forms";
import { categoryChoices } from "./payment-words";
import { DateField } from "@/shared/ui/DateField";
import { anyDate, dayRange } from "@/lib/time/field-rules";

/**
 * The Payments filters (PR6 WP-7, D-37, D-39; mockup `payments-audit`):
 * a season or two days (the last 30 days by default), category, fund or
 * ticket, and status, sent in the address so the CSV link carries the same
 * choice. A plain form: it works without JavaScript.
 */
export function PaymentsFilters({
  filters,
  seasons,
  items,
}: {
  filters: MoneyFilters;
  seasons: readonly SeasonRange[];
  items: readonly { id: string; name: string; archived_at: string | null }[];
}) {
  return (
    <>
      <form
        className="editor-form activity-filters"
        method="get"
        action="/admin/payments"
        aria-label="Filters"
      >
        <label>
          Season
          <select name="season" defaultValue={filters.season}>
            <option value="">The days below</option>
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          From
          <DateField name="from" rule={anyDate} defaultValue={filters.from} />
        </label>
        <label>
          Until
          <DateField
            name="until"
            rule={dayRange({ from: { box: "from" } })}
            defaultValue={filters.until}
          />
        </label>
        <label>
          Category
          <select name="category" defaultValue={filters.category}>
            <option value="">All categories</option>
            {categoryChoices.map(([value, tag]) => (
              <option key={value} value={value}>
                {tag}
              </option>
            ))}
          </select>
        </label>
        <label>
          Fund or ticket
          <select name="item" defaultValue={filters.item}>
            <option value="">All</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.archived_at ? `${item.name} (archived)` : item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select name="status" defaultValue={filters.status}>
            {statusFilters.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className="button-primary">Show</button>
      </form>
      <p className="admin-actions">
        <a
          className="button-secondary"
          href={`/admin/payments/export?${moneyQuery(filters)}`}
          download
        >
          Download CSV
        </a>
        <span className="muted">
          The CSV has the same rows with each giver&apos;s note, never their
          name. It is made when you click and is not kept on the website.
        </span>
      </p>
    </>
  );
}
