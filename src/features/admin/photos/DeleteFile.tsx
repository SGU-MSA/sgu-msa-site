"use client";
import { useActionState, useId, useRef } from "react";
import { systemText } from "@/lib/system-text";
import { initialEditorState } from "../fields";
import { FormMessages } from "../FormMessages";
import { deleteFileAction } from "./photo-actions";

const words = systemText.photos;

/**
 * Delete on a file nothing uses (photo library, 2026-10-06): asks first,
 * because a deleted file cannot come back. The server checks again that
 * nothing uses it; a refusal shows in the box, which stays open.
 */
export function DeleteFile({
  name,
  itemName,
}: {
  name: string;
  /** Read after the button's name, so each Delete on the screen names its file. */
  itemName: string;
}) {
  const [state, submit, pending] = useActionState(
    deleteFileAction,
    initialEditorState,
  );
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  return (
    <>
      <button
        type="button"
        className="button-secondary"
        onClick={() => dialog.current?.showModal()}
      >
        {words.delete}
        <span className="sr-only"> {itemName}</span>
      </button>
      <dialog
        ref={dialog}
        className="leave-dialog"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-text`}
      >
        <h2 id={`${id}-title`}>{words.deleteTitle}</h2>
        <p id={`${id}-text`}>{words.deleteText}</p>
        <form action={submit}>
          <input type="hidden" name="name" value={name} />
          <FormMessages error={state.error} notice={state.notice} />
          <div className="admin-actions">
            <button className="button-primary" disabled={pending}>
              {pending ? words.deleting : words.delete}
            </button>
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
