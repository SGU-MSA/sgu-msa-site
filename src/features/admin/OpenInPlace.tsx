"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { OrderedList as OrderedTable } from "@/lib/community/order";
import { leaveWords } from "./form-check/UnsavedChangesGuard";
import { dirtyForms } from "./form-check/unsaved";
import { ItemRow, ListTop } from "./ItemRows";
import { OrderedList } from "./OrderedList";
import s from "./ItemRows.module.css";

/** A row's key: its id and version, so a save (a new version) closes it. */
export const rowKey = (id: string, version: string | null) =>
  `${id}@${version ?? "new"}`;

type Open = { key: string; returnTo: string } | null;

/**
 * Which one item of a screen is open. Opening another asks first when the
 * open one has unsaved changes (the dashboard's own check, `dirtyForms`).
 * An item closes by itself once it is saved (its key changes).
 */
export function useOneOpen(validKeys: readonly string[]) {
  const [open, setOpen] = useState<Open>(null);
  const [next, setNext] = useState<Open>(null);
  const focusBack = useRef<string | null>(null);
  // A saved item's key is gone: it closes, and the one waiting opens.
  if (open && !validKeys.includes(open.key)) {
    setOpen(next && validKeys.includes(next.key) ? next : null);
    setNext(null);
  }
  useEffect(() => {
    if (open) return;
    const id = focusBack.current;
    focusBack.current = null;
    if (id) document.getElementById(id)?.focus();
  }, [open]);
  return {
    open: open?.key ?? null,
    asking: next !== null,
    request(key: string, returnTo: string) {
      if (open?.key === key) return;
      if (open && dirtyForms().length) setNext({ key, returnTo });
      else {
        focusBack.current = null;
        setOpen({ key, returnTo });
      }
    },
    close() {
      focusBack.current = open?.returnTo ?? null;
      setOpen(null);
      setNext(null);
    },
    keep() {
      setNext(null);
    },
    discard() {
      setOpen(next);
      setNext(null);
    },
    save() {
      const [form] = dirtyForms();
      form?.save();
    },
  };
}
export type OneOpen = ReturnType<typeof useOneOpen>;

export type OpenRowData = {
  id: string;
  version: string;
  name: string;
  summary: string;
  /** The item's form (given a Cancel beside its Save). */
  form: ReactNode;
  /** Under the form (Archive, Delete). */
  below?: ReactNode;
};

/** Cancel, for beside a form's Save. */
export function CancelButton({ ctl }: { ctl: OneOpen }) {
  return (
    <button type="button" className="button-secondary" onClick={ctl.close}>
      Cancel
    </button>
  );
}

/** Leave without saving? Save / Discard / Keep editing. */
function Ask({ ctl }: { ctl: OneOpen }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector("button")?.focus();
  }, []);
  return (
    <div
      ref={ref}
      role="alertdialog"
      aria-label={leaveWords.title}
      className={s.ask}
    >
      <strong>{leaveWords.title}</strong>
      <p>{leaveWords.text}</p>
      <div>
        <button type="button" className="button-primary" onClick={ctl.save}>
          {leaveWords.save}
        </button>
        <button
          type="button"
          className="button-secondary"
          onClick={ctl.discard}
        >
          {leaveWords.discard}
        </button>
        <button type="button" className="button-secondary" onClick={ctl.keep}>
          {leaveWords.stay}
        </button>
      </div>
    </div>
  );
}

/** An open item: a title, its form, and the leave question when asked. */
function Panel({
  title,
  ctl,
  children,
  className,
}: {
  title: string;
  ctl: OneOpen;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Opening puts the cursor in the first box.
  useEffect(() => {
    ref.current
      ?.querySelector<HTMLElement>("input:not([type=hidden]),textarea,select")
      ?.focus();
  }, []);
  return (
    <div ref={ref} className={className ?? s.panel}>
      <h3 className={s.panelTitle}>{title}</h3>
      {children}
      {ctl.asking ? <Ask ctl={ctl} /> : null}
    </div>
  );
}

/**
 * A board list whose items are read-only rows. Tap a row (or Edit) and it
 * opens in place; only one is open at a time. "Add" opens an empty one at
 * the top. Dragging and "Save order" stay as they were.
 */
export function OpenInPlaceList({
  ctl,
  idPrefix,
  list,
  label,
  heading,
  addLabel,
  addKey,
  addForm,
  rows,
}: {
  ctl: OneOpen;
  /** Makes the Edit and Add buttons' ids unique on the screen. */
  idPrefix: string;
  list: OrderedTable;
  label: string;
  heading?: ReactNode;
  addLabel: string;
  addKey: string;
  addForm: ReactNode;
  rows: readonly OpenRowData[];
}) {
  const addId = `${idPrefix}-add`;
  return (
    <>
      <ListTop heading={heading}>
        <button
          type="button"
          id={addId}
          className="button-primary"
          aria-expanded={ctl.open === addKey}
          onClick={() => ctl.request(addKey, addId)}
        >
          {addLabel}
        </button>
      </ListTop>
      {ctl.open === addKey ? (
        <Panel title={addLabel} ctl={ctl} className={s.addPanel}>
          {addForm}
        </Panel>
      ) : null}
      <OrderedList
        list={list}
        label={label}
        look="rows"
        rows={rows.map((row) => {
          const key = rowKey(row.id, row.version);
          const buttonId = `${idPrefix}-edit-${row.id}`;
          return {
            id: row.id,
            version: row.version,
            name: row.name,
            content:
              ctl.open === key ? (
                <Panel title={`Editing ${row.name}`} ctl={ctl}>
                  {row.form}
                  {row.below}
                </Panel>
              ) : (
                // A tap on the row opens it too; the button is the keyboard's way in.
                <div
                  className={s.tap}
                  onClick={() => ctl.request(key, buttonId)}
                >
                  <ItemRow
                    title={row.name}
                    summary={row.summary}
                    action={
                      <button
                        type="button"
                        id={buttonId}
                        className="button-secondary"
                        aria-expanded={false}
                        onClick={(event) => {
                          event.stopPropagation();
                          ctl.request(key, buttonId);
                        }}
                      >
                        Edit<span className="sr-only"> {row.name}</span>
                      </button>
                    }
                  />
                </div>
              ),
          };
        })}
      />
    </>
  );
}
