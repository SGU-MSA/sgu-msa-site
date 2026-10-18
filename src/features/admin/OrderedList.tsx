"use client";
import { useActionState, useEffect, useState, type ReactNode } from "react";
import type { OrderedList as OrderedTable } from "@/lib/community/order";
import { systemText } from "@/lib/system-text";
import { SortableList } from "@/shared/ui/SortableList";
import { FormMessages } from "./FormMessages";
import { initialEditorState } from "./fields";
import { saveOrderAction } from "./order-actions";
import { showSaved } from "./save-state/saved-note";

const words = systemText.order;

/** One row of a board list the board can put in order. */
export type OrderedRow = {
  id: string;
  /** The row's `updated_at` as shown. */
  version: string;
  /** For the drag handle and the announcement. */
  name: string;
  /** What the row shows (rendered on the server or in a client editor). */
  content: ReactNode;
};

/**
 * A board list in the order the board drags it into (review fixes PR-2),
 * with one "Save order" for the whole list. "Save order" and "Undo" appear
 * once the order differs from the saved one. After a save the page shows
 * the stored order again (with the new versions), and the dashboard's one
 * "Saved" toast says "Order saved." (review fixes P1, item 2).
 */
export function OrderedList({
  list,
  rows,
  label,
  look,
  tour,
}: {
  list: OrderedTable;
  rows: readonly OrderedRow[];
  /** The list's accessible name, such as the group's name. */
  label: string;
  look?: "rows" | "cards";
  /** A "Show me how" target on the list (`data-tour`). */
  tour?: string;
}) {
  const [state, action, pending] = useActionState(
    saveOrderAction,
    initialEditorState,
  );
  // Each answer with a notice is a finished save: the toast says it.
  useEffect(() => {
    if (state.notice) showSaved(state.notice);
  }, [state]);
  // The saved order; a new one from the server (after any save) starts over.
  const saved = rows.map((row) => `${row.id}@${row.version}`).join(",");
  const [draft, setDraft] = useState({ saved, ids: rows.map((row) => row.id) });
  if (draft.saved !== saved)
    setDraft({ saved, ids: rows.map((row) => row.id) });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered = draft.ids.flatMap((id) => byId.get(id) ?? []);
  const changed = draft.ids.join() !== rows.map((row) => row.id).join();
  const order = JSON.stringify(
    ordered.map((row) => ({ id: row.id, version: row.version })),
  );
  return (
    <div data-tour={tour}>
      <SortableList
        items={ordered}
        itemKey={(row) => row.id}
        itemName={(row) => row.name}
        onReorder={(next) =>
          setDraft({ saved, ids: next.map((row) => row.id) })
        }
        label={label}
        look={look}
      >
        {(row) => row.content}
      </SortableList>
      {changed ? (
        <form action={action} className="order-bar">
          <input type="hidden" name="list" value={list} />
          <input type="hidden" name="order" value={order} />
          <p>{words.changed}</p>
          <div className="order-bar-actions">
            <button className="button-primary" disabled={pending}>
              {pending ? words.saving : words.save}
            </button>
            <button
              type="button"
              className="button-secondary"
              disabled={pending}
              onClick={() =>
                setDraft({ saved, ids: rows.map((row) => row.id) })
              }
            >
              {words.undo}
            </button>
          </div>
          <FormMessages error={state.error} notice={null} />
        </form>
      ) : (
        <FormMessages error={state.error} notice={null} />
      )}
    </div>
  );
}
