"use client";
import dynamic from "next/dynamic";
import { useState, useSyncExternalStore } from "react";
import { tourSeen } from "./seen";
import { shownElement } from "./shown";
import { firstVisitTour, tourSteps, type TourId } from "./steps";

/**
 * The tour library loads only when a tour runs, so board pages without a
 * running tour (and pages without one at all) do not download it.
 */
const AdminTour = dynamic(() => import("./AdminTour"), { ssr: false });

/** Nothing to subscribe to: the answer is read once the page is hydrated. */
const noChanges = () => () => {};
/** On the server and while hydrating no tour starts by itself. */
const notOnServer = () => false;

/**
 * The page's content changes (a client-side visit draws it after the header).
 * Changes are gathered into one check per frame, so typing in a form does not
 * look for the tour's steps on every keystroke.
 */
function pageChanges(onChange: () => void) {
  let frame = 0;
  const watch = new MutationObserver(() => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      onChange();
    });
  });
  watch.observe(document.body, { childList: true, subtree: true });
  return () => {
    watch.disconnect();
    cancelAnimationFrame(frame);
  };
}

/**
 * Whether any step of the tour points at something shown on this page (not
 * at the hidden copy of a page visited just before).
 */
const stepsOnPage = (tour: TourId) => () =>
  tourSteps[tour].some((step) => shownElement(String(step.target)));

/**
 * The "Show me how" button of a board page: it plays the page's tour. The
 * dashboard's tour also starts by itself until this browser has seen it
 * (PR4 D-8, D-9), and `?tour=1` on a page's address starts its tour (for
 * help links). The button shows only while a step of the tour is on the
 * page (review 2, 2026-10-05), never on a page it cannot explain.
 */
export function ShowMeHow({ tour }: { tour: TourId }) {
  const onPage = useSyncExternalStore(
    pageChanges,
    stepsOnPage(tour),
    notOnServer,
  );
  const startsByItself = useSyncExternalStore(
    noChanges,
    () =>
      new URLSearchParams(window.location.search).get("tour") === "1" ||
      (tour === firstVisitTour && !tourSeen(tour)),
    notOnServer,
  );
  // null until the board member presses Show me how or ends the tour.
  const [chosen, setChosen] = useState<boolean | null>(null);
  const running = (chosen ?? startsByItself) && onPage;
  if (!onPage) return null;
  return (
    <>
      <button
        type="button"
        className="button-secondary"
        onClick={() => setChosen(true)}
      >
        Show me how
      </button>
      {running ? (
        <AdminTour tour={tour} onEnd={() => setChosen(false)} />
      ) : null}
    </>
  );
}
