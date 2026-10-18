"use client";

import { Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { FAQContent } from "@/lib/content/schemas";
import { InkRing } from "@/shared/ui/InkRing";

import s from "./faq.module.css";

type FAQItem = FAQContent["items"][number];

/** 0 -> "01": the question numbers down the sheet. */
const numeral = (index: number) => String(index + 1).padStart(2, "0");

/**
 * FAQ option B, "Folded notes" (PR8 D-7): the questions folded on a sheet of
 * paper; opening one circles its number in ink. Each question is a real
 * button inside an h2 (aria-expanded + aria-controls), so Tab, Enter and
 * Space work. Closed answers use hidden="until-found", so the browser's
 * find-in-page still reaches them and opens the row, and a link to
 * /faq#<question id> opens that row on arrival.
 */
export function FoldedList({ items }: { items: FAQItem[] }) {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());

  const setRow = useCallback((id: string, value?: boolean) => {
    setOpen((current) => {
      const next = new Set(current);
      if (value ?? !next.has(id)) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  useEffect(() => {
    const openFromHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (items.some((item) => item.id === id)) setRow(id, true);
    };
    const frame = requestAnimationFrame(openFromHash);
    window.addEventListener("hashchange", openFromHash);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", openFromHash);
    };
  }, [items, setRow]);

  return (
    <ol className={s.list}>
      {items.map((item, index) => (
        <FoldedRow
          key={item.id}
          item={item}
          number={numeral(index)}
          open={open.has(item.id)}
          setRow={setRow}
        />
      ))}
    </ol>
  );
}

function FoldedRow({
  item,
  number,
  open,
  setRow,
}: {
  item: FAQItem;
  number: string;
  open: boolean;
  setRow: (id: string, value?: boolean) => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const buttonId = `faq-q-${item.id}`;
  const panelId = `faq-a-${item.id}`;

  // React types `hidden` as a boolean; upgrade a closed answer to
  // until-found in the browser so find-in-page can open it.
  useEffect(() => {
    const node = panel.current;
    if (!node) return;
    if (open) {
      node.removeAttribute("hidden");
      return;
    }
    node.setAttribute("hidden", "until-found");
    const onMatch = () => setRow(item.id, true);
    node.addEventListener("beforematch", onMatch);
    return () => node.removeEventListener("beforematch", onMatch);
  }, [open, item.id, setRow]);

  return (
    <li id={item.id} className={s.row} data-open={open || undefined}>
      <h2 className={s.question}>
        <button
          id={buttonId}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setRow(item.id)}
          className={s.button}
        >
          <span className={s.number} aria-hidden="true">
            {open ? <InkRing className={s.ring} /> : null}
            {number}
          </span>
          <span className={s.text}>{item.question}</span>
          <span className={s.mark} aria-hidden="true">
            {open ? (
              <Minus strokeWidth={1.25} className={s.icon} />
            ) : (
              <Plus strokeWidth={1.25} className={s.icon} />
            )}
          </span>
        </button>
      </h2>
      {/* No padding on the panel itself: a closed until-found panel keeps its own box. */}
      <div
        ref={panel}
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        hidden={!open}
      >
        <div className={s.answer}>
          <p>{item.answer}</p>
        </div>
      </div>
    </li>
  );
}
