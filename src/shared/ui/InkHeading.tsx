import type { ReactNode } from "react";

import s from "./page.module.css";

/**
 * Splits a content heading into the Quiet Paper headline: ink first line,
 * italic muted second line. "Our community, built by students" breaks after
 * the comma; otherwise after the first word ("Upcoming / at MSA"). One word
 * stays whole. The text itself is unchanged.
 */
export function splitHeading(text: string): [string, string | null] {
  const comma = text.indexOf(", ");
  if (comma > 0) return [text.slice(0, comma + 1), text.slice(comma + 2)];
  const space = text.indexOf(" ");
  if (space > 0) return [text.slice(0, space), text.slice(space + 1)];
  return [text, null];
}

export function InkHeading({
  text,
  as: Tag = "h2",
  id,
  className = s.h2,
  inline = false,
  after,
}: {
  text: string;
  as?: "h1" | "h2";
  id?: string;
  className?: string;
  /** Keep both parts on one line ("Prayer & Musallah"). */
  inline?: boolean;
  after?: ReactNode;
}) {
  const [first, rest] = splitHeading(text);
  return (
    <Tag id={id} className={className}>
      {first}
      {rest ? (
        <>
          {inline ? " " : <br />}
          <em>{rest}</em>
        </>
      ) : null}
      {after}
    </Tag>
  );
}
