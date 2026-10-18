"use client";
import { useActionState } from "react";
import { systemText } from "@/lib/system-text";
import { CheckedForm } from "../form-check/CheckedForm";
import { FieldError } from "../form-check/FieldError";
import { OrderedList } from "../OrderedList";
import { ArchiveActions, ArchivedRow } from "../ArchiveActions";
import { initialKeptForm, typedValues } from "../form-state";
import { problemsIn, stepFromForm } from "./handover-forms";
import {
  archiveHandoverStepAction,
  restoreHandoverStepAction,
  saveHandoverStepAction,
} from "./handover-actions";
import type { ChecklistStep } from "./StepChecklist";
import { stepPages } from "./pages";

/** A step's own rules, as you type. */
const checkStep = problemsIn((values) => stepFromForm(values, 0, ""));

/** The page a step links to: one of `stepPages`, or none (never typed). */
function PageChoice({ value }: { value: string }) {
  // A link saved before (or by the site owner) stays choosable.
  const known = stepPages.some(([href]) => href === value);
  return (
    <label>
      Dashboard page (optional)
      <select name="link" defaultValue={value}>
        <option value="">No link</option>
        {stepPages.map(([href, label]) => (
          <option key={href} value={href}>
            {label}
          </option>
        ))}
        {value && !known ? <option value={value}>{value}</option> : null}
      </select>
      <FieldError name="link" />
    </label>
  );
}

/**
 * The words of one step: a new one ("Add a step") or a current one. Its tick
 * and order number are kept as they are.
 */
function StepForm({
  step,
  submitLabel,
}: {
  step: ChecklistStep | { id: string; version: null };
  submitLabel: string;
}) {
  const [state, action, pending] = useActionState(
    saveHandoverStepAction,
    initialKeptForm,
  );
  const saved = "title" in step ? step : null;
  const values: Partial<Record<string, string>> = state.values ?? {
    title: saved?.title,
    details: saved?.details,
    link: saved?.link ?? "",
  };
  return (
    <CheckedForm
      action={action}
      state={state}
      // The order number and the tick are the server's (0 and "" here).
      check={(form) => checkStep(typedValues(new FormData(form)))}
      className="editor-form"
      key={state.attempt}
    >
      <input type="hidden" name="from" value="steps" />
      <input type="hidden" name="id" value={step.id} />
      <input type="hidden" name="version" value={step.version ?? ""} />
      {saved ? (
        <>
          <input type="hidden" name="done_on" value={saved.done_on} />
          {saved.done_on ? (
            <input type="hidden" name="done" value="on" />
          ) : null}
        </>
      ) : null}
      <label>
        Step
        <input
          name="title"
          required
          maxLength={120}
          autoComplete="off"
          placeholder="Hand over the Musallah key"
          defaultValue={values.title}
        />
        <FieldError name="title" />
      </label>
      <label>
        Details (optional)
        <textarea
          name="details"
          rows={2}
          maxLength={500}
          placeholder="Who has it now, and who gets it next."
          defaultValue={values.details}
        />
        <FieldError name="details" />
        <span className="muted">Never write passwords or codes here.</span>
      </label>
      <PageChoice value={values.link ?? ""} />
      <button className="button-primary" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </button>
    </CheckedForm>
  );
}

/** Archive: one current step's other control. */
function ArchiveStep({ step }: { step: ChecklistStep }) {
  return (
    <ArchiveActions
      archived={false}
      layout="row"
      itemName={step.title}
      fields={{ id: step.id, version: step.version }}
      archive={{
        action: archiveHandoverStepAction,
        summary: "Archive this step",
        label: "Archive step",
        explain:
          "It leaves the checklist. You can restore it later under Archived steps.",
      }}
      restore={{ action: restoreHandoverStepAction }}
    />
  );
}

/**
 * "Edit the steps" (PR5a D-5): add, reword, reorder by dragging (review
 * fixes PR-2), archive and restore the hand-over steps. Any board member; every change is
 * in Recent changes.
 */
export function StepsEditor({
  steps,
  archived,
  newId,
}: {
  steps: readonly ChecklistStep[];
  archived: readonly ChecklistStep[];
  newId: string;
}) {
  return (
    <>
      {steps.length ? (
        <>
          <p className="muted">{systemText.order.hint}</p>
          <OrderedList
            list="handover_steps"
            label="Hand-over steps"
            look="cards"
            rows={steps.map((step) => ({
              id: step.id,
              version: step.version,
              name: step.title,
              content: (
                <section aria-labelledby={`step-${step.id}`}>
                  <h2 id={`step-${step.id}`} className="order-card-title">
                    {step.title}
                  </h2>
                  <StepForm key={step.version} step={step} submitLabel="Save" />
                  <ArchiveStep step={step} />
                </section>
              ),
            }))}
          />
        </>
      ) : (
        <p className="content-card">No steps yet. Add the first one.</p>
      )}
      <section className="content-card" aria-labelledby="add-step">
        <h2 id="add-step">Add a step</h2>
        <StepForm step={{ id: newId, version: null }} submitLabel="Add step" />
      </section>
      {archived.length ? (
        <section className="admin-group" aria-labelledby="archived-steps">
          <h2 id="archived-steps">Archived steps</h2>
          <p className="muted">
            Archived steps are not on the checklist and cannot be edited.
            Restore one to use it again; it comes back at its old place.
          </p>
          <ul className="admin-list">
            {archived.map((step) => (
              <ArchivedRow
                key={step.id}
                name={step.title}
                heading="h3"
                fields={{ id: step.id, version: step.version }}
                restore={{ action: restoreHandoverStepAction }}
              >
                {step.details ? <p className="muted">{step.details}</p> : null}
              </ArchivedRow>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
