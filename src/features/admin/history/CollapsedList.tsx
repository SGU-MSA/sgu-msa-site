"use client";
import { useRef, useState, type ReactNode } from "react";

/**
 * A list that starts with its first `shown` entries and a "Show more"
 * button for the rest (review fixes P1, item 7). After Show more, focus
 * moves to the first entry that appeared, so a keyboard user carries on
 * reading from there.
 */
export function CollapsedList({
  items,
  shown,
  className,
}: {
  /** The list's entries, each one `<li>` with its key. */
  items: readonly ReactNode[];
  shown: number;
  className?: string;
}) {
  // Worked out from the current count: a list that grows past `shown`
  // (a restore adds an entry) collapses again until Show more.
  const [expanded, setExpanded] = useState(false);
  const all = expanded || items.length <= shown;
  const list = useRef<HTMLOListElement>(null);
  const showMore = () => {
    setExpanded(true);
    // After React has drawn the new entries.
    requestAnimationFrame(() => {
      const next = list.current?.children[shown] as HTMLElement | undefined;
      next?.setAttribute("tabindex", "-1");
      next?.focus();
    });
  };
  return (
    <>
      <ol ref={list} className={className}>
        {all ? items : items.slice(0, shown)}
      </ol>
      {all ? null : (
        <button type="button" className="button-secondary" onClick={showMore}>
          Show more
        </button>
      )}
    </>
  );
}
