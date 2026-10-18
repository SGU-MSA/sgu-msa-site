"use client";

import * as m from "motion/react-m";
import {
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
} from "motion/react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import styles from "./reminders.module.css";

/**
 * The tasbih thread (ADR 0018): an inked thread of 99 beads (3 × 33) down
 * the page margin. It draws itself as the visitor scrolls and the beads fill
 * one by one; the long head bead sits on top and each group of 33 opens
 * with its phrase. Reduced motion: drawn complete and still. Decoration only
 * (aria-hidden); place it first inside a `threadHost` parent.
 */
const GROUP = 33;
const TOTAL = GROUP * 3;
/** Below the Container's lg gutter (3rem) the thread is slim: 1.25rem wide. */
const WIDE = "(min-width: 64rem)";

const subscribeWide = (onChange: () => void) => {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

export function TasbihThreadView({
  phrases,
}: {
  /** The three phrases at each 33; null when the reminders are unavailable. */
  phrases: readonly [string, string, string] | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const reduced = Boolean(useReducedMotion());
  const { scrollYProgress } = useScroll();
  const drawn = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    restDelta: 0.001,
  });
  const [filled, setFilled] = useState(0);
  const wide = useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE).matches,
    () => false,
  );

  useEffect(() => {
    const host = ref.current?.parentElement;
    if (!host) return;
    // clientHeight, not scrollHeight: the thread's own SVG overflows the host, so scrollHeight
    // would never shrink when content collapses (e.g. an FAQ answer closes).
    const observer = new ResizeObserver(() => setHeight(host.clientHeight));
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useMotionValueEvent(drawn, "change", (value) => {
    const next = Math.round(value * TOTAL);
    setFilled((previous) => (previous === next ? previous : next));
  });

  const top = 150;
  const bottom = Math.max(height - 260, top + 400);
  const bead = wide ? 3.2 : 2;
  const lead = wide ? 5 : 3.2;

  const { path, beads, x } = useMemo(() => {
    const x = (y: number) =>
      wide ? 20 + 7 * Math.sin(y / 170) : 10 + 3 * Math.sin(y / 170);
    const points: string[] = [];
    for (let y = top - 60; y <= bottom; y += 24)
      points.push(`${x(y).toFixed(1)},${y}`);
    const step = (bottom - top) / (TOTAL + 2);
    const beads = Array.from({ length: TOTAL }, (_, i) => {
      const group = Math.floor(i / GROUP);
      const y = top + step * (i + 1 + group);
      return { i, y, cx: x(y), group, first: i % GROUP === 0 };
    });
    return { path: `M${points.join(" L")}`, beads, x };
  }, [bottom, wide]);

  const count = reduced ? TOTAL : filled;

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={styles.thread}
      data-ready={height ? "" : undefined}
      data-filled={height ? count : undefined}
    >
      {height ? (
        <svg width="100%" height={height} className={styles.threadSvg}>
          <m.path
            d={path}
            fill="none"
            stroke="var(--thread)"
            strokeWidth={1.2}
            strokeLinecap="round"
            style={{ pathLength: reduced ? 1 : drawn }}
          />
          <rect
            x={x(top - 70) - 3.5}
            y={top - 92}
            width={7}
            height={22}
            rx={3.5}
            fill="var(--ring)"
          />
          {beads.map((b) => (
            <circle
              key={b.i}
              cx={b.cx}
              cy={b.y}
              r={b.first ? lead : bead}
              fill={
                b.i < count
                  ? b.first
                    ? "var(--ring)"
                    : "var(--ink)"
                  : "var(--paper)"
              }
              stroke={b.first ? "var(--ring)" : "var(--thread)"}
              strokeWidth={1}
            />
          ))}
        </svg>
      ) : null}
      {height && phrases
        ? beads
            .filter((b) => b.first)
            .map((b) => (
              <span
                key={b.group}
                lang="ar"
                dir="rtl"
                className={styles.threadLabel}
                style={{ top: b.y - 14, opacity: b.i < count ? 1 : 0.45 }}
              >
                {phrases[b.group]}
              </span>
            ))
        : null}
    </div>
  );
}
