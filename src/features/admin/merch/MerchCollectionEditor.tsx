"use client";
import { useActionState } from "react";
import type { MerchItemView } from "@/lib/community/merch";
import type { MerchContent } from "@/lib/content/schemas";
import quiet from "@/shared/ui/page.module.css";
import { NowWearing } from "@/features/merch/NowWearing";
import { CheckedForm } from "../form-check/CheckedForm";
import { FieldError } from "../form-check/FieldError";
import { noProblems } from "../form-check/problems";
import { initialKeptForm, typedValues } from "../form-state";
import { EditorPreview } from "../preview/EditorPreview";
import { ArchiveActions } from "../ArchiveActions";
import {
  archiveCollectionAction,
  restoreCollectionAction,
  saveCollectionAction,
} from "./merch-actions";
import { collectionFromForm } from "./merch-forms";

/** A collection as its form starts: every box as text. */
export type EditableCollection = {
  id: string;
  name: string;
  arabic: string;
  quote: string;
  year: string;
  description: string;
  /** "current" (on sale now) or "past". */
  era: string;
  position: string;
  /** The row's `updated_at`; null for a new collection. */
  version: string | null;
};

/**
 * Add or edit a merch collection (PR5c, D-9; any board member): its name,
 * Arabic name, quote, year and description, and whether it is on sale now.
 * Preview draws the Merch page with its current items.
 */
export function MerchCollectionEditor({
  collection,
  items,
  page,
}: {
  collection: EditableCollection;
  /** Its current items as the Merch page draws them, for Preview. */
  items: readonly MerchItemView[];
  /** The Merch page's opening (page text), for Preview. */
  page: MerchContent;
}) {
  const [state, action, pending] = useActionState(
    saveCollectionAction,
    initialKeptForm,
  );
  const { version, ...saved } = collection;
  const values: Partial<Record<string, string>> = state.values ?? saved;
  const check = (element: HTMLFormElement) => {
    const result = collectionFromForm(typedValues(new FormData(element)));
    return result.ok ? noProblems : result.fields;
  };
  const form = (
    <CheckedForm
      action={action}
      state={state}
      check={check}
      className="editor-form"
      key={state.attempt}
    >
      <input type="hidden" name="id" value={collection.id} />
      <input type="hidden" name="version" value={version ?? ""} />
      <input type="hidden" name="position" value={collection.position} />
      <fieldset>
        <legend>The collection</legend>
        <label>
          Name
          <input
            name="name"
            required
            maxLength={80}
            autoComplete="off"
            placeholder="Shukr"
            defaultValue={values.name}
          />
          <FieldError name="name" />
        </label>
        <div className="form-grid compact">
          <label>
            Arabic name (optional)
            <input
              name="arabic"
              dir="rtl"
              lang="ar"
              maxLength={80}
              autoComplete="off"
              placeholder="شكر"
              defaultValue={values.arabic}
            />
            <FieldError name="arabic" />
          </label>
          <label>
            Year (optional)
            <input
              name="year"
              maxLength={20}
              autoComplete="off"
              placeholder="2026"
              defaultValue={values.year}
            />
            <FieldError name="year" />
          </label>
        </div>
        <label>
          Quote (optional)
          <input
            name="quote"
            maxLength={200}
            autoComplete="off"
            placeholder="Give thanks in ease and in hardship."
            defaultValue={values.quote}
          />
          <FieldError name="quote" />
        </label>
        <label>
          Description (optional)
          <textarea
            name="description"
            rows={3}
            maxLength={1000}
            placeholder="The current MSA collection."
            defaultValue={values.description}
          />
          <FieldError name="description" />
        </label>
        <fieldset className="choice">
          <legend>On sale now?</legend>
          <div className="check-row">
            <label className="check-label">
              <input
                type="radio"
                name="era"
                value="current"
                defaultChecked={values.era === "current"}
              />
              Yes: its sizes can be bought
            </label>
            <label className="check-label">
              <input
                type="radio"
                name="era"
                value="past"
                defaultChecked={values.era === "past"}
              />
              No: shown as “Not for sale”
            </label>
          </div>
          <FieldError name="era" />
        </fieldset>
      </fieldset>
      <button className="button-primary" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </button>
    </CheckedForm>
  );
  return (
    <>
      <EditorPreview
        form={form}
        preview={(typed) => {
          const parsed = collectionFromForm(typed);
          if (!parsed.ok)
            return (
              <ul role="note">
                {[...new Set(Object.values(parsed.fields))].map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            );
          const view = { ...parsed.row, items: [...items] };
          return (
            <div className={quiet.page}>
              <NowWearing
                content={page}
                data={{
                  state: "ready",
                  lead: view.era === "current" ? view : null,
                  others: view.era === "current" ? [] : [view],
                }}
              />
            </div>
          );
        }}
      />
      {version ? (
        <ArchiveActions
          archived={false}
          fields={{ id: collection.id, version }}
          archive={{
            action: archiveCollectionAction,
            summary: "Archive this collection",
            label: "Archive collection",
            explain:
              "It leaves the Merch page with its items and their sizes. Close the sizes’ products in Go2Pay too. You can restore it later under Archived.",
          }}
          restore={{ action: restoreCollectionAction }}
        />
      ) : null}
    </>
  );
}
