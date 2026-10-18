import { useId, type ReactNode } from "react";

import styles from "./paper.module.css";

/**
 * The hand-drawn ink ring (ADR 0018) around the next prayer. It fills its
 * positioned parent; decoration only, in the --ring colour.
 */
export function InkRing({ className }: { className?: string }) {
  const filter = `ink-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 300 100"
      preserveAspectRatio="none"
      className={className ? `${styles.ring} ${className}` : styles.ring}
    >
      <defs>
        <filter id={filter}>
          <feTurbulence baseFrequency=".045" numOctaves={3} seed={4} />
          <feDisplacementMap in="SourceGraphic" scale={8} />
        </filter>
      </defs>
      <ellipse
        cx="148"
        cy="50"
        rx="140"
        ry="40"
        fill="none"
        stroke="var(--ring)"
        strokeWidth="3.2"
        strokeDasharray="480 12 280 8"
        filter={`url(#${filter})`}
      />
    </svg>
  );
}

/**
 * The ink ring drawn just outside one action, a `ButtonLink`: the one most
 * important thing on the page (Donate's "Continue to donate", Ramadan's
 * calendar out of season).
 */
export function InkRingAround({ children }: { children: ReactNode }) {
  return (
    <span className={styles.ringAround}>
      <span className={styles.ringAroundBox}>
        <InkRing />
      </span>
      {children}
    </span>
  );
}
