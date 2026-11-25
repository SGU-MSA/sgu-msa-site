"use client";
import { useActionState, type ReactNode } from "react";
import {
  LIST_NAME_MAX,
  listInfo,
  listWords,
  typedListName,
  type ListName,
} from "@/lib/community/lists";
import { systemText } from "@/lib/system-text";
import { CheckedForm } from "./form-check/CheckedForm";
import { FieldError } from "./form-check/FieldError";
import { noProblems } from "./form-check/problems";
import { initialKeptForm, typedValues } from "./form-state";
import { deleteListOptionAction, saveListOptionAction } from "./list-actions";
import {
  CancelButton,
  OpenInPlaceList,
  rowKey,
  useOneOpen,
  type OneOpen,
} from "./OpenInPlace";
import { ActionForm } from "./RecordActions";

/** One option as the Lists screen shows it. */
export type ListRow = {
  id: string;
  name: string;
  /** The option's `updated_at`. */
  version: string;
  /** "Used by 3 events. Move them first.", or null when nothing uses it. */
  usedBy: string | null;
};

/** The typed name's problem, as the save would say it. */
function nameCheck(form: HTMLFormElement) {
  const parsed = typedListName(typedValues(new FormData(form)).name);
  return parsed.success ? noProblems : { name: parsed.error.issues[0].message };
}

/** A row's one line: what uses the option (the "Move them first" advice is for its page). */
export const usedLine = (row: ListRow) =>
  row.usedBy ? row.usedBy.split(".")[0] : "Not used yet";

/**
 * The name of one option (rename) or of a new one (add): one form, the
 * dashboard's save state, the name checked as you type.
 */
export function NameForm({
  list,
  id,
  version,
  name,
  submitLabel,
  actions,
}: {
  list: ListName;
  id: string;
  version: string | null;
  name: string;
  submitLabel: string;
  /** Buttons beside Save (Cancel). */
  actions?: ReactNode;
}) {
  const [state, action, pending] = useActionState(
    saveListOptionAction,
    initialKeptForm,
  );
  return (
    <CheckedForm
      action={action}
      state={state}
      check={nameCheck}
      className="editor-form"
      key={state.attempt}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="list" value={list} />
      <input type="hidden" name="version" value={version ?? ""} />
      <label>
        Name
        <input
          name="name"
          required
          maxLength={LIST_NAME_MAX}
          autoComplete="off"
          defaultValue={state.values?.name ?? name}
        />
        <FieldError name="name" />
      </label>
      <div className="admin-actions">
        <button className="button-primary" disabled={pending}>
          {pending ? systemText.buttons.saving : submitLabel}
        </button>
        {actions}
      </div>
    </CheckedForm>
  );
}

/** One list: its options in order (drag to reorder), each opened in place. */
function ListSection({
  list,
  rows,
  newId,
  ctl,
}: {
  list: ListName;
  rows: readonly ListRow[];
  newId: string;
  ctl: OneOpen;
}) {
  const info = listInfo[list];
  return (
    <section
      id={`list-${list}`}
      className="content-card list-section"
      aria-labelledby={`list-${list}-title`}
    >
      <OpenInPlaceList
        ctl={ctl}
        idPrefix={list}
        heading={<h2 id={`list-${list}-title`}>{info.title}</h2>}
        list="list_options"
        label={info.title}
        addLabel={`Add a ${info.item}`}
        addKey={rowKey(newId, null)}
        addForm={
          <NameForm
            list={list}
            id={newId}
            version={null}
            name=""
            submitLabel={listWords.add}
            actions={<CancelButton ctl={ctl} />}
          />
        }
        rows={rows.map((row) => ({
          id: row.id,
          version: row.version,
          name: row.name,
          summary: usedLine(row),
          form: (
            <NameForm
              list={list}
              id={row.id}
              version={row.version}
              name={row.name}
              submitLabel="Save"
              actions={<CancelButton ctl={ctl} />}
            />
          ),
          below: row.usedBy ? (
            <p className="muted">{row.usedBy}</p>
          ) : (
            <ActionForm
              action={deleteListOptionAction}
              fields={{ id: row.id, version: row.version, list }}
              label={listWords.delete}
              pendingLabel={listWords.deleting}
              itemName={row.name}
            />
          ),
        }))}
      />
      <p className="muted">
        {info.hint}{" "}
        {rows.length === 1 ? "1 option." : `${rows.length} options.`}
      </p>
      {rows.length > 1 ? (
        <p className="muted">{systemText.order.hint}</p>
      ) : null}
    </section>
  );
}

/**
 * Lists (review fixes P3; any board member): the event categories, the
 * terms and the resource categories. Add, rename, drag to order; Delete only
 * for an option nothing uses, else what uses it.
 */
export function ListsEditor({
  lists,
  newIds,
}: {
  lists: Record<ListName, ListRow[]>;
  /** A fresh id for each list's Add. */
  newIds: Record<ListName, string>;
}) {
  const names = Object.keys(lists) as ListName[];
  // One item open on the whole screen.
  const ctl = useOneOpen(
    names.flatMap((list) => [
      rowKey(newIds[list], null),
      ...lists[list].map((row) => rowKey(row.id, row.version)),
    ]),
  );
  return (
    <>
      {names.map((list) => (
        <ListSection
          key={list}
          list={list}
          rows={lists[list]}
          newId={newIds[list]}
          ctl={ctl}
        />
      ))}
    </>
  );
}
