"use client";
import { useActionState, useState, type FormEvent } from "react";
import { sizeItemName } from "@/lib/community/merch";
import { go2payCopyText } from "@/lib/community/payment-policy";
import type { EditableItem } from "./FundEditor";
import { CheckedForm } from "./form-check/CheckedForm";
import { FieldError } from "./form-check/FieldError";
import { noProblems } from "./form-check/problems";
import { Go2PayBox } from "./Go2PayBox";
import { initialKeptForm, typedValues } from "./form-state";
import { ArchiveActions } from "./ArchiveActions";
import {
  archivePaymentItemAction,
  restorePaymentItemAction,
  saveTicketAction,
} from "./payment-actions";
import { itemFromForm } from "./payment-forms";
import { ticketCopyRows } from "./payment-words";
import { DateField } from "@/shared/ui/DateField";
import { anyDate, dayRange } from "@/lib/time/field-rules";

const ticketWords = {
  thing: "ticket",
  about: "About this ticket (optional)",
  money:
    "Ticket money is General money. Price and stock live only in Go2Pay; the website shows “See price and buy ↗”.",
  endsWith:
    "The Buy button also goes away when its event ends, is cancelled or is archived.",
  archive:
    "Its Buy button goes away, also on an event that uses it. Close its product in Go2Pay too. You can restore it later under Archived.",
  archiveButton: "Archive ticket",
};
// A merch size (PR5c): new wording, on the release checklist.
const sizeWords = {
  thing: "size",
  about: "About this size (optional)",
  money:
    "Merch money is General money. Price and stock live only in Go2Pay; the website shows “See price and buy ↗” for each size.",
  endsWith:
    "The button also goes away when the item is archived or its collection is no longer on sale.",
  archive:
    "Its button goes away from the Merch page. Close its product in Go2Pay too. You can restore it later.",
  archiveButton: "Archive size",
};

/**
 * Add or edit a ticket (PR6 WP-6, D-65; P-72 B: no price or stock on our
 * pages): its name and sentence, the days it is on sale, and its Go2Pay page,
 * which the board makes by hand with the price and stock. Ticket money is
 * always General. An event chooses its ticket in the event form (WP-9).
 * With `size`, a merch item's size (PR5c, D-27 a): the same, with the size
 * ("M") in place of the name; it is saved as "<item> · <size>".
 */
