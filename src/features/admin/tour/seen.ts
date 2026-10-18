import type { TourId } from "./steps";

/**
 * "This browser has seen the tour" (PR4 D-9): kept in the browser only, so
 * it may show again on a new phone or after clearing the browser. A blocked
 * storage counts as seen: the tour then never starts by itself, and
 * "Show me how" still works.
 */
export const tourSeenKey = (tour: TourId) => `sgu-admin-tour:v1:${tour}`;

export function tourSeen(tour: TourId) {
  try {
    return localStorage.getItem(tourSeenKey(tour)) !== null;
  } catch {
    return true;
  }
}

export function rememberTourSeen(tour: TourId) {
  try {
    localStorage.setItem(tourSeenKey(tour), "seen");
  } catch {
    // Storage blocked (private mode): nothing to remember.
  }
}
