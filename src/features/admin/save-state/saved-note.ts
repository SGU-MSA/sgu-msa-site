import { systemText } from "@/lib/system-text";

/**
 * The "Saved" toast after a save that opens another page (review fixes P1,
 * item 2): the save sets this short-lived cookie (`redirectSaved`) instead
 * of `?saved=1` in the address, and `SavedToast` shows it once and clears
 * it. Browser-safe.
 */
export const SAVED_COOKIE = "admin-saved";

/** What the toast says, by the cookie's value. */
export const savedNotes = {
  saved: systemText.fields.saved,
  /** People: the person who held the chosen role moved to the General board. */
  moved: "Saved. The person who held that role is now in the General board.",
  /** A new password: the other devices were signed out. */
  password:
    "Your password is saved. You were signed out on your other devices.",
} as const;

export type SavedNote = keyof typeof savedNotes;

/** The toast's words for a cookie value; null for anything else. */
export function savedNoteText(value: string | undefined): string | null {
  return value && Object.hasOwn(savedNotes, value)
    ? savedNotes[value as SavedNote]
    : null;
}

/** The event a board form sends when its save has finished, either way. */
export const SAVE_SETTLED_EVENT = "admin:save-settled";

/** The event that shows the toast with given words (`showSaved`). */
export const SAVED_SHOW_EVENT = "admin:saved-show";

/**
 * Shows the "Saved" toast from a save that stays on its page without a
 * `CheckedForm`, such as "Save order" under a list dragged into order.
 */
export function showSaved(text: string) {
  window.dispatchEvent(
    new CustomEvent<string>(SAVED_SHOW_EVENT, { detail: text }),
  );
}
