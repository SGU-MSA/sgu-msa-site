import type { ReactNode } from "react";
import s from "./ItemRows.module.css";

/**
 * One item of a board list, read-only: its name, one line about it, and
 * its one action (an Edit link or button).
 */
export function ItemRow({
  title,
  summary,
  action,
}: {
  title: string;
  summary: string;
  action: ReactNode;
}) {
  return (
    <div className={s.row}>
      <div className={s.text}>
        <h3 className={s.title}>{title}</h3>
        <p className={s.summary}>{summary}</p>
      </div>
      {action}
    </div>
  );
}

/** The line above a list: its Add button (and, optionally, a heading). */
export function ListTop({
  heading,
  children,
}: {
  heading?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={s.top}>
      {heading}
      {children}
    </div>
  );
}

/** First line of a text, for a row's summary. */
export function firstLine(text: string, fallback: string) {
  const line = text.split("\n").find((part) => part.trim());
  return line ? line.trim() : fallback;
}
