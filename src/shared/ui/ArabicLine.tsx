"use client";
import { useLayoutEffect, useRef, type CSSProperties } from "react";

import { arabicEmEstimate } from "./arabicFit";
import styles from "./reminders.module.css";

/**
 * The text's width on one line, in em, measured with a hidden copy at a
 * fixed size; null when the browser lays out nothing (hidden, or no layout).
 */
function measuredEm(element: HTMLElement): number | null {
  const probe = element.cloneNode(true) as HTMLElement;
  probe.removeAttribute("id");
  probe.setAttribute("aria-hidden", "true");
  Object.assign(probe.style, {
    position: "absolute",
    insetBlockStart: "0",
    insetInlineStart: "0",
    visibility: "hidden",
    pointerEvents: "none",
    whiteSpace: "nowrap",
    width: "max-content",
    maxWidth: "none",
    margin: "0",
    padding: "0",
    fontSize: "100px",
  });
  (element.parentElement ?? document.body).append(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return width > 0 ? Math.ceil(width) / 100 : null;
}

/**
 * One Arabic reminder text, set level and right to left (ADR 0018). It fills
 * its box on one line, shrinking from the caller's largest size to its
 * smallest readable one; only then does it wrap, into balanced lines, and
 * nothing reserves room for lines it does not use (review fixes PR-3). The
 * caller's class sets the font and `--arabic-max`, `--arabic-min` and
 * `--arabic-reserve` (room in the box for anything beside the text); a
 * class that sets its own font-size keeps it.
 */
export function ArabicLine({
  text,
  as: Tag = "span",
  className,
}: {
  text: string;
  as?: "span" | "p" | "blockquote";
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    let current = true;
    const measure = () => {
      const em = current ? measuredEm(element) : null;
      if (em === null) return false;
      element.style.setProperty("--arabic-em", String(em));
      return true;
    };
    // A text drawn hidden (a closed section) is measured when it first shows.
    const shown =
      typeof ResizeObserver === "undefined" || measure()
        ? null
        : new ResizeObserver(() => {
            if (measure()) shown?.disconnect();
          });
    shown?.observe(element);
    // Measured again once the Arabic font has loaded (the first measure may use a fallback).
    void document.fonts?.ready.then(measure);
    return () => {
      current = false;
      shown?.disconnect();
    };
  }, [text]);
  return (
    <Tag
      ref={ref as never}
      lang="ar"
      dir="rtl"
      className={className ? `${styles.arabic} ${className}` : styles.arabic}
      style={{ "--arabic-em": arabicEmEstimate(text) } as CSSProperties}
    >
      {text}
    </Tag>
  );
}
