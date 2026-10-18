"use client";
import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { shortDateLabel } from "@/lib/time/date-label";
import { FormMessages } from "../FormMessages";
import { initialKeptForm, type KeptFormState } from "../form-state";
import { saveHandoverStepAction } from "./handover-actions";
import { stepLinkLabel } from "./pages";

/** A current hand-over step as the checklist shows it. */
export type ChecklistStep = {
  id: string;
  title: string;
  details: string;
  link: string;
  position: number;
  /** The day it was ticked this term; "" while not done. */
  done_on: string;
  /** The step's `updated_at`. */
  version: string;
};

/**
 * One step with its tick box (mockup `handover`). Ticking saves at once and
 * focus stays on the box; the refreshed page adds "Done on". A refused save
 * puts the box back as it was and says why.
 */
function StepTick({ step }: { step: ChecklistStep }) {
  const saved = Boolean(step.done_on);
  // The box follows the saved tick when the page refreshes (a save, or
  // "Start a new term"), and the board member's click in between.
  const [ticked, setTicked] = useState(saved);
  const [shownSaved, setShownSaved] = useState(saved);
  if (saved !== shownSaved) {
    setShownSaved(saved);
    setTicked(saved);
  }
  const [state, action, pending] = useActionState(
    async (previous: KeptFormState, form: FormData) => {
      const answer = await saveHandoverStepAction(previous, form);
      if (answer.error || answer.fields) setTicked(form.get("done") !== "on");
      return answer;
    },
    initialKeptForm,
  );
  const link = stepLinkLabel(step.link);
  const titleId = `step-${step.id}`;
  return (
    <li className="handover-step">
      {/* Sent from onSubmit, not `action`: React resets a form after its
          action, which would undo the tick on screen. */}
      <form
        className="handover-tick"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          startTransition(() => action(form));
        }}
      >
        <input type="hidden" name="from" value="checklist" />
        <input type="hidden" name="id" value={step.id} />
        <input type="hidden" name="version" value={step.version} />
        <input type="hidden" name="title" value={step.title} />
        <input type="hidden" name="details" value={step.details} />
        <input type="hidden" name="link" value={step.link} />
        <input type="hidden" name="done_on" value={step.done_on} />
        <label className="check-label">
          <input
            type="checkbox"
            name="done"
            checked={ticked}
            // Not disabled while saving: that would move focus away.
            aria-busy={pending}
            aria-describedby={step.details ? `${titleId}-details` : undefined}
            onChange={(event) => {
              // One save at a time; the box stays as it is meanwhile.
              if (pending) return;
              setTicked(event.currentTarget.checked);
              event.currentTarget.form?.requestSubmit();
            }}
          />
          <span className="handover-step-title" id={titleId}>
            {step.title}
          </span>
        </label>
        {step.done_on ? (
          <p className="handover-done">
            Done{" "}
            <time dateTime={step.done_on}>{shortDateLabel(step.done_on)}</time>
          </p>
        ) : null}
      </form>
      {step.details || link ? (
        <p className="muted handover-details" id={`${titleId}-details`}>
          {step.details}
          {step.details && link ? " " : null}
          {link ? (
            <Link className="text-link" href={step.link}>
              {link}
            </Link>
          ) : null}
        </p>
      ) : null}
      <FormMessages error={state.error} fields={state.fields} notice={null} />
    </li>
  );
}

/** The hand-over steps to tick this term, in order. */
export function StepChecklist({ steps }: { steps: readonly ChecklistStep[] }) {
  return (
    <ol className="handover-steps" data-tour="handover-steps">
      {steps.map((step) => (
        <StepTick key={step.id} step={step} />
      ))}
    </ol>
  );
}
