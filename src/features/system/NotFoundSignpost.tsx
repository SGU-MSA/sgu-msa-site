import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Container } from "@/shared/ui/Container";
import { InkRing } from "@/shared/ui/InkRing";
import quiet from "@/shared/ui/page.module.css";

import s from "./system.module.css";

type Way = { label: string; href: string };

const givingWays: Way[] = [
  { label: "Donate", href: "/donate" },
  { label: "Home", href: "/" },
];

/**
 * An old Give link to a fund or ticket that has closed, is archived or never
 * existed (PR6 D-53): the Give route's 404 wording, also used by the story.
 */
export const CLOSED_GIVING_SIGNPOST = {
  title: "This has closed",
  body: "This giving item has closed or is no longer available. You can still give to the MSA's current appeals.",
  ways: givingWays,
} as const satisfies { title: string; body: string; ways: Way[] };

/** Give when our own database cannot be read (PR6 Design → Give route): no redirect. */
export const GIVING_UNAVAILABLE_SIGNPOST = {
  eyebrow: null,
  title: "Temporarily unavailable",
  body: "Giving can't open right now. Please try again in a few minutes.",
  ways: givingWays,
} as const satisfies {
  eyebrow: null;
  title: string;
  body: string;
  ways: Way[];
};

const defaultWays: Way[] = [
  { label: "Home", href: "/" },
  { label: "Prayer & Musallah", href: "/prayer" },
  { label: "Calendar", href: "/calendar" },
];

/**
 * Page not found, "Ledger" signpost (PR8 D-7): the message on the left and
 * the ways on as ruled rows on the right, the first circled in ink. A route's
 * own not-found.tsx may pass its wording and links, e.g. a closed fund's old
 * Give link (PR6): "This has closed" with Donate and Home.
 */
export function NotFoundSignpost({
  eyebrow = "404",
  title = "Page not found",
  body = "That page has moved or never existed. The links below cover most of what people are looking for.",
  ways = defaultWays,
}: {
  /** The small line above the title: "404", or none (null) on a page that is not a 404. */
  eyebrow?: string | null;
  title?: string;
  body?: string;
  ways?: readonly Way[];
} = {}) {
  return (
    <div className={s.page}>
      <Container className={s.post}>
        <div className={`${s.postMain} ${quiet.enter}`}>
          {eyebrow ? <p className={s.eyebrow}>{eyebrow}</p> : null}
          <h1 className={`${quiet.display} ${s.title}`}>{title}</h1>
          <p className={s.body}>{body}</p>
        </div>
        <div className={s.postSide}>
          <ul className={s.signs}>
            {ways.map((way, i) => (
              <li key={way.href}>
                <Link href={way.href}>
                  {i === 0 ? (
                    <span className={s.signFirst}>
                      <InkRing />
                      <span className={s.signLabel}>{way.label}</span>
                    </span>
                  ) : (
                    <span className={s.signLabel}>{way.label}</span>
                  )}
                  <ArrowRight aria-hidden="true" className={s.arrow} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </div>
  );
}
