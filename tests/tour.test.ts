import test from "node:test";
import assert from "node:assert/strict";
import {
  firstVisitTour,
  tourSteps,
  type TourId,
} from "../src/features/admin/tour/steps";
import {
  rememberTourSeen,
  tourSeen,
  tourSeenKey,
} from "../src/features/admin/tour/seen";

test("the six tours have the approved steps, each text 25 words or fewer (PR4 D-10)", () => {
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(tourSteps).map(([id, steps]) => [id, steps.length]),
    ),
    {
      dashboard: 6,
      // Review fixes P2: no Hijri date step.
      prayer: 8,
      // Review 2: "Also post an announcement?" (only while it is asked).
      content: 9,
      people: 5,
      handover: 4,
      activity: 2,
    },
  );
  for (const [id, steps] of Object.entries(tourSteps))
    for (const step of steps) {
      assert.match(String(step.target), /^\[data-tour="[a-z-]+"\]/, id);
      assert.ok(String(step.title).trim(), `${id}: every step has a title`);
      const words = String(step.content).trim().split(/\s+/).length;
      assert.ok(words <= 25, `${id} "${step.title}": ${words} words`);
    }
  // Only the dashboard's tour starts by itself (D-8).
  assert.equal(firstVisitTour, "dashboard");
});

test("tour seen is remembered in the browser; blocked storage never auto-starts (PR4 D-9)", () => {
  const tour: TourId = "dashboard";
  const stored = new Map<string, string>();
  Object.assign(globalThis, {
    localStorage: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => void stored.set(key, value),
    },
  });
  try {
    assert.equal(tourSeen(tour), false);
    rememberTourSeen(tour);
    assert.equal(tourSeen(tour), true);
    assert.deepEqual([...stored.keys()], [tourSeenKey(tour)]);
    assert.equal(tourSeen("prayer"), false);
  } finally {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  }
  // No storage (blocked or private mode): counts as seen, and writing is harmless.
  assert.equal(tourSeen(tour), true);
  assert.doesNotThrow(() => rememberTourSeen(tour));
});
