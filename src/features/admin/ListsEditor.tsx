"use client";
import { useActionState, useId } from "react";
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
import { OrderedList } from "./OrderedList";
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

/**
 * The name box of one option (rename) or of a new one (add): one form, the
 * dashboard's save state, the name checked as you type.
 */
function NameForm({
  list,
  id,
  version,
  name,
  label,
  submit,
}: {
  list: ListName;
  id: string;
  version: string | null;
  name: string;
  /** The box's accessible name. */
  label: string;
  submit: { label: string; pending: string };
}) {
  const [state, action, pending] = useActionState(
    saveListOptionAction,
    initialKeptForm,
  );
  const boxId = useId();
  return (
    <CheckedForm
      action={action}
      state={state}
      check={nameCheck}
      className="list-name-form"
      key={state.attempt}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="list" value={list} />
      <input type="hidden" name="version" value={version ?? ""} />
      <label htmlFor={boxId} className="sr-only">
        {label}
      </label>
      <input
        id={boxId}
        name="name"
        required
        maxLength={LIST_NAME_MAX}
        autoComplete="off"
        defaultValue={state.values?.name ?? name}
        placeholder={version ? undefined : label}
      />
      <button className="button-secondary" disabled={pending}>
        {pending ? submit.pending : submit.label}
        {/* Several on one screen: screen readers hear which option. */}
        {version ? <span className="sr-only"> {name}</span> : null}
      </button>
      <FieldError name="name" controls={[boxId]} />
    </CheckedForm>
  );
}

/** One list: its options in order (drag to reorder), each renamed in place, and Add. */
function ListSection({
  list,
  rows,
  newId,
}: {
  list: ListName;
  rows: readonly ListRow[];
  newId: string;
}) {
  const info = listInfo[list];
  return (
    <section
      id={`list-${list}`}
      className="content-card list-section"
      aria-labelledby={`list-${list}-title`}
    >
      <h2 id={`list-${list}-title`}>{info.title}</h2>
      <p className="muted">{info.hint}</p>
      {rows.length ? (
        <>
          {rows.length > 1 ? (
            <p className="muted">{systemText.order.hint}</p>
          ) : null}
          <OrderedList
            list="list_options"
            label={info.title}
            rows={rows.map((row) => ({
              id: row.id,
              version: row.version,
              name: row.name,
              content: (
                <div className="list-option">
                  <NameForm
                    key={row.version}
                    list={list}
                    id={row.id}
                    version={row.version}
                    name={row.name}
                    label={`Name of ${row.name}`}
                    submit={{
                      label: listWords.rename,
                      pending: systemText.buttons.saving,
                    }}
                  />
                  {row.usedBy ? (
                    <p className="muted list-option-used">{row.usedBy}</p>
                  ) : (
                    <ActionForm
                      action={deleteListOptionAction}
                      fields={{ id: row.id, version: row.version, list }}
                      label={listWords.delete}
                      pendingLabel={listWords.deleting}
                      itemName={row.name}
                    />
                  )}
                </div>
              ),
            }))}
          />
        </>
      ) : (
        <p className="muted">{listWords.empty}</p>
      )}
      <div className="list-add">
        <NameForm
          key={newId}
          list={list}
          id={newId}
          version={null}
          name=""
          label={listWords.newName(info.item)}
          submit={{ label: listWords.add, pending: listWords.adding }}
        />
      </div>
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
  /** A fresh id for each list's Add box. */
  newIds: Record<ListName, string>;
}) {
  return (
    <>
      {(Object.keys(lists) as ListName[]).map((list) => (
        <ListSection
          key={list}
          list={list}
          rows={lists[list]}
          newId={newIds[list]}
        />
      ))}
    </>
  );
}
