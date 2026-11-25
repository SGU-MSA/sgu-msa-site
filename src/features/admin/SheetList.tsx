"use client";
import { X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { OrderedList as OrderedTable } from "@/lib/community/order";
import { ItemRow, ListTop } from "./ItemRows";
import { OrderedList } from "./OrderedList";
import s from "./ItemRows.module.css";

/** A row's key: its id and version, so a save (a new version) closes it. */
export const rowKey = (id: string, version: string | null) =>
  `${id}@${version ?? "new"}`;

export type SheetRow = {
  id: string;
  version: string;
  name: string;
  summary: string;
  /** The item's form, with its one Save. */
  form: ReactNode;
  /** Under the form (Archive, Delete). */
  below?: ReactNode;
};

/**
 * A board list whose items are read-only rows. Tapping Edit (or Add) opens
 * the item's form in a bottom sheet on a phone and a centred dialog on a
 * computer (a native `<dialog>`: Escape closes it, focus stays inside, and
 * returns to the row). A saved item closes it. Dragging and "Save order"
 * stay on the rows.
 */
export function SheetList({
  idPrefix,
  list,
  label,
  heading,
  addLabel,
  addKey,
  addForm,
  rows,
}: {
  /** Makes the Edit and Add buttons' ids unique on the screen. */
  idPrefix: string;
  list: OrderedTable;
  label: string;
  heading?: ReactNode;
  addLabel: string;
  addKey: string;
  addForm: ReactNode;
  rows: readonly SheetRow[];
}) {
  const [open, setOpen] = useState<string | null>(null);
  const returnTo = useRef<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = `${idPrefix}-sheet-title`;
  const addId = `${idPrefix}-add`;
  const keys = [addKey, ...rows.map((row) => rowKey(row.id, row.version))];
  // A saved item's key is gone: its sheet closes.
  if (open && !keys.includes(open)) setOpen(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      element.showModal();
      element
        .querySelector<HTMLElement>("input:not([type=hidden]),textarea,select")
        ?.focus();
    }
    if (!open && element.open) element.close();
  }, [open]);

  const show = (key: string, button: string) => {
    returnTo.current = button;
    setOpen(key);
  };
  const row = rows.find((item) => rowKey(item.id, item.version) === open);
  const title = open === addKey ? addLabel : row ? `Edit ${row.name}` : "";

  return (
    <>
      <ListTop heading={heading}>
        <button
          type="button"
          id={addId}
          className="button-primary"
          aria-haspopup="dialog"
          onClick={() => show(addKey, addId)}
        >
          {addLabel}
        </button>
      </ListTop>
      <OrderedList
        list={list}
        label={label}
        look="rows"
        rows={rows.map((item) => {
          const key = rowKey(item.id, item.version);
          const buttonId = `${idPrefix}-edit-${item.id}`;
          return {
            id: item.id,
            version: item.version,
            name: item.name,
            content: (
              // A tap on the row opens it too; the button is the keyboard's way in.
              <div className={s.tap} onClick={() => show(key, buttonId)}>
                <ItemRow
                  title={item.name}
                  summary={item.summary}
                  action={
                    <button
                      type="button"
                      id={buttonId}
                      className="button-secondary"
                      aria-haspopup="dialog"
                      onClick={(event) => {
                        event.stopPropagation();
                        show(key, buttonId);
                      }}
                    >
                      Edit<span className="sr-only"> {item.name}</span>
                    </button>
                  }
                />
              </div>
            ),
          };
        })}
      />
      <dialog
        ref={dialog}
        className={s.sheet}
        aria-labelledby={titleId}
        onClose={() => {
          setOpen(null);
          const id = returnTo.current;
          if (id) document.getElementById(id)?.focus();
        }}
        onClick={(event) => {
          // A tap on the dimmed page behind closes it.
          if (event.target === dialog.current) setOpen(null);
        }}
      >
        {open ? (
          <div className={s.sheetBody}>
            <div className={s.sheetHead}>
              <h2 id={titleId} className={s.sheetTitle}>
                {title}
              </h2>
              <button
                type="button"
                className={s.sheetClose}
                aria-label="Close"
                onClick={() => setOpen(null)}
              >
                <X aria-hidden="true" size={22} />
              </button>
            </div>
            {open === addKey ? addForm : row?.form}
            {open === addKey ? null : row?.below}
          </div>
        ) : null}
      </dialog>
    </>
  );
}
