import type { CategoryTone } from "@/lib/community/lists";

import c from "./calendar.module.css";

/** One filter choice from the Lists (review fixes P3): its slug, name and colour. */
export type FilterOption = { slug: string; name: string; tone?: CategoryTone };

type CalendarFiltersProps = {
  archive: boolean;
  setArchive: (value: boolean) => void;
  category: string;
  setCategory: (value: string) => void;
  term: string;
  setTerm: (value: string) => void;
  /** The board's event categories that have events, in the list's order. */
  categories: readonly FilterOption[];
  /** The board's terms that have events, in the list's order. */
  terms: readonly FilterOption[];
  resultCount: number;
};

/**
 * Upcoming or past, category (with its dot colour) and term, under the
 * almanac. The categories and terms are the board's Lists, and only those
 * with events (review fixes P3): a filter with nothing to choose is hidden.
 */
export function CalendarFilters({
  archive,
  setArchive,
  category,
  setCategory,
  term,
  setTerm,
  categories,
  terms,
  resultCount,
}: CalendarFiltersProps) {
  return (
    <div className={c.filters}>
      <div role="group" aria-label="Which events" className={c.pair}>
        <button
          type="button"
          aria-pressed={!archive}
          onClick={() => setArchive(false)}
        >
          Upcoming events
        </button>
        <button
          type="button"
          aria-pressed={archive}
          onClick={() => setArchive(true)}
        >
          Past events
        </button>
      </div>

      {categories.length ? (
        <div role="group" aria-label="Event category" className={c.legend}>
          <button
            type="button"
            aria-pressed={category === "all"}
            onClick={() => setCategory("all")}
          >
            All
          </button>
          {categories.map((item) => (
            <button
              key={item.slug}
              type="button"
              aria-pressed={category === item.slug}
              onClick={() => setCategory(item.slug)}
            >
              <span
                aria-hidden="true"
                className={`${c.legendDot} ${item.tone ? `category-${item.tone}` : ""}`}
              />
              {item.name}
            </button>
          ))}
        </div>
      ) : null}

      {terms.length ? (
        <label className={c.termRow}>
          <span className={c.label}>Term</span>
          <select
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            className={c.select}
          >
            <option value="all">All terms</option>
            {terms.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <p aria-live="polite" className={c.count}>
        {resultCount} {resultCount === 1 ? "event" : "events"}
      </p>
    </div>
  );
}
