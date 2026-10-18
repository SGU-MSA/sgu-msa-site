/**
 * The board forms open on this page, for the unsaved-changes guard (review
 * 2, 2026-10-05): each `CheckedForm` registers itself while mounted. Plain
 * module state: there is one dashboard page at a time in a browser tab.
 */
export type GuardedForm = {
  /** Anything typed or chosen differs from what the form started with. */
  dirty: () => boolean;
  /**
   * Saves the form as its Save button would. False when a box is red (the
   * form then shows its problems and nothing is posted).
   */
  save: () => boolean;
};

const forms = new Set<GuardedForm>();
let afterSave: string | null = null;

/** Registers a form; the returned function removes it. */
export function guardForm(form: GuardedForm): () => void {
  forms.add(form);
  return () => {
    forms.delete(form);
  };
}

/** The registered forms with unsaved changes. */
export function dirtyForms(): GuardedForm[] {
  return [...forms].filter((form) => form.dirty());
}

/** Where to go once the save started from the leave dialog has finished. */
export function leaveAfterSave(href: string) {
  afterSave = href;
}

/** The page to open after a successful save, once (null when none). */
export function takeLeaveAfterSave(): string | null {
  const href = afterSave;
  afterSave = null;
  return href;
}

/** A refused save stays on the page: forget where it was going. */
export function cancelLeaveAfterSave() {
  afterSave = null;
}
