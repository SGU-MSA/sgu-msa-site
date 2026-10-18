"use client";

import * as m from "motion/react-m";
import {
  AnimatePresence,
  useIsPresent,
  useReducedMotionConfig,
} from "motion/react";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type PointerEvent,
} from "react";

import { Container } from "./Container";
import s from "./UrgentNoticeRotator.module.css";

/** One urgent notice in the band: its title and the page with its details. */
export type UrgentNotice = { id: string; title: string; href: string };

// E-2: fixed in the component.
/** How long each notice stays before the next one. */
const HOLD_MS = 7000;
/** The slide, as `--motion-reveal` in tokens.css (480 ms). */
const MOVE = { duration: 0.48, ease: [0.2, 0.7, 0.2, 1] } as const;
/** A swipe moves on once the finger travels this far sideways. */
const SWIPE_PX = 40;

/** Nothing to subscribe to: the band only needs to know it has loaded. */
const noChanges = () => () => {};
const inBrowser = () => true;
const onServer = () => false;

const slide = {
  enter: (direction: number) => ({ x: `${2.5 * direction}rem`, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: `${-2.5 * direction}rem`, opacity: 0 }),
};

function Chevron({ next }: { next?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={s.chevron}>
      <path
        d={next ? "M5.5 2.5 11 8l-5.5 5.5" : "M10.5 2.5 5 8l5.5 5.5"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A notice's words and its "Details →" link. */
function NoticeText({ notice }: { notice: UrgentNotice }) {
  return (
    <p className={s.text}>
      <b>{notice.title}</b>{" "}
      <Link href={notice.href} className={s.details}>
        Details<span className="sr-only">: {notice.title}</span>
        <span aria-hidden="true"> →</span>
      </Link>
    </p>
  );
}

/** One notice of several; while it slides out it cannot be reached. */
function Slide({
  notice,
  position,
  count,
  direction,
  instant,
}: {
  notice: UrgentNotice;
  position: number;
  count: number;
  direction: number;
  instant: boolean;
}) {
  const present = useIsPresent();
  return (
    <m.div
      className={s.slide}
      role="group"
      aria-roledescription="notice"
      aria-label={`${position + 1} of ${count}`}
      inert={!present}
      aria-hidden={present ? undefined : true}
      custom={direction}
      variants={slide}
      initial="enter"
      animate="center"
      exit="exit"
      transition={instant ? { duration: 0 } : MOVE}
    >
      <NoticeText notice={notice} />
    </m.div>
  );
}

/**
 * The urgent notices under the menu (PR5a D-16, D-30; mockup variant D): a
 * dark ink band, newest first. One notice stays still. Several move on by
 * themselves every 7 s, with ‹ › arrows, one dot each ("1 of N" for screen readers only, review fixes PR-1) and swipe on
 * touch, and no pause button: once the visitor taps an arrow or a dot or
 * swipes, the band stays where they left it; it waits while a pointer or a
 * finger is on it or keyboard focus is inside; with reduced motion it never
 * moves by itself and changes with no slide. Screen readers hear changes only
 * when the band is not moving by itself (W3C carousel pattern).
 */
export function UrgentNoticeRotator({
  notices,
}: {
  notices: readonly UrgentNotice[];
}) {
  const count = notices.length;
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  /** The visitor used an arrow, a dot or a swipe: no more moving by itself. */
  const [stopped, setStopped] = useState(false);
  const [pointerOn, setPointerOn] = useState(false);
  const [focusIn, setFocusIn] = useState(false);
  // The visitor's setting, through MotionRoot (`reducedMotion="user"`). The
  // server cannot know it, so it counts only once the band has loaded: the
  // first browser render then matches the server's (`aria-live` included,
  // which React does not patch after hydration).
  const loaded = useSyncExternalStore(noChanges, inBrowser, onServer);
  const reduced = Boolean(useReducedMotionConfig()) && loaded;
  const swipeFrom = useRef<number | null>(null);
  const current = Math.min(index, Math.max(count - 1, 0));
  const running = count > 1 && !stopped && !pointerOn && !focusIn && !reduced;

  useEffect(() => {
    if (!running) return;
    const timer = setTimeout(() => {
      setDirection(1);
      setIndex((current + 1) % count);
    }, HOLD_MS);
    return () => clearTimeout(timer);
  }, [running, current, count]);

  if (!count) return null;
  if (count === 1)
    return (
      <section className={s.band} data-urgent-band aria-label="Urgent notices">
        <Container className={s.inner}>
          <div className={s.meta}>
            <span className={s.label}>Urgent</span>
          </div>
          <div className={s.viewport}>
            <div className={s.slide}>
              <NoticeText notice={notices[0]} />
            </div>
          </div>
        </Container>
      </section>
    );

  const take = (to: number, toward: number) => {
    setStopped(true);
    setDirection(toward);
    setIndex((to + count) % count);
  };
  const onBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null))
      setFocusIn(false);
  };
  const swipeEnd = (event: PointerEvent<HTMLDivElement>) => {
    const from = swipeFrom.current;
    swipeFrom.current = null;
    if (from === null) return;
    const moved = event.clientX - from;
    if (Math.abs(moved) > SWIPE_PX)
      take(current + (moved < 0 ? 1 : -1), moved < 0 ? 1 : -1);
  };
  const notice = notices[current];

  return (
    <section
      className={s.band}
      data-urgent-band
      aria-roledescription="carousel"
      aria-label="Urgent notices"
      onPointerEnter={() => setPointerOn(true)}
      onPointerLeave={() => setPointerOn(false)}
      onFocus={() => setFocusIn(true)}
      onBlur={onBlur}
    >
      <Container className={s.inner}>
        <div className={s.meta}>
          <span className={s.label}>Urgent</span>
          <button
            type="button"
            className={s.arrow}
            aria-label="Previous notice"
            onClick={() => take(current - 1, -1)}
          >
            <Chevron />
          </button>
          <span className={s.dots}>
            {notices.map((item, position) => (
              <button
                key={item.id}
                type="button"
                className={s.dot}
                aria-label={`Show notice ${position + 1}`}
                aria-current={position === current ? "true" : undefined}
                onClick={() =>
                  position !== current &&
                  take(position, position > current ? 1 : -1)
                }
              />
            ))}
          </span>
          <button
            type="button"
            className={s.arrow}
            aria-label="Next notice"
            onClick={() => take(current + 1, 1)}
          >
            <Chevron next />
          </button>
        </div>
        <div
          className={s.viewport}
          aria-live={running ? "off" : "polite"}
          onPointerDown={(event) => {
            swipeFrom.current = event.clientX;
          }}
          onPointerUp={swipeEnd}
          onPointerCancel={() => {
            swipeFrom.current = null;
          }}
        >
          <AnimatePresence initial={false} custom={direction}>
            <Slide
              key={notice.id}
              notice={notice}
              position={current}
              count={count}
              direction={direction}
              instant={reduced}
            />
          </AnimatePresence>
        </div>
      </Container>
    </section>
  );
}
