/**
 * Which board form the one "Unsaved changes" bar speaks for (review
 * follow-ups, 2026-10-07): a screen may hold several forms (Prayer & iqamah
 * and its pin, each option on Lists), and the bar at the bottom of the screen
 * is one. Each form with changes (or saving) claims it; the form changed
 * last owns it, and when that one is saved or gone the one before it takes
 * the bar back. Plain module state, like the unsaved-changes guard: one
 * dashboard page at a time in a browser tab.
 */
const claims: string[] = [];
const listeners = new Set<() => void>();

const notify = () => {
  for (const listener of listeners) listener();
};

/** `form` has a change (or is saving): it owns the bar from now on. */
export function claimBar(form: string) {
  const at = claims.indexOf(form);
  if (at === claims.length - 1 && at >= 0) return;
  if (at >= 0) claims.splice(at, 1);
  claims.push(form);
  notify();
}

/** `form` has nothing left to save, or is gone. */
export function releaseBar(form: string) {
  const at = claims.indexOf(form);
  if (at < 0) return;
  claims.splice(at, 1);
  notify();
}

/** The form the bar speaks for, or null when no form has changes. */
export const barOwner = (): string | null => claims.at(-1) ?? null;

/** For `useSyncExternalStore`. */
export function subscribeBar(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
