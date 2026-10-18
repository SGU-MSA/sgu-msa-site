"use client";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import { createPortal, useFormStatus } from "react-dom";
import { systemText } from "@/lib/system-text";
import { barOwner, claimBar, releaseBar, subscribeBar } from "./bar-owner";
import { SAVE_SETTLED_EVENT } from "./saved-note";

/** Tells the "Saved" toast to look, once the save has finished. */
const settled = () =>
  window.setTimeout(
    () => window.dispatchEvent(new Event(SAVE_SETTLED_EVENT)),
    0,
  );

/**
 * The form's own Save: its default button (the first submit button, the one
 * Enter uses), so the bar posts exactly what that button posts.
 */
function ownSave(form: HTMLFormElement): HTMLButtonElement | null {
  for (const element of form.elements)
    if (element instanceof HTMLButtonElement && element.type === "submit")
      return element;
  return null;
}

/**
 * Whether the form's own Save is greyed out now (a photo being made
 * smaller, a page part still loading), followed live.
 */
function useSaveBlocked(form: RefObject<HTMLFormElement | null>, on: boolean) {
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const element = form.current;
    if (!on || !element) return;
    const look = () => setBlocked(Boolean(ownSave(element)?.disabled));
    look();
    const watch = new MutationObserver(look);
    watch.observe(element, {
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled"],
    });
    return () => watch.disconnect();
  }, [form, on]);
  return blocked;
}

/**
 * A board form's save state (review fixes P1, item 2; the bar the user
 * picked on 2026-10-07, option B), inside `CheckedForm`: once anything
 * differs from what the form started with (the unsaved-changes guard's own
 * test), a thin bar along the bottom of the screen says "Unsaved changes"
 * with a Save button that saves this form as its own Save button does;
 * "Saving…" while the save runs; then the bar goes and the "Saved" toast
 * (`SavedToast`) says the rest. With several forms on one screen the bar
 * speaks for the one changed last (`bar-owner`). The page gets room at the
 * bottom while the bar shows, so it never covers anything.
 */
export function SaveStatus({
  form,
  dirty,
  edits,
  onSettled,
}: {
  form: RefObject<HTMLFormElement | null>;
  dirty: boolean;
  /** Counts the changes typed or chosen, so the form changed last owns the bar. */
  edits: number;
  /** Called when a save has finished while the form is still on screen. */
  onSettled: () => void;
}) {
  const { pending } = useFormStatus();
  const was = useRef(false);
  const onSettledRef = useRef(onSettled);
  useEffect(() => {
    onSettledRef.current = onSettled;
  });
  useEffect(() => {
    if (was.current && !pending) {
      onSettledRef.current();
      settled();
    }
    was.current = pending;
  }, [pending]);
  // A save that opens another page ends this form while it is pending.
  useEffect(
    () => () => {
      if (was.current) settled();
    },
    [],
  );

  const id = useId();
  const active = pending || dirty;
  useEffect(() => {
    if (active) claimBar(id);
    else releaseBar(id);
  }, [active, pending, edits, id]);
  useEffect(() => () => releaseBar(id), [id]);
  const owner = useSyncExternalStore(subscribeBar, barOwner, () => null);
  const shown = active && owner === id;
  const blocked = useSaveBlocked(form, shown);
  if (!shown) return null;

  const save = () => {
    const element = form.current;
    const button = element && ownSave(element);
    if (!element || button?.disabled) return;
    element.requestSubmit(button ?? undefined);
  };
  return createPortal(
    // Not a live region: "Unsaved changes" would interrupt typing, and the
    // form's own Save button says "Saving…"; "Saved" is announced by the
    // toast. A named region, so screen readers can jump to it.
    <div
      className="unsaved-bar"
      role="region"
      aria-label={systemText.fields.unsaved}
      data-state={pending ? "saving" : "unsaved"}
    >
      <p className="unsaved-bar-text">
        <span className="unsaved-bar-dot" aria-hidden="true" />
        {pending ? systemText.buttons.saving : systemText.fields.unsaved}
      </p>
      <button
        type="button"
        className="button-primary"
        disabled={pending || blocked}
        onClick={save}
      >
        {systemText.buttons.save}
      </button>
    </div>,
    document.body,
  );
}
