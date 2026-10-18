"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";

import { InkRing } from "@/shared/ui/InkRing";

import s from "./involve.module.css";

export type ChooserItem = {
  id: string;
  number: string | null;
  title: string;
  summary: string;
  /** The pathway's sheet, rendered on the server for the page (it holds the form button). */
  panel: ReactNode;
};

/** Fired after a row updates the URL with replaceState (no hashchange). */
const PICKED = "msa:pathway-picked";

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  window.addEventListener("popstate", onChange);
  window.addEventListener(PICKED, onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(PICKED, onChange);
  };
}
const readHash = () => decodeURIComponent(window.location.hash.slice(1));
/** null on the server and while hydrating: the page is still the no-JS page. */
const noHash = () => null;

/**
 * Get Involved option B, "Chooser" (PR8 D-4): the pathway list beside one
 * pathway open on a paper sheet (under its own row on phones); the open row
 * wears the ink ring.
 *
 * Progressive enhancement:
 * - Without JavaScript every row is a link to its sheet (`#<pathway id>`), and
 *   CSS `:target` shows that sheet (the first one when none is targeted), so
 *   every pathway stays reachable.
 * - With JavaScript the rows become disclosure buttons with aria-expanded.
 * - Either way a link such as /get-involved#student-khutbah (Home) opens and
 *   lands on that pathway.
 */
export function Chooser({ items }: { items: ChooserItem[] }) {
  const hash = useSyncExternalStore(subscribe, readHash, noHash);
  const enhanced = hash !== null;
  const fromHash = items.some((item) => item.id === hash) ? hash : null;

  // A row the visitor picked; a later link to another pathway wins. Updated
  // while rendering (React's "adjust state when a prop changes" pattern).
  const [picked, setPicked] = useState<string | null>(null);
  const [seenHash, setSeenHash] = useState(fromHash);
  if (fromHash !== seenHash) {
    setSeenHash(fromHash);
    if (fromHash) setPicked(fromHash);
  }
  const open = picked ?? fromHash ?? items[0]?.id;

  // Bring a pathway opened by a link into view (Next's own hash scroll may
  // run while its sheet is still closed). Rows the visitor picks are skipped.
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!fromHash || fromHash === handled.current) return;
    handled.current = fromHash;
    document.getElementById(fromHash)?.scrollIntoView({ block: "start" });
  }, [fromHash]);

  function choose(id: string) {
    setPicked(id);
    handled.current = id;
    window.history.replaceState(window.history.state, "", `#${id}`);
    window.dispatchEvent(new Event(PICKED));
    // On phones the sheet opens under its row; bring it into view.
    requestAnimationFrame(() => {
      if (!window.matchMedia("(max-width: 51.99rem)").matches) return;
      const still = window.matchMedia("(prefers-reduced-motion: reduce)");
      document.getElementById(id)?.scrollIntoView({
        block: "start",
        behavior: still.matches ? "auto" : "smooth",
      });
    });
  }

  return (
    <div
      className={s.chooser}
      data-mode={enhanced ? "js" : "static"}
      style={{ "--rows": items.length } as CSSProperties}
    >
      {items.map((item) => {
        const isOpen = enhanced && item.id === open;
        const content = (
          <>
            <span className={s.rowNumber} aria-hidden="true">
              {item.number}
            </span>
            <span className={s.rowText}>
              <span className={s.rowTitle}>
                <InkRing className={s.rowRing} />
                {item.title}
              </span>
              <span className={s.rowSummary}>{item.summary}</span>
            </span>
          </>
        );
        return (
          <div key={item.id} className={s.slot}>
            {enhanced ? (
              <button
                type="button"
                className={s.row}
                aria-expanded={isOpen}
                aria-controls={item.id}
                onClick={() => choose(item.id)}
              >
                {content}
              </button>
            ) : (
              <a href={`#${item.id}`} className={s.row}>
                {content}
              </a>
            )}
            <div
              id={item.id}
              className={s.panel}
              hidden={enhanced ? !isOpen : undefined}
            >
              {item.panel}
            </div>
          </div>
        );
      })}
    </div>
  );
}
