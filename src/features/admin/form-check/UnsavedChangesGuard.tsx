"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { dirtyForms, leaveAfterSave, takeLeaveAfterSave } from "./unsaved";

/** The dialog's words (review 2, 2026-10-05; the release checklist lists them to approve). */
export const leaveWords = {
  title: "Leave without saving?",
  text: "Your changes on this page are not saved yet.",
  save: "Save",
  discard: "Discard",
  stay: "Keep editing",
} as const;

/** A same-site page a click leaves this one for, or null. */
function leavingFor(event: MouseEvent): string | null {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return null;
  const link =
    event.target instanceof Element
      ? event.target.closest<HTMLAnchorElement>("a[href]")
      : null;
  if (!link || link.hasAttribute("download")) return null;
  if (link.target && link.target !== "_self") return null;
  const to = new URL(link.href, window.location.href);
  if (to.origin !== window.location.origin) return null;
  const here = window.location;
  // A link to a place on this same page leaves nothing.
  if (to.pathname === here.pathname && to.search === here.search) return null;
  return to.pathname + to.search + to.hash;
}

/**
 * The unsaved-changes guard of the dashboard (review 2, 2026-10-05;
 * `.plans/review2-plan.md` PR-A 4), once in the admin layout. While a board
 * form has changes (`CheckedForm`): closing or reloading the tab gets the
 * browser's own warning, and a click on a dashboard link opens Save /
 * Discard / Keep editing. Save is refused while a box is red (the form shows
 * why); after a successful save the clicked page opens.
 */
export function UnsavedChangesGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const dialog = useRef<HTMLDialogElement>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [canSave, setCanSave] = useState(true);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyForms().length) return;
      event.preventDefault();
      // Older browsers need a value to ask.
      event.returnValue = "";
    };
    const onClick = (event: MouseEvent) => {
      const href = leavingFor(event);
      if (!href) return;
      const dirty = dirtyForms();
      if (!dirty.length) return;
      // Before Next's link handler (on the app root) sees the click.
      event.preventDefault();
      event.stopPropagation();
      setTarget(href);
      // Save is offered for one changed form; with two, each has its own Save.
      setCanSave(dirty.length === 1);
      dialog.current?.showModal();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  // A save started from the dialog has landed on its own next page: go on.
  useEffect(() => {
    const href = takeLeaveAfterSave();
    if (href) router.push(href);
  }, [pathname, search, router]);

  const close = () => dialog.current?.close();
  const save = () => {
    const [form] = dirtyForms();
    close();
    if (form && target && form.save()) leaveAfterSave(target);
  };
  const discard = () => {
    close();
    if (target) router.push(target);
  };

  return (
    <dialog
      ref={dialog}
      className="leave-dialog"
      aria-labelledby="leave-dialog-title"
      aria-describedby="leave-dialog-text"
      onClose={() => setTarget(null)}
    >
      <h2 id="leave-dialog-title">{leaveWords.title}</h2>
      <p id="leave-dialog-text">{leaveWords.text}</p>
      <div className="admin-actions">
        {canSave ? (
          <button type="button" className="button-primary" onClick={save}>
            {leaveWords.save}
          </button>
        ) : null}
        <button type="button" className="button-secondary" onClick={discard}>
          {leaveWords.discard}
        </button>
        <button
          type="button"
          className="button-secondary"
          autoFocus
          onClick={close}
        >
          {leaveWords.stay}
        </button>
      </div>
    </dialog>
  );
}
