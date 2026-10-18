"use client";
import { useEffect, useState } from "react";
import { EVENTS, Joyride, type TooltipRenderProps } from "react-joyride";
import { rememberTourSeen } from "./seen";
import { shownElement } from "./shown";
import { firstVisitTour, tourSteps, type TourId } from "./steps";

/**
 * One tour step in the dashboard's own look: "Step N of M", the title and
 * text, then Skip tour, Back and Next (Done on the last step). react-joyride
 * moves focus to Next and keeps Tab inside the step; Escape ends the tour
 * like Skip tour (its own Escape only closes one step).
 */
function TourStep({
  backProps,
  controls,
  index,
  isLastStep,
  primaryProps,
  size,
  skipProps,
  step,
  tooltipProps,
}: TooltipRenderProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") controls.skip("button_skip");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [controls]);
  return (
    <div
      {...tooltipProps}
      className="tour-step"
      aria-labelledby="tour-step-title"
      aria-describedby="tour-step-text"
    >
      <p className="tour-step-progress">
        Step {index + 1} of {size}
      </p>
      <h2 id="tour-step-title">{step.title}</h2>
      <p id="tour-step-text">{step.content}</p>
      <div className="tour-step-buttons">
        {isLastStep ? null : (
          <button type="button" className="button-secondary" {...skipProps} />
        )}
        {index > 0 ? (
          <button type="button" className="button-secondary" {...backProps} />
        ) : null}
        <button type="button" className="button-primary" {...primaryProps} />
      </div>
    </div>
  );
}

/** Scrolling to a step jumps instead of gliding when the visitor asks for less motion. */
function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * A board page's tour (PR4 D-8..D-10), rendered only while it runs, in the
 * browser. Steps whose element is not on this page (Archive on a new item,
 * the badges of an empty People list) are left out when it starts, so
 * "Step N of M" and Done match what the board member sees. Ending the
 * dashboard tour, by Done, Skip tour or Escape, remembers it as seen in this
 * browser; the other tours never start by themselves, so nothing is kept.
 */
export default function AdminTour({
  tour,
  onEnd,
}: {
  tour: TourId;
  onEnd: () => void;
}) {
  const [steps] = useState(() =>
    tourSteps[tour].flatMap((step) => {
      const target = shownElement(String(step.target));
      return target ? [{ ...step, target }] : [];
    }),
  );
  return (
    <Joyride
      run
      continuous
      scrollToFirstStep
      steps={steps}
      tooltipComponent={TourStep}
      loaderComponent={null}
      locale={{ back: "Back", next: "Next", last: "Done", skip: "Skip tour" }}
      options={{
        skipBeacon: true,
        buttons: ["back", "primary", "skip"],
        dismissKeyAction: false,
        overlayClickAction: false,
        // A click on a highlighted card would leave the page mid-tour.
        blockTargetInteraction: true,
        scrollDuration: reducedMotion() ? 0 : 300,
        // Clears the sticky site menu above the dashboard.
        scrollOffset: 96,
        arrowColor: "var(--paper-light)",
      }}
      onEvent={(data) => {
        if (data.type !== EVENTS.TOUR_END) return;
        if (tour === firstVisitTour) rememberTourSeen(tour);
        onEnd();
      }}
    />
  );
}