export function PricedItemEditor({
  item,
  current,
  earlier,
  receiptNote,
  canEditPages,
  size = null,
}: {
  item: EditableItem;
  current: number | null;
  earlier: readonly number[];
  receiptNote: string;
  /** Whether this board member edits Pages (review 3 B). */
  canEditPages: boolean;
  /** A merch size: its merch item. */
  size?: { itemId: string; itemName: string } | null;
}) {
  const [state, action, pending] = useActionState(
    saveTicketAction,
    initialKeptForm,
  );
  const words = size ? sizeWords : ticketWords;
  const { version, slug, ...saved } = item;
  const start: Record<string, string> = state.values ?? saved;
  // A size's name is its item's name and the size, as the save makes it.
  const named = (typed: Record<string, string>) =>
    size
      ? { ...typed, name: sizeItemName(size.itemName, typed.size_label ?? "") }
      : typed;
  const [values, setValues] = useState(() => named(start));
  const onChange = (event: FormEvent<HTMLFormElement>) =>
    setValues(named(typedValues(new FormData(event.currentTarget))));
  const copy = go2payCopyText(
    {
      name: values.name ?? "",
      category: "general",
      about: values.about ?? "",
    },
    receiptNote,
  );
  // The save's own rules (`itemFromForm`), as you type.
  const check = (element: HTMLFormElement) => {
    const result = itemFromForm({
      values: named(typedValues(new FormData(element))),
      kind: "priced",
      slug: slug ?? "new",
      before: version
        ? {
            category: "general",
            position: Number(item.position),
            season_id: "",
            season_year: null,
            first_shown_at: null,
          }
        : null,
      currentLink:
        current === null
          ? null
          : {
              go2pay_product_id: current,
              payment_item_id: item.id,
              added_at: "",
            },
      season: null,
    });
    return result.ok ? noProblems : result.fields;
  };
  return (
    <>
      <CheckedForm
        action={action}
        state={state}
        check={check}
        className="editor-form"
        key={state.attempt}
        onChange={onChange}
      >
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="version" value={version ?? ""} />
        <input type="hidden" name="merch_item_id" value={size?.itemId ?? ""} />
        <fieldset>
          <legend>About</legend>
          {size ? (
            <label>
              Size
              <span className="muted">
                Shown on its button on the Merch page.
              </span>
              <input
                name="size_label"
                required
                maxLength={20}
                autoComplete="off"
                placeholder="M"
                defaultValue={start.size_label}
              />
              <FieldError name="size_label" />
            </label>
          ) : (
            <label>
              Name
              <span className="muted">
                Shown on the button. Changes are logged.
              </span>
              <input
                name="name"
                required
                maxLength={80}
                autoComplete="off"
                placeholder="Welcome dinner ticket"
                defaultValue={start.name}
              />
              <FieldError name="name" />
            </label>
          )}
          <label>
            {words.about}
            <span className="muted">
              One short sentence. You may mention the price in your own words.
            </span>
            <textarea
              name="about"
              rows={2}
              maxLength={300}
              placeholder={
                size ? "Fits true to size." : "Dinner and talk after Maghrib."
              }
              defaultValue={start.about}
            />
            <FieldError name="about" />
          </label>
          <p>
            <strong>Buy link</strong>{" "}
            <span className="muted">
              {slug ? "Never changes." : "Made when you first save."}
            </span>
            <br />
            <code>{slug ? `/donate/${slug}/give` : "/donate/…/give"}</code>
          </p>
          <p className="muted">{words.money}</p>
        </fieldset>
        <fieldset>
          <legend>When it is on sale</legend>
          <label className="check-label">
            <input
              type="checkbox"
              name="listed"
              defaultChecked={start.listed === "on"}
            />
            On sale
          </label>
          <div className="form-grid compact">
            <label>
              Show from (optional)
              <DateField
                name="shows_from"
                rule={anyDate}
                defaultValue={start.shows_from}
              />
              <FieldError name="shows_from" />
            </label>
            <label>
              Show until (optional)
              {/* Not before "Show from" (the save's rule). */}
              <DateField
                name="shows_until"
                rule={dayRange({ from: { box: "shows_from" } })}
                defaultValue={start.shows_until}
              />
              <FieldError name="shows_until" />
            </label>
          </div>
          <input type="hidden" name="position" value={start.position} />
          <p className="muted">{words.endsWith}</p>
        </fieldset>
        <Go2PayBox
          steps={
            <ol className="help-steps">
              <li>In Go2Pay, make a new product and copy these into it.</li>
              <li>Set its price and how many are for sale.</li>
              <li>Save it, copy its page link, and paste it below.</li>
            </ol>
          }
          rows={ticketCopyRows.map((row) => ({
            ...row,
            text: copy[row.key],
          }))}
          link={values.link ?? ""}
          current={current}
          earlier={earlier}
          itemName={values.name ?? ""}
          receiptMissing={!receiptNote.trim()}
          canEditPages={canEditPages}
        />
        <button className="button-primary" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </CheckedForm>
      {version ? (
        <ArchiveActions
          archived={false}
          fields={{
            id: item.id,
            version,
            kind: "priced",
            ...(size ? { merch_item_id: size.itemId } : {}),
          }}
          archive={{
            action: archivePaymentItemAction,
            summary: `Archive this ${words.thing}`,
            label: words.archiveButton,
            explain: words.archive,
          }}
          restore={{ action: restorePaymentItemAction }}
        />
      ) : null}
    </>
  );
}
