"use client";

import { LazyMotion, MotionConfig, domAnimation } from "motion/react";

/**
 * Every Motion animation on the site (review fixes PR-C): components draw
 * with the small `m` (from "motion/react-m") and LazyMotion gives them only
 * the animation features they use (animations, variants, exit, in-view),
 * instead of every page loading all of Motion (drag and layout animations
 * stay out; the dashboard's dragged lists bring their own). The features
 * load with the page, not later: a later load would update every animated
 * component while the page is still arriving. Honours the visitor's
 * reduced-motion setting for every animation.
 */
export function MotionRoot({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
