"use client";

import Link from "next/link";
import { Minus, Plus } from "lucide-react";
import { useId, useState } from "react";

import { Container } from "@/shared/ui/Container";

import h from "./home.module.css";
import s from "@/shared/ui/page.module.css";

export type FAQItem = {
  id: string;
  question: string;
  answer: string;
};

function FAQRow({ item, level }: { item: FAQItem; level: 2 | 3 }) {
  const [open, setOpen] = useState(false);
  const baseId = useId();
  const panelId = `${baseId}-panel`;
  const buttonId = `${baseId}-button`;

  const Heading = level === 2 ? "h2" : "h3";

  return (
    <div className="border-b border-[var(--rule)] last:border-b-0">
      <Heading>
        <button
          id={buttonId}
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex min-h-16 w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm text-[var(--muted)] transition-colors hover:bg-white/[.025] hover:text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]"
        >
          <span>{item.question}</span>
          {open ? (
            <Minus
              aria-hidden="true"
              className="size-4 shrink-0 text-[var(--ring)]"
              strokeWidth={1.5}
            />
          ) : (
            <Plus
              aria-hidden="true"
              className="size-4 shrink-0 text-[var(--muted)]"
              strokeWidth={1.5}
            />
          )}
        </button>
      </Heading>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        className={`grid transition-[grid-template-rows] duration-300 ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <p className="px-5 pb-5 text-sm leading-6 text-[var(--muted)]">
            {item.answer}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Reusable accordion list — shared by the homepage preview and /faq.
 *
 * `level` keeps the document outline valid in both places: on the homepage the
 * questions sit under an h2 ("Common Questions"), on /faq they sit directly
 * under the page h1.
 */
export function FAQList({
  items,
  level = 3,
}: {
  items: FAQItem[];
  level?: 2 | 3;
}) {
  return (
    <>
      {items.map((item) => (
        <FAQRow key={item.id} item={item} level={level} />
      ))}
    </>
  );
}

export function FAQPreview({
  items,
  eyebrow,
  heading,
}: {
  items: FAQItem[];
  eyebrow?: string | null;
  heading: string;
}) {
  if (!items.length) return null;

  const columns = [
    items.filter((_, index) => index % 2 === 0),
    items.filter((_, index) => index % 2 === 1),
  ].filter((column) => column.length);

  return (
    <Container className={s.above}>
      <section
        className={`${s.rule} ${h.storiesSection}`}
        aria-labelledby="common-questions"
      >
        <div className={h.faqHead}>
          <div>
            {eyebrow ? <p className={s.eyebrow}>{eyebrow}</p> : null}
            <h2 id="common-questions" className={s.h2}>
              {heading}
            </h2>
          </div>
          <Link href="/faq" className={s.underline}>
            <span>View all Q&amp;A</span>
          </Link>
        </div>
        <div className={h.faqColumns}>
          {columns.map((column, index) => (
            <div key={index} className={h.faqColumn}>
              <FAQList items={column} level={3} />
            </div>
          ))}
        </div>
      </section>
    </Container>
  );
}
