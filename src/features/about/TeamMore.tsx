"use client";
import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import s from "./about.module.css";

/**
 * "View all" under the Executive board on About (user, 2026-10-07): a
 * disclosure button that opens the rest of the team right below it on the
 * same page, then reads "Show less". A native button, so Enter and Space
 * work; focus stays on it.
 */
export function TeamMore({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className={s.more}>
      <button
        type="button"
        className={`design-button design-button-outline group inline-flex min-h-11 items-center justify-center gap-3 border font-semibold ${s.moreButton}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((shown) => !shown)}
      >
        {open ? "Show less" : "View all"}
        <ChevronDown
          aria-hidden="true"
          className={`size-4 shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div id={id} hidden={!open} className={s.moreList}>
        {children}
      </div>
    </div>
  );
}
