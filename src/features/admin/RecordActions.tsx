"use client";
import { useActionState, type ReactNode } from "react";
import { removeFileAction, type EditorState } from "@/features/admin/actions";
import { initialEditorState } from "./fields";
import { FormMessages } from "./FormMessages";

/** A board form's server action; a kept-values action (`KeptFormState`) works too. */
export type FormAction<S extends EditorState = EditorState> = (
  state: S,
  form: FormData,
) => Promise<S>;

/**
 * A one-button board form (archive, restore, duplicate, permanent delete,
 * remove photo): hidden fields naming the item and the version on screen,
 * an optional typed DELETE, and the server's answer. The server action checks
 * everything again; a disabled button is only a mirror.
 */
export function ActionForm<S extends EditorState = EditorState>({
  action,
  initial = initialEditorState as S,
  fields,
  label,
  pendingLabel,
  itemName,
  confirmDelete = false,
  disabled = false,
  primary = false,
  children,
}: {
  action: FormAction<S>;
  /** The action's first state, when it is not the plain `EditorState`. */
  initial?: S;
  fields: Record<string, string>;
  label: string;
  pendingLabel: string;
  /** Read after the label by screen readers, when several such buttons share a page. */
  itemName?: string;
  /** Ask for DELETE typed in a box first (permanent delete). */
  confirmDelete?: boolean;
  disabled?: boolean;
  primary?: boolean;
  children?: ReactNode;
}) {
  const [state, submit, pending] = useActionState<S, FormData>(
    action,
    initial as Awaited<S>,
  );
  return (
    <form action={submit} className="editor-form">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
      {confirmDelete ? (
        <label>
          Type DELETE to confirm
          <input
            name="confirmation"
            required
            pattern="DELETE"
            autoComplete="off"
          />
        </label>
      ) : null}
      <FormMessages error={state.error} notice={state.notice} />
      <button
        className={primary ? "button-primary" : "button-secondary"}
        disabled={pending || disabled}
      >
        {pending ? pendingLabel : label}
        {itemName ? <span className="sr-only"> {itemName}</span> : null}
      </button>
    </form>
  );
}

/**
 * Shown when a file could not be deleted after a permanent delete or a photo
 * removal. Nothing uses it any more and it is not public; any admin may try
 * again (D-23).
 */
export function FileCleanup({ files }: { files: readonly string[] }) {
  if (!files.length) return null;
  return (
    <section className="content-card" aria-labelledby="file-cleanup">
      <h2 id="file-cleanup">A file is left over</h2>
      <p>
        The change is saved, but its stored file could not be deleted yet.
        Nothing uses the file and visitors cannot see it. Try Remove again.
      </p>
      {files.map((name, index) => (
        <ActionForm
          key={name}
          action={removeFileAction}
          fields={{ name }}
          label="Remove"
          pendingLabel="Removing…"
          itemName={files.length > 1 ? `file ${index + 1}` : undefined}
        />
      ))}
    </section>
  );
}
