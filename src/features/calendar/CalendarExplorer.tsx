"use client";

import {
  categoryTone,
  optionsWithItems,
  type Lists,
} from "@/lib/community/lists";
import { isUpcoming } from "@/lib/community/schema";
import { useMemo, useState, type ReactNode } from "react";

import c from "./calendar.module.css";
import { CalendarFilters } from "./CalendarFilters";
import { EventCard } from "./EventCard";
import { monthKey } from "./format";
import { MiniMonth } from "./MiniMonth";
import type { CalendarEntry } from "./types";

type CalendarExplorerProps = {
  events: CalendarEntry[];
  /** The board's Lists: the category and term filters (review fixes P3). */
  lists: Pick<Lists, "event_categories" | "terms">;
  /** Today in Grenada on the server clock: ringed on the month. */
  today: string | null;
  emptyMessage: string;
  unavailable: boolean;
  /** The page's verse, set under the filters. */
  note?: ReactNode;
};

/**
 * Events, "Almanac" (D-1): the mini month is always open beside the event
 * cards, so the agenda and the month are read together instead of toggled.
 */
export function CalendarExplorer({
  events,
  lists,
  today,
  emptyMessage,
  unavailable,
  note,
}: CalendarExplorerProps) {
  const [archive, setArchive] = useState(false);
  const [chosenCategory, setCategory] = useState("all");
  const [chosenTerm, setTerm] = useState("all");
  // The events of the tab being shown: upcoming or past.
  const tabEvents = useMemo(() => {
    const now = new Date(); // Browser clock: the visitor's "now" for this filter.
    return events.filter((event) =>
      archive ? !isUpcoming(event, now) : isUpcoming(event, now),
    );
  }, [archive, events]);
  // Only the options some event in this tab has, in the board's order
  // (review fixes P3): a choice that would show nothing is hidden.
  const categories = useMemo(
    () =>
      optionsWithItems(
        lists.event_categories,
        new Set(tabEvents.flatMap((event) => event.category ?? [])),
      ).map((option) => ({
        slug: option.slug,
        name: option.name,
        tone: categoryTone(lists.event_categories.indexOf(option)),
      })),
    [tabEvents, lists.event_categories],
  );
  const terms = useMemo(
    () =>
      optionsWithItems(
        lists.terms,
        new Set(tabEvents.flatMap((event) => event.term ?? [])),
      ),
    [tabEvents, lists.terms],
  );
  // A choice this tab no longer offers falls back to "All".
  const category = categories.some((item) => item.slug === chosenCategory)
    ? chosenCategory
    : "all";
  const term = terms.some((item) => item.slug === chosenTerm)
    ? chosenTerm
    : "all";
  const showTab = (value: boolean) => {
    setArchive(value);
    setCategory("all");
    setTerm("all");
  };

  // The almanac opens on the month of the next event (or the first listed).
  const [month, setMonth] = useState(() => {
    const now = new Date(); // Browser clock: the visitor's "now".
    const first =
      events.find((event) => isUpcoming(event, now))?.date ?? events[0]?.date;
    const date = first ? new Date(`${first}T12:00:00`) : now;
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });

  const filtered = useMemo(
    () =>
      tabEvents.filter(
        (event) =>
          (category === "all" || event.category === category) &&
          (term === "all" || event.term === term),
      ),
    [category, tabEvents, term],
  );

  // Cards are grouped by month so a long list stays scannable.
  const grouped = useMemo(() => {
    const groups: Array<{ label: string; items: CalendarEntry[] }> = [];
    for (const event of filtered) {
      const label = monthKey(event.date);
      const last = groups.at(-1);
      if (last?.label === label) last.items.push(event);
      else groups.push({ label, items: [event] });
    }
    return groups;
  }, [filtered]);

  // The one most important thing: the next upcoming event (none in the past list).
  const next = archive ? null : (filtered[0] ?? null);

  return (
    <div className={c.layout}>
      <div className={c.side}>
        <MiniMonth
          events={filtered}
          month={month}
          onMonthChange={setMonth}
          today={today}
          hrefFor={(event) => `#event-${event.id}`}
        />
        <CalendarFilters
          archive={archive}
          setArchive={showTab}
          category={category}
          setCategory={setCategory}
          term={term}
          setTerm={setTerm}
          categories={categories}
          terms={terms}
          resultCount={filtered.length}
        />
        {note}
      </div>

      <div className={c.main}>
        {unavailable ? (
          <p role="alert" className={c.alert}>
            Events are temporarily unavailable. Please try again shortly.
          </p>
        ) : null}
        {filtered.length === 0 ? (
          <div className={c.empty}>
            <p className={c.emptyTitle}>
              {events.length ? "No matching events" : emptyMessage}
            </p>
            {events.length ? (
              <p className={c.emptyHint}>Try another category or term.</p>
            ) : null}
          </div>
        ) : (
          grouped.map((group) => {
            const split = group.label.lastIndexOf(" ");
            return (
              <section
                key={group.label}
                aria-label={group.label}
                className={c.group}
              >
                <h2 className={c.monthLabel}>
                  {split > 0 ? (
                    <>
                      {group.label.slice(0, split)}{" "}
                      <em>{group.label.slice(split + 1)}</em>
                    </>
                  ) : (
                    group.label
                  )}
                </h2>
                <ol className={c.cards}>
                  {group.items.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      isNext={event.id === next?.id}
                    />
                  ))}
                </ol>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
