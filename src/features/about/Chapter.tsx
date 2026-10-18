import type { ReactNode } from "react";

import { InkHeading } from "@/shared/ui/InkHeading";
import quiet from "@/shared/ui/page.module.css";

import s from "./about.module.css";

/** One entry of the About chapter index: the anchor id and its heading. */
export type ChapterEntry = { id: string; label: string };

/** "01", "02", … : a chapter's place in the index (decorative, not read out). */
export const chapterNumber = (index: number) =>
  String(index + 1).padStart(2, "0");

/** The rule, number and split heading at the top of a chapter. */
export function ChapterHead({
  id,
  number,
  heading,
  kicker,
}: {
  id: string;
  number: string;
  heading: string;
  /** A small label above the heading ("Leadership" on the team, PR3 D-31). */
  kicker?: string;
}) {
  return (
    <div className={s.chapterHead}>
      <span className={s.chapterNumber} aria-hidden="true">
        {number}
      </span>
      <div className={s.chapterHeading}>
        {kicker ? <p className={s.kicker}>{kicker}</p> : null}
        <InkHeading
          id={`${id}-title`}
          text={heading}
          className={`${quiet.h2} ${s.chapterTitle}`}
          inline
        />
      </div>
    </div>
  );
}

/** A numbered About chapter, reachable from the index by its id. */
export function Chapter({
  id,
  number,
  heading,
  kicker,
  children,
}: {
  id: string;
  number: string;
  heading: string;
  kicker?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={s.chapter} aria-labelledby={`${id}-title`}>
      <ChapterHead id={id} number={number} heading={heading} kicker={kicker} />
      {children}
    </section>
  );
}

/** The numbered index beside the chapters (two columns above them on phones). */
export function ChapterIndex({ chapters }: { chapters: ChapterEntry[] }) {
  return (
    <nav className={s.index} aria-label="On this page">
      <ol>
        {chapters.map((chapter, index) => (
          <li key={chapter.id}>
            <a href={`#${chapter.id}`}>
              <span className={s.indexNumber} aria-hidden="true">
                {chapterNumber(index)}
              </span>
              <span>{chapter.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
