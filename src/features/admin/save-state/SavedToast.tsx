"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  SAVE_SETTLED_EVENT,
  SAVED_COOKIE,
  SAVED_SHOW_EVENT,
  savedNoteText,
} from "./saved-note";

/** How long "Saved" stays before it fades (review: "a few seconds"). */
const SHOWN_MS = 4000;

/** Reads the save's mark, once: the cookie is cleared as it is read. */
function takeSavedNote(): string | null {
  const entry = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${SAVED_COOKIE}=`));
  if (!entry) return null;
  document.cookie = `${SAVED_COOKIE}=; Max-Age=0; path=/admin; SameSite=Lax`;
  return savedNoteText(
    decodeURIComponent(entry.slice(SAVED_COOKIE.length + 1)),
  );
}

/**
 * The one "Saved" toast of the dashboard (review fixes P1, item 2), once in
 * the admin layout: after a save it shows "Saved" at the bottom of the
 * screen for a few seconds, then fades (no fade with reduced motion).
 * Screen readers hear it politely. It looks for the save's mark
 * (`redirectSaved`) whenever the page changes and whenever a board form's
 * save finishes (a save may reopen the same page), and shows the words a
 * save that stays on its page sends (`showSaved`).
 */
export function SavedToast() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [toast, setToast] = useState<{ text: string; key: number } | null>(
    null,
  );
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback((text: string) => {
    window.clearTimeout(timer.current);
    setToast({ text, key: Date.now() });
    timer.current = window.setTimeout(() => setToast(null), SHOWN_MS);
  }, []);

  const look = useCallback(() => {
    const text = takeSavedNote();
    if (text) show(text);
  }, [show]);

  // A new page: look once it is drawn.
  useEffect(() => {
    const later = window.setTimeout(look, 0);
    return () => window.clearTimeout(later);
  }, [pathname, search, look]);

  useEffect(() => {
    const shown = (event: Event) => {
      if (event instanceof CustomEvent && typeof event.detail === "string")
        show(event.detail);
    };
    window.addEventListener(SAVE_SETTLED_EVENT, look);
    window.addEventListener(SAVED_SHOW_EVENT, shown);
    return () => {
      window.removeEventListener(SAVE_SETTLED_EVENT, look);
      window.removeEventListener(SAVED_SHOW_EVENT, shown);
      window.clearTimeout(timer.current);
    };
  }, [look, show]);

  // Always on the page, so the live region is heard when the words arrive.
  return (
    <div className="saved-toast-region" aria-live="polite" aria-atomic="true">
      {toast ? (
        <p key={toast.key} className="saved-toast">
          <span className="saved-toast-mark" aria-hidden="true">
            ✓
          </span>
          {toast.text}
        </p>
      ) : null}
    </div>
  );
}
