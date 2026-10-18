import Link from "next/link";
import type { ReactNode } from "react";
import type { EditorState } from "./actions";
import { purgeForbidden } from "./fields";
import s from "./archive-actions.module.css";
import { ActionForm, type FormAction } from "./RecordActions";

/** "Archive this …" on a current item: what it does, and why it is refused now. */
type Archive<S extends EditorState> = {
  action: FormAction<S>;
  initial?: S;
  /** The closed line: "Archive this item". */
  summary: string;
  /** The button: "Archive", "Archive fund". */
  label: string;
  /** What archiving does, in one or two sentences. */
  explain: ReactNode;
  /** Why it would be refused now (a UX mirror; the server decides): the button is off. */
  lock?: string | null;
  /** The tour step that points at it. */
  tour?: string;
};

/** Delete permanently, where it exists (D-6: "manage people" holders, typed DELETE). */
type Purge = {
  action: FormAction;
  /** The signed-in board member may delete permanently (a UX mirror). */
  allowed: boolean;
  /** What else a permanent delete removes. */
  note?: string;
  /** Why this one cannot be deleted now (a group someone is still in). */
  blocked?: string | null;
  /** The button, when not "Delete permanently". */
  label?: string;
};

export type ArchiveActionsProps<
  S extends EditorState = EditorState,
  R extends EditorState = EditorState,
> = {
  /** Archived now: Restore, View and Delete permanently; never Archive. */
  archived: boolean;
  /** Hidden fields naming the item and the version on screen. */
  fields: Record<string, string>;
  /** Read after each button by screen readers, where a list has several. */
  itemName?: string;
  /**
   * "page": an editor or an archived item's page (each part a card);
   * "row": inside a list row or a dragged card (no cards).
   */
  layout?: "page" | "row";
  archive?: Archive<S>;
  restore: { action: FormAction<R>; initial?: R };
  /** The archived item's read-only page (from a list). */
  view?: string;
  purge?: Purge;
  /**
   * An archived item's page: what it held, drawn in one card with Restore
   * (`ArchivedEntry`); `between` goes under that card, above Delete
   * permanently (a photo removal).
   */
  entry?: { labelledBy: string; content: ReactNode; between?: ReactNode };
};

/**
 * The one set of archive actions every board list and editor uses (review
 * fixes P1, item 6; ADR 0013): the actions follow the item's state. A
 * current item offers Archive; an archived one offers View (from a list),
 * Restore and, where it exists, Delete permanently. The server actions
 * check everything again.
 */
export function ArchiveActions<
  S extends EditorState = EditorState,
  R extends EditorState = EditorState,
>({
  archived,
  fields,
  itemName,
  layout = "page",
  archive,
  restore,
  view,
  purge,
  entry,
}: ArchiveActionsProps<S, R>) {
  const card = layout === "page" ? "content-card" : undefined;
  if (!archived) {
    if (!archive) return null;
    return (
      <details className={card} data-tour={archive.tour}>
        <summary>
          {archive.summary}
          {itemName && layout === "row" ? (
            <span className="sr-only"> {itemName}</span>
          ) : null}
        </summary>
        <p className={layout === "row" ? "muted" : undefined}>
          {archive.explain}
        </p>
        {archive.lock ? <p className="muted">{archive.lock}</p> : null}
        <ActionForm
          action={archive.action}
          initial={archive.initial}
          fields={fields}
          label={archive.label}
          pendingLabel="Archiving…"
          itemName={layout === "row" ? itemName : undefined}
          disabled={Boolean(archive.lock)}
        />
      </details>
    );
  }
  // In a list, Delete permanently shows only to who can use it; an item's
  // own page says why it is not offered.
  const purgeShown =
    purge && (layout === "page" || purge.allowed || purge.blocked);
  const buttons = (
    <div className={s.actions}>
      {view ? (
        <Link className="button-secondary" href={view}>
          View{itemName ? <span className="sr-only"> {itemName}</span> : null}
        </Link>
      ) : null}
      <ActionForm
        action={restore.action}
        initial={restore.initial}
        fields={fields}
        label="Restore"
        pendingLabel="Restoring…"
        itemName={itemName}
        primary={layout === "page"}
      />
    </div>
  );
  return (
    <>
      {entry ? (
        <section className="content-card" aria-labelledby={entry.labelledBy}>
          {entry.content}
          <div className={s.entryActions}>{buttons}</div>
        </section>
      ) : (
        buttons
      )}
      {entry?.between}
      {purge && purgeShown ? (
        <details className={card ?? s.purge}>
          <summary>
            Delete permanently
            {itemName ? <span className="sr-only"> {itemName}</span> : null}
          </summary>
          <p className={layout === "row" ? "muted" : undefined}>
            Permanent delete cannot be undone. Recent changes keeps a record
            that it happened.{purge.note ? ` ${purge.note}` : ""}
          </p>
          {!purge.allowed ? (
            <p className="muted">{purgeForbidden}</p>
          ) : purge.blocked ? (
            <p className="muted">{purge.blocked}</p>
          ) : (
            <ActionForm
              action={purge.action}
              fields={fields}
              label={purge.label ?? "Delete permanently"}
              pendingLabel="Deleting…"
              itemName={itemName}
              confirmDelete
            />
          )}
        </details>
      ) : null}
    </>
  );
}

/**
 * An archived item in a board list: its name and details, then the archive
 * actions (View, Restore, Delete permanently) under it on a phone.
 */
export function ArchivedRow<R extends EditorState = EditorState>({
  name,
  heading: Heading = "h2",
  children,
  ...actions
}: {
  name: string;
  heading?: "h2" | "h3";
  /** More about the item under its name. */
  children?: ReactNode;
} & Omit<ArchiveActionsProps<EditorState, R>, "archived" | "layout">) {
  return (
    <li className={s.row}>
      <div className={s.name}>
        <Heading>{name}</Heading>
        {children}
      </div>
      <ArchiveActions
        {...actions}
        archived
        layout="row"
        itemName={actions.itemName ?? name}
      />
    </li>
  );
}
