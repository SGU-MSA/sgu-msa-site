"use client";
import { useActionState, useState } from "react";
import type { MerchCollectionView } from "@/lib/community/merch";
import type { MerchContent } from "@/lib/content/schemas";
import { MERCH_PHOTOS_MAX } from "@/lib/media/photo-limits";
import { photoListForm } from "@/lib/media/photo-list";
import quiet from "@/shared/ui/page.module.css";
import { NowWearing } from "@/features/merch/NowWearing";
import { CheckedForm } from "../form-check/CheckedForm";
import { FieldError } from "../form-check/FieldError";
import { noProblems } from "../form-check/problems";
import { initialKeptForm, typedValues } from "../form-state";
import { EditorPreview } from "../preview/EditorPreview";
import { PhotoListField } from "../PhotoListField";
import { photoRows } from "../SeasonPageFields";
import { ArchiveActions } from "../ArchiveActions";
import {
  archiveMerchItemAction,
  restoreMerchItemAction,
  saveMerchItemAction,
} from "./merch-actions";
import { merchItemFromForm } from "./merch-forms";

/** An item as its form starts: every box as text, the photos as JSON. */
export type EditableMerchItem = {
  id: string;
  collection_id: string;
  name: string;
  description: string;
  garment: string;
  colorway: string;
  photos: string;
  position: string;
  /** The row's `updated_at`; null for a new item. */
  version: string | null;
};

/** The keys of the new photos whose file is chosen in the form. */
function chosenPhotos(form: HTMLFormElement) {
  const chosen = new Set<string>();
  for (const input of form.querySelectorAll<HTMLInputElement>(
    'input[type="file"][name^="photo:photos:"]',
  ))
    if (input.files?.length)
      chosen.add(input.name.slice("photo:photos:".length));
  return chosen;
}

/**
 * Add or edit a merch item (PR5c, D-9, D-27 c; any board member): its name,
 * description, garment and colour, and its photos in order (the first is
 * the cover; each needs a description). Its sizes are listed under the
 * form. Preview draws its collection on the Merch page with this item as
 * typed (new photos show as placeholders until saved).
 */
export function MerchItemEditor({
  item,
  collection,
  page,
}: {
  item: EditableMerchItem;
  /** Its collection as the Merch page draws it, for Preview. */
  collection: MerchCollectionView;
  page: MerchContent;
}) {
  const [state, action, pending] = useActionState(
    saveMerchItemAction,
    initialKeptForm,
  );
  const [shrinking, setShrinking] = useState(false);
  const { version, ...saved } = item;
  const values: Partial<Record<string, string>> = state.values ?? saved;
  const check = (element: HTMLFormElement) => {
    const typed = typedValues(new FormData(element));
    const result = merchItemFromForm(typed);
    const photos = photoListForm({
      list: "photos",
      posted: typed.photos,
      max: MERCH_PHOTOS_MAX,
      chosen: chosenPhotos(element),
    });
    return result.ok && photos.ok
      ? noProblems
      : {
          ...(photos.ok ? {} : photos.fields),
          ...(result.ok ? {} : result.fields),
        };
  };
  const form = (
    <CheckedForm
      action={action}
      state={state}
      check={check}
      className="editor-form"
      key={state.attempt}
    >
      <input type="hidden" name="id" value={item.id} />
      <input type="hidden" name="version" value={version ?? ""} />
      <input type="hidden" name="position" value={item.position} />
      <input type="hidden" name="collection_id" value={item.collection_id} />
      <fieldset>
        <legend>The item</legend>
        <label>
          Name
          <input
            name="name"
            required
            maxLength={80}
            autoComplete="off"
            placeholder="Shukr long-sleeve"
            defaultValue={values.name}
          />
          <FieldError name="name" />
        </label>
        <label>
          Description (optional)
          <span className="muted">
            You may mention the price in your own words; the price itself lives
            only in Go2Pay.
          </span>
          <textarea
            name="description"
            rows={3}
            maxLength={1000}
            placeholder="A navy long-sleeve with Shukr across the back."
            defaultValue={values.description}
          />
          <FieldError name="description" />
        </label>
        <div className="form-grid compact">
          <label>
            Garment (optional)
            <input
              name="garment"
              maxLength={60}
              autoComplete="off"
              placeholder="Long-sleeve"
              defaultValue={values.garment}
            />
            <FieldError name="garment" />
          </label>
          <label>
            Colour (optional)
            <input
              name="colorway"
              maxLength={60}
              autoComplete="off"
              placeholder="Navy"
              defaultValue={values.colorway}
            />
            <FieldError name="colorway" />
          </label>
        </div>
      </fieldset>
      <PhotoListField
        name="photos"
        label={`Photos (up to ${MERCH_PHOTOS_MAX}; the first is the cover)`}
        initial={photoRows(values.photos)}
        max={MERCH_PHOTOS_MAX}
        example="The back print of the navy long-sleeve"
        onShrinking={setShrinking}
      />
      <button className="button-primary" disabled={pending || shrinking}>
        {pending ? "Saving…" : "Save"}
      </button>
    </CheckedForm>
  );
  return (
    <>
      <EditorPreview
        form={form}
        preview={(typed) => {
          const parsed = merchItemFromForm(typed);
          if (!parsed.ok)
            return (
              <ul role="note">
                {[...new Set(Object.values(parsed.fields))].map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            );
          const sizes =
            collection.items.find((other) => other.id === item.id)?.sizes ?? [];
          const typedItem = {
            ...parsed.row,
            photos: photoRows(typed.photos),
            sizes,
          };
          const others = collection.items.filter(
            (other) => other.id !== item.id,
          );
          const view = {
            ...collection,
            items: version
              ? collection.items.map((other) =>
                  other.id === item.id ? typedItem : other,
                )
              : [...others, typedItem],
          };
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
          fields={{
            id: item.id,
            version,
            collection_id: item.collection_id,
          }}
          archive={{
            action: archiveMerchItemAction,
            summary: "Archive this item",
            label: "Archive item",
            explain:
              "Archive its sizes first (under Sizes on this screen). Then the item leaves the Merch page. Close the sizes’ products in Go2Pay too. You can restore it later from its collection.",
          }}
          restore={{ action: restoreMerchItemAction }}
        />
      ) : null}
    </>
  );
}
