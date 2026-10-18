"use client";
import { useActionState, useId, useRef, useState, type ReactNode } from "react";
import { systemText } from "@/lib/system-text";
import type { EditorState } from "../actions";
import { initialEditorState } from "../fields";
import { FormMessages } from "../FormMessages";

type FormAction = (state: EditorState, form: FormData) => Promise<EditorState>;

const words = systemText.history;

/**
 * Restore on a History entry (review 3 D): the button opens a confirmation
 * that says what comes back and what is replaced (`message`, built on the
 * server from `systemText.history.confirm`), shows that version (`preview`,
 * drawn only while the confirmation is open), and offers Restore / Cancel.
 * Restore posts the hidden `fields`; the server action checks everything
 * again. A refusal shows in the confirmation, which stays open. A version
 * that cannot come back (`refused`, checked as the restore checks it) shows
 * only that refusal and Cancel.
 */
export function RestoreVersion({
  action,
  fields,
  message,
  itemName,
  preview,
  refused,
}: {
  action: FormAction;
  fields: Record<string, string>;
  message: string;
  /** Read after the button's name, so each Restore on the list names its change. */
  itemName: string;
  preview?: ReactNode;
  /** Why this version cannot be restored: no preview and no Restore button. */
  refused?: string;
}) {
  const [state, submit, pending] = useActionState(action, initialEditorState);
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <button
        type="button"
        className="button-secondary"
        onClick={() => {
          setOpen(true);
          dialog.current?.showModal();
        }}
      >
        {words.restore}
        <span className="sr-only"> {itemName}</span>
      </button>
      <dialog
        ref={dialog}
        className="leave-dialog restore-dialog"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-text`}
        onClose={() => setOpen(false)}
      >
        <h2 id={`${id}-title`}>{words.confirmTitle}</h2>
        {refused ? (
          <p id={`${id}-text`} className="form-error">
            {refused}
          </p>
        ) : (
          <>
            <p id={`${id}-text`}>{message}</p>
            <div
              className="editor-preview restore-preview"
              role="region"
              aria-labelledby={`${id}-preview`}
              // Nothing inside can take focus (inert), so the region itself can, to scroll.
              tabIndex={0}
            >
              <p id={`${id}-preview`} className="editor-preview-label">
                {words.preview}
              </p>
              <div inert className="editor-preview-body">
                {open ? preview : null}
              </div>
            </div>
          </>
        )}
        <form action={submit}>
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <FormMessages error={state.error} notice={state.notice} />
          <div className="admin-actions">
            {refused ? null : (
              <button className="button-primary" disabled={pending}>
                {pending
                  ? systemText.buttons.restoring
                  : systemText.buttons.restore}
              </button>
            )}
            <button
              type="button"
              className="button-secondary"
              autoFocus
              onClick={() => dialog.current?.close()}
            >
              {words.cancel}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
