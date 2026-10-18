/** The server's notion of "now". Only `providers.ts` chooses which clock runs. */
export type Clock = { now(): Date };

export const systemClock: Clock = { now: () => new Date() };

/** A clock frozen at one instant (sample data's seed time). */
export function fixedClock(at: Date): Clock {
  const instant = at.getTime();
  return { now: () => new Date(instant) };
}
